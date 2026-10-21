import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {beforeAll,afterAll,expect,it} from 'vitest';
let db:PGlite;
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',c='10000000-0000-4000-8000-000000000003',bid='20000000-0000-4000-8000-000000000001',bid2='20000000-0000-4000-8000-000000000002';
let gid:string,invite:string;
async function as(uid:string){await db.exec(`reset role;set request.jwt.claim.sub='${uid}';set role authenticated;`);}
async function call(name:string,args:string[]){return (await db.query<any>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}'),('${c}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,public to authenticated;grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(await readFile('supabase/migrations/202610190001_initial.sql','utf8'));
 await as(a);
 const doc={id:bid,language:'vi',position:{chapter:0,paragraph:0,offset:12},shelf:'favorite',approvedChildren:['private-child'],chapters:[{id:'ch',title:'Nội dung',paragraphs:[{id:'p',text:'Một sách chung.',translations:{en:{text:'A shared book.'}},note:'private note',highlight:true}]}]};
 await db.query('insert into public.books(id,title,language,content_hash,document)values($1,$2,$3,$4,$5)',[bid,'Shared','vi','hash',doc]);
 await db.exec('reset role');await db.exec(await readFile('supabase/migrations/202610210003_groups_and_progress.sql','utf8'));
 await db.exec('reset role');await db.exec(await readFile('supabase/migrations/202610210004_offline_sync.sql','utf8'));await as(a);
},30000);
afterAll(async()=>{await db?.close();});

it('uses compare-and-swap for annotations, retries idempotently and never changes progress',async()=>{
 await as(a);
 const before=(await db.query<any>('select shelf,overrides,approved_children from public.reading_states where book_id=$1',[bid])).rows[0];
 const next={...before,overrides:{p:{note:'device one'}}};
 expect(await call('sync_personal_book_state',[bid,JSON.stringify(before),JSON.stringify(next)])).toEqual({applied:true,document:next});
 const conflict=await call('sync_personal_book_state',[bid,JSON.stringify(before),JSON.stringify({...before,overrides:{p:{note:'device two'}}})]);
 expect(conflict.applied).toBe(false);expect(conflict.document).toEqual(next);
 expect((await call('sync_personal_book_state',[bid,JSON.stringify(before),JSON.stringify(next)])).applied).toBe(true);
 expect((await db.query<any>('select "position" from public.reading_states where book_id=$1',[bid])).rows[0].position.offset).toBe(12);
});
it('creates/edits/deletes collection items without resurrecting a remote deletion from a stale base',async()=>{
 const id='30000000-0000-4000-8000-000000000001',word={id,term:'read',meaning:'đọc'};
 expect((await call('sync_collection_document',['vocabulary',id,null as any,JSON.stringify(word)])).applied).toBe(true);
 expect((await call('sync_collection_document',['vocabulary',id,JSON.stringify(word),null as any])).applied).toBe(true);
 const stale=await call('sync_collection_document',['vocabulary',id,JSON.stringify(word),JSON.stringify({...word,meaning:'xem'})]);
 expect(stale).toEqual({applied:false,document:null});
 expect((await db.query('select * from public.vocabulary')).rows).toHaveLength(0);
});
it('blocks other accounts and invalid entity/table ownership changes',async()=>{
 await as(b);await expect(call('sync_personal_book_state',[bid,'{}','{}'])).rejects.toThrow();
 await expect(call('sync_collection_document',['books',bid,'null','{}'])).rejects.toThrow();
 await expect(call('sync_collection_document',['children',bid,'null','{"id":"wrong"}'])).rejects.toThrow();
 const id='30000000-0000-4000-8000-000000000002',doc={id,nickname:'Private'};
 await as(a);await call('sync_collection_document',['children',id,'null',JSON.stringify(doc)]);
 await as(b);await expect(call('sync_collection_document',['children',id,'null',JSON.stringify(doc)])).rejects.toThrow();
 expect((await db.query('select * from public.children')).rows).toHaveLength(0);
});
