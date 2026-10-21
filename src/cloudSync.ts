import {db} from './db';
import {supabase} from './supabase';
import {clean,equal,mergeDocuments,type Json} from './merge';
export type SyncKind='reading'|'vocabulary'|'children';
export type SyncEdit={key:string;kind:SyncKind;id:string;label:string;base:Json;local:Json;token:string;conflicts:string[];remote?:Json;error?:string;blocked?:boolean};
type Queue=Record<string,SyncEdit>;
const key=(uid:string)=>`sync-outbox:${uid}`;
const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('lasach-sync');
channel?.addEventListener('message',()=>window.dispatchEvent(new Event('lasach-sync')));
function changed(){window.dispatchEvent(new Event('lasach-sync'));channel?.postMessage('changed');}
async function identity(){const {data,error}=await supabase!.auth.getSession();if(error||!data.session)throw new Error('Vui lòng đăng nhập lại.');return data.session;}
export async function syncEdits():Promise<SyncEdit[]> {const auth=await identity();return Object.values((await (await db).get('settings',key(auth.user.id)))||{});}
async function mutate(uid:string,fn:(q:Queue)=>void){const tx=(await db).transaction('settings','readwrite');const q:Queue=await tx.store.get(key(uid))||{};fn(q);await tx.store.put(q,key(uid));await tx.done;changed();}
export async function queueEdit(kind:SyncKind,id:string,label:string,base:Json,local:Json,expectedUid?:string) {
 if(equal(base,local))return;
 const uid=(await identity()).user.id;
 if(expectedUid&&uid!==expectedUid)throw new Error('Tài khoản đã thay đổi. Vui lòng mở lại dữ liệu.');
 await mutate(uid,q=>{
  const k=`${kind}:${id}`,previous=q[k];
  const desired=previous?mergeDocuments(base,local,previous.local).value:local;
  q[k]={key:k,kind,id,label,base:previous?previous.base:clean(base),local:clean(desired),token:crypto.randomUUID(),conflicts:previous?.conflicts||[],remote:previous?.remote};
 });
}
export async function pendingDocument(kind:SyncKind,id:string,fallback:Json):Promise<Json>{const edits=await syncEdits();return edits.find(e=>e.kind===kind&&e.id===id)?.local??fallback;}
export async function overlayCollection<T extends {id:string}>(kind:'vocabulary'|'children',rows:T[]):Promise<T[]> {
 const items=new Map(rows.map(v=>[v.id,v]));for(const e of await syncEdits())if(e.kind===kind){if(e.local===null)items.delete(e.id);else items.set(e.id,e.local as unknown as T);}return [...items.values()];
}
async function acknowledge(uid:string,snapshot:SyncEdit,document:Json) {
 const tx=(await db).transaction('settings','readwrite'),q:Queue=await tx.store.get(key(uid))||{},current=q[snapshot.key];
 if(current?.token===snapshot.token)delete q[snapshot.key];
 else if(current){const merged=mergeDocuments(snapshot.local,current.local,document);q[snapshot.key]={...current,base:document,local:merged.value,conflicts:merged.conflicts,remote:merged.conflicts.length?document:undefined};}
 await tx.store.put(q,key(uid));
 if(snapshot.kind==='reading') {
  const cacheKey=`cloud-cache:${uid}`,cache=await tx.store.get(cacheKey);
  if(cache){const existing=cache.states.find((s:{book_id:string})=>s.book_id===snapshot.id);if(existing)Object.assign(existing,document);else cache.states.push({book_id:snapshot.id,position:{chapter:0,paragraph:0},...document as object});await tx.store.put(cache,cacheKey);}
 }else{
  const cacheKey=`collection:${uid}:${snapshot.kind}`,cache:{id:string}[]=await tx.store.get(cacheKey)||[];
  const rows=cache.filter(v=>v.id!==snapshot.id);if(document!==null)rows.push(document as unknown as {id:string});await tx.store.put(rows,cacheKey);
 }
 await tx.store.put((await tx.store.get(`sync-version:${uid}`)||0)+1,`sync-version:${uid}`);
 await tx.done;changed();
}
let inFlight:Promise<void>|null=null;
export async function flushEdits():Promise<void>{
 if(inFlight)return inFlight;if(!supabase||!navigator.onLine)return;
 const run=async()=>{
  const auth=await identity(),uid=auth.user.id;
  const work=async()=>{
   const q:Queue=await (await db).get('settings',key(uid))||{};
   for(const initial of Object.values(q).filter(e=>!e.conflicts.length&&!e.blocked).slice(0,50)){
    if(initial.conflicts.length||initial.blocked)continue;
    let entry=initial;
    for(let attempt=0;attempt<3;attempt++){
     if((await identity()).user.id!==uid)return;
     const personal=entry.kind==='reading';
     const result=await supabase!.rpc(personal?'sync_personal_book_state':'sync_collection_document',personal?{bid:entry.id,expected_state:entry.base,next_state:entry.local}:{collection_name:entry.kind,item_id:entry.id,expected_document:entry.base,next_document:entry.local}).setHeader('Authorization',`Bearer ${auth.access_token}`).retry(false).abortSignal(AbortSignal.timeout(8000));
     if(result.error){
      const error=result.error.message||'Chưa gửi được thay đổi lên cloud.';
      await mutate(uid,q=>{const e=q[entry.key];if(e?.token===entry.token){e.error=error;e.blocked=/Not allowed|permission denied|row-level security|Invalid|constraint/.test(error);}});
      if(!navigator.onLine||!result.error.code||result.error.code.startsWith('PGRST'))return;
      break;
     }
     const remote=result.data as {applied:boolean;document:Json};
     if(remote.applied){await acknowledge(uid,entry,remote.document);break;}
     let next:SyncEdit|undefined;
     await mutate(uid,q=>{
      const current=q[entry.key];if(!current)return;
      const merged=mergeDocuments(entry.base,current.local,remote.document);
      next={...current,base:remote.document,local:merged.value,remote:remote.document,conflicts:merged.conflicts,error:undefined};q[entry.key]=next;
     });
     if(!next||next.conflicts.length)break;entry=next;
    }
   }
  };
  if(navigator.locks)await navigator.locks.request(`lasach-sync:${uid}`,work);else await work();
 };
 inFlight=run();try{await inFlight;}finally{inFlight=null;}
}
export async function resolveEdit(edit:SyncEdit,choice:'local'|'cloud'|'retry') {
 const uid=(await identity()).user.id;
 const update=()=>mutate(uid,q=>{
  const current=q[edit.key];if(!current||current.token!==edit.token)throw new Error('Thay đổi vừa được cập nhật hoặc đã gửi. Hãy xem lại trước khi chọn.');
  if(choice==='cloud')delete q[edit.key];
  else q[edit.key]={...current,base:Object.hasOwn(current,'remote')?current.remote!:current.base,conflicts:[],blocked:false,error:undefined,token:crypto.randomUUID()};
 });
 if(navigator.locks)await navigator.locks.request(`lasach-sync:${uid}`,update);else {if(inFlight)await inFlight;await update();}
 if(choice!=='cloud')await flushEdits();
}
