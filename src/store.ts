import { canonicalBook, personalState, applyPersonal, type PersonalState } from "./bookState";
import { openDB } from "idb";
import { createClient } from "@supabase/supabase-js";
import { assertBook, type Book, type Word, type Child } from "./model";
const db = openDB("lasach-v1", 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "id" });
    if (!db.objectStoreNames.contains("originals")) db.createObjectStore("originals");
    if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
    if (!db.objectStoreNames.contains("pdfDrafts")) db.createObjectStore("pdfDrafts", { keyPath: ["draftId", "page"] });
  },
});
export const supabase =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      )
    : null;
const revisions = new Map<string, number>();
const bases = new Map<string, Book>();
const owners = new Map<string, string>();
const progress = new Map<string, {position: Book['position']; at: string}>();
let flushing: Promise<void> | null = null;
export async function session() {
  const {data,error}=await supabase!.auth.getSession();
  if(error||!data.session) throw new Error("Vui lòng đăng nhập lại.");
  return data.session;
}
export async function userId() {
  const { data, error } = await supabase!.auth.getSession();
  if (error || !data.session?.user) throw new Error("Vui lòng đăng nhập lại.");
  return data.session.user.id;
}
export function canEditBook(bookId: string) { return !owners.has(bookId) || owners.get(bookId) === currentAccount; }
let currentAccount = "";
export async function listBooks(cloud: boolean): Promise<Book[]> {
  if (!cloud) {
    const rows:Book[]=(await (await db).getAll("books")).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const quick=quickProgress('local');
    if(quick){const book=rows.find(b=>b.id===quick.bid);if(book)book.position=quick.position;}
    return rows;
  }
  const uid = await userId();
  if (currentAccount !== uid) { bases.clear(); owners.clear(); revisions.clear(); progress.clear(); currentAccount = uid; }
  type Cache = { rows: {id:string;owner_id:string;revision:number;document:Book}[]; states: PersonalState[] };
  let cache: Cache;
  if (navigator.onLine) {
    const [books, states] = await Promise.all([supabase!.from("books").select("id,owner_id,revision,document").order("created_at",{ascending:false}),supabase!.from("reading_states").select("*")]);
    if (books.error || states.error) throw books.error || states.error;
    cache = {rows:books.data!,states:states.data!}; await setSetting(`cloud-cache:${uid}`, cache);
  } else cache = await getSetting<Cache>(`cloud-cache:${uid}`,{rows:[],states:[]});
  const pending = await getSetting<Record<string,{position:Book['position'];at:string}>>(`progress-outbox:${uid}`,{});
  if(navigator.onLine) {
    for(const bid of Object.keys(pending)) if(!cache.rows.some(r=>r.id===bid)) delete pending[bid];
  }
  const quick=quickProgress(uid);
  const result = cache.rows.map(r=>{
    assertBook(r.document); revisions.set(r.id,r.revision); bases.set(r.id,r.document); owners.set(r.id,r.owner_id);
    const state=cache.states.find(s=>s.book_id===r.id), book=applyPersonal(r.document,state);
    const candidates=[pending[r.id],progress.get(r.id),quick?.bid===r.id?quick:undefined].filter(Boolean).sort((a,b)=>b!.at.localeCompare(a!.at));
    const local=candidates[0];
    if(local && (!state?.position_updated_at || Date.parse(local.at)>Date.parse(state.position_updated_at))) book.position=local.position;
    assertBook(book); return book;
  });
  const opened = cache.states.filter(s=>s.last_opened_at).sort((a,b)=>b.last_opened_at!.localeCompare(a.last_opened_at!))[0];
  if(opened) await setSetting(`last-read:${uid}`,opened.book_id);
  return result;
}
export async function saveBook(book: Book, cloud: boolean) {
  if(!cloud) { const quick=quickProgress('local');await (await db).put("books",quick?.bid===book.id?{...book,position:quick.position}:book);return; }
  const auth=await session(),uid=auth.user.id; currentAccount=uid;
  const base=canonicalBook(book), prior=bases.get(book.id), revision=revisions.get(book.id);
  const structural = !prior || JSON.stringify(base)!==JSON.stringify(canonicalBook(prior));
  if(structural) {
    if(owners.has(book.id) && owners.get(book.id)!==uid) throw new Error("Chỉ chủ sách được sửa nội dung gốc. Ghi chú và vị trí của bạn vẫn lưu riêng.");
    const values={id:book.id,owner_id:uid,title:book.title,language:book.language,content_hash:book.hash,document:base};
    const result=revision===undefined ? await supabase!.from("books").insert(values).select("revision").single() : await supabase!.from("books").update(values).eq("id",book.id).eq("revision",revision).select("revision").maybeSingle();
    if(result.error) throw result.error;
    if(!result.data) throw new Error("Sách đã thay đổi trên thiết bị khác. Hãy tải lại trước khi sửa tiếp.");
    revisions.set(book.id,result.data.revision); bases.set(book.id,base); owners.set(book.id,uid);
  }
  const {error}=await supabase!.rpc("save_personal_book_state",{bid:book.id,book_shelf:book.shelf,paragraph_overrides:personalState(book),child_ids:book.approvedChildren}).setHeader("Authorization",`Bearer ${auth.access_token}`);
  if(error) {
    if(!prior) {await supabase!.from("books").delete().eq("id",book.id).eq("owner_id",uid).setHeader("Authorization",`Bearer ${auth.access_token}`);bases.delete(book.id);revisions.delete(book.id);owners.delete(book.id);}
    throw error;
  }
}
export async function flushProgress() {
  if(flushing) return flushing;
  flushing=(async()=>{
    if(!supabase || !navigator.onLine) return;
    const auth=await session(),uid=auth.user.id; const key=`progress-outbox:${uid}`;
    const pending=await getSetting<Record<string,{position:Book['position'];at:string}>>(key,{});
    const quick=quickProgress(uid);
    if(quick&&(!pending[quick.bid]||pending[quick.bid].at<quick.at)) pending[quick.bid]={position:quick.position,at:quick.at};
    for(const [bid,p] of Object.entries(pending)) {
      if(await userId()!==uid) return;
      const {error}=await supabase.rpc("save_reading_position",{bid,reading_position:p.position,recorded_at:p.at}).setHeader("Authorization",`Bearer ${auth.access_token}`);
      if(error && !error.message.includes('Not allowed')) throw error;
      if(quickProgress(uid)?.at===p.at) localStorage.removeItem(`last-progress:${uid}`);
      if(progress.get(bid)?.at===p.at) progress.delete(bid);
      await queueProgressWrite(async()=>{
        const current=await getSetting<typeof pending>(key,{});
        if(current[bid]?.at===p.at) { delete current[bid]; await setSetting(key,current); }
      });
    }
  })();
  try { await flushing; } finally { flushing=null; }
}
type QuickProgress={bid:string;position:Book['position'];at:string};
function quickProgress(uid:string):QuickProgress|null {try{return JSON.parse(localStorage.getItem(`last-progress:${uid}`)||'null');}catch{return null;}}
let progressWrites: Promise<unknown> = Promise.resolve();
function queueProgressWrite<T>(write:()=>Promise<T>):Promise<T> {
  const result=progressWrites.catch(()=>{}).then(write);progressWrites=result;return result;
}
export async function saveProgress(book: Book, position: Book['position'], cloud: boolean) {
  const at=new Date().toISOString(),knownUid=cloud?currentAccount:"local";
  if(knownUid)try{localStorage.setItem(`last-progress:${knownUid}`,JSON.stringify({bid:book.id,position,at}));}catch{/* IndexedDB remains the durable store. */}
  const uid=cloud ? await userId() : "local";
  if(cloud&&knownUid&&uid!==knownUid)return;
  progress.set(book.id,{position,at});
  const write=async()=>{
    await setSetting(`last-read:${uid}`,book.id);
    if(!cloud) {
      const tx=(await db).transaction('books','readwrite'),stored=await tx.store.get(book.id);
      if(stored)await tx.store.put({...stored,position});await tx.done;return;
    }
    const key=`progress-outbox:${uid}`, pending=await getSetting<Record<string,{position:Book['position'];at:string}>>(key,{});
    pending[book.id]={position,at}; await setSetting(key,pending);
  };
  await queueProgressWrite(write);
  if(cloud && navigator.onLine) await flushProgress();
}
export async function lastReadBook(cloud: boolean) { const uid=cloud?await userId():"local";return quickProgress(uid)?.bid || getSetting<string | null>(`last-read:${uid}`,null); }
export async function hasPendingProgress() { if(!supabase) return false; const uid=await userId(); return !!quickProgress(uid) || Object.keys(await getSetting(`progress-outbox:${uid}`,{})).length>0; }
export async function saveOriginal(book: Book, file: Blob, cloud: boolean) {
  if (!cloud) {
    await (await db).put("originals", file, book.id);
    return;
  }
  const uid = await userId();
  const { error } = await supabase!.storage
    .from("originals")
    .upload(`${uid}/${book.id}/original`, file.slice(0,file.size,"application/octet-stream"), {
      upsert: false,
      cacheControl: "0",
      contentType: "application/octet-stream",
    });
  if (error) throw error;
}
export async function getOriginal(
  book: Book,
  cloud: boolean,
): Promise<Blob | undefined> {
  if (!cloud) return (await db).get("originals", book.id);
  const uid = owners.get(book.id) || await userId();
  const { data, error } = await supabase!.storage
    .from("originals")
    .download(`${uid}/${book.id}/original`);
  if (error) throw error;
  return data;
}
export async function deleteBook(book: Book, cloud: boolean) {
  if (!cloud) {
    const tx = (await db).transaction(["books", "originals"], "readwrite");
    await tx.objectStore("books").delete(book.id);
    await tx.objectStore("originals").delete(book.id);
    await tx.done;
    if(quickProgress('local')?.bid===book.id)localStorage.removeItem('last-progress:local');
    progress.delete(book.id);return;
  }
  if (!canEditBook(book.id)) throw new Error("Bạn không phải chủ sách. Hãy dùng Rời nhóm nếu không muốn xem thư viện nhóm.");
  const uid = await userId();
  const { error: storageError } = await supabase!.storage
    .from("originals")
    .remove([`${uid}/${book.id}/original`]);
  if (storageError) throw storageError;
  const { error } = await supabase!.from("books").delete().eq("id", book.id);
  if (error) throw error;
}
export async function getCollection<T>(
  name: "vocabulary" | "children",
  cloud: boolean,
): Promise<T[]> {
  if (!cloud) return (await (await db).get("settings", name)) || [];
  const uid=await userId(),key=`collection:${uid}:${name}`;
  if(!navigator.onLine)return getSetting<T[]>(key,[]);
  const { data, error } = await supabase!.from(name).select("document");
  if (error) throw error;
  const values=data.map((r) => r.document as T);await setSetting(key,values);return values;
}
export async function saveCollection(
  name: "vocabulary" | "children",
  values: Word[] | Child[],
  cloud: boolean,
) {
  if (!cloud) {
    await (await db).put("settings", values, name);
    return;
  }
  const uid = await userId();
  // Upsert only: avoid non-atomic delete/reinsert which could lose data on connection failure.
  if (values.length) {
    const { error } = await supabase!
      .from(name)
      .upsert(values.map((v) => ({ id: v.id, owner_id: uid, document: v })));
    if (error) throw error;
  }
}
export async function deleteItem(
  name: "vocabulary" | "children",
  id: string,
  cloud: boolean,
) {
  if (cloud) {
    const { error } = await supabase!.from(name).delete().eq("id", id);
    if (error) throw error;
  } else {
    const values = await getCollection<{ id: string }>(name, false);
    await (
      await db
    ).put(
      "settings",
      values.filter((v) => v.id !== id),
      name,
    );
  }
}
export async function setSetting(key: string, value: unknown) {
  await (await db).put("settings", value, key);
}
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  return (await (await db).get("settings", key)) ?? fallback;
}

export async function pdfDraftPages(draftId: string): Promise<import("./pdf").PdfTextPage[]> {
  return (await db).getAll("pdfDrafts", IDBKeyRange.bound([draftId, 0], [draftId, Infinity]));
}
export async function savePdfDraftPage(draftId: string, page: import("./pdf").PdfTextPage) {
  await (await db).put("pdfDrafts", { ...page, draftId });
}
export async function clearPdfDraft(draftId: string) {
  await (await db).delete("pdfDrafts", IDBKeyRange.bound([draftId, 0], [draftId, Infinity]));
}

export async function migrateDeviceData(report:(done:number,total:number)=>void) {
  if(!navigator.onLine) throw new Error('Cần kết nối mạng để đưa dữ liệu lên cloud.');
  const uid=await userId(), local=await listBooks(false), remote=await listBooks(true);
  const localChildren=await getCollection<Child>('children',false), remoteChildren=await getCollection<Child>('children',true);
  const childMap=await getSetting<Record<string,string>>(`migration-children:${uid}`,{});
  for(const child of localChildren) if(!childMap[child.id]) childMap[child.id]=crypto.randomUUID();
  await setSetting(`migration-children:${uid}`,childMap);
  await saveCollection('children',[...remoteChildren,...localChildren.filter(c=>!remoteChildren.some(r=>r.id===childMap[c.id])).map(c=>({...c,id:childMap[c.id]}))],true);
  const ids:Record<string,string>={}, paragraphIds:Record<string,string>={};
  let done=0;
  for(const source of local) {
    let target=remote.find(b=>b.hash===source.hash&&b.language===source.language);
    const fresh=!target;
    target=target || {...source,id:crypto.randomUUID()};
    const book:Book={...target,shelf:source.shelf,approvedChildren:source.approvedChildren.map(id=>childMap[id]).filter(Boolean),chapters:target.chapters.map((c,ci)=>({...c,paragraphs:c.paragraphs.map((p,pi)=>{
      const from=source.chapters[ci]?.paragraphs[pi]; if(!from||from.text!==p.text)return p;
      paragraphIds[from.id]=p.id;return {...p,note:from.note,highlight:from.highlight,translations:from.translations};
    })}))};
    await saveBook(book,true);
    if(fresh) {
      try {const original=await getOriginal(source,false);if(original)await saveOriginal(book,original,true);}
      catch(error){await deleteBook(book,true).catch(()=>{});throw error;}
      remote.push(book);
    }
    ids[source.id]=book.id;
    const ci=Math.min(source.position.chapter,book.chapters.length-1), pi=Math.min(source.position.paragraph,book.chapters[ci].paragraphs.length-1);
    await saveProgress(book,{chapter:ci,paragraph:pi,offset:Math.min(source.position.offset||0,book.chapters[ci].paragraphs[pi].text.length-1)},true);
    report(++done,local.length);
  }
  const words=await getCollection<Word>('vocabulary',true);
  for(const word of await getCollection<Word>('vocabulary',false)) {
    const mapped={...word,id:crypto.randomUUID(),contexts:word.contexts.map(c=>({...c,bookId:ids[c.bookId]||c.bookId,paragraphId:paragraphIds[c.paragraphId]||c.paragraphId}))};
    const existing=words.find(w=>w.term===mapped.term&&w.language===mapped.language&&w.meaning===mapped.meaning);
    if(existing) existing.contexts=[...new Map([...existing.contexts,...mapped.contexts].map(c=>[`${c.bookId}:${c.paragraphId}:${c.sentence}`,c])).values()];else words.push(mapped);
  }
  await saveCollection('vocabulary',words,true);
  const last=await lastReadBook(false);const id=last&&ids[last] || ids[local.find(b=>b.position.chapter||b.position.paragraph||b.position.offset)?.id || ''];
  if(id) {const b=(await listBooks(true)).find(b=>b.id===id);if(b)await saveProgress(b,b.position,true);}
  return id || null;
}
