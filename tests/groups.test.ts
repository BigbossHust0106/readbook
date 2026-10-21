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
 await as(a);gid=await call('create_reading_group',['Nhóm thử','An']);invite=await call('create_reading_invite',[gid]);
},30000);
afterAll(async()=>{await db?.close();});
it('preserves owner private fields and sanitizes shared book text in the same migration',async()=>{
 await as(a);const raw=(await db.query<any>('select document from public.books where id=$1',[bid])).rows[0].document;
 expect(raw.position.offset).toBeUndefined();expect(raw.approvedChildren).toEqual([]);expect(raw.chapters[0].paragraphs[0].note).toBeUndefined();
 const state=(await db.query<any>('select * from public.reading_states where book_id=$1',[bid])).rows[0];expect(state.overrides.p.note).toBe('private note');expect(state.position.offset).toBe(12);
});
it('joins only with valid invite, shares one book record and denies outsiders or permission escalation',async()=>{
 await as(a);expect(await call('add_group_book',[gid,bid])).toBe(bid);
 await db.query('insert into storage.objects(bucket_id,name)values($1,$2)',['originals',`${a}/${bid}/original`]);
 await as(b);expect((await db.query('select * from public.books')).rows).toHaveLength(0);
 await expect(call('join_reading_group',['00000000-0000-4000-8000-000000000000','Bình'])).rejects.toThrow();
 await call('join_reading_group',[invite,'Bình']);expect((await db.query('select * from public.books')).rows).toHaveLength(1);expect((await db.query('select * from storage.objects')).rows).toHaveLength(1);
 await expect(call('add_group_book',[gid,bid])).rejects.toThrow('Only upload your own book');
 expect((await db.query('select * from public.reading_states')).rows).toHaveLength(0);
 expect((await db.query('update public.books set title=$1 where id=$2 returning id',['Attack',bid])).rows).toHaveLength(0);
 await expect(db.query('insert into public.group_members(group_id,user_id,nickname)values($1,$2,$3)',[gid,c,'Outsider'])).rejects.toThrow();
 await expect(call('create_reading_invite',[gid])).rejects.toThrow();
 await as(c);expect((await db.query('select * from storage.objects')).rows).toHaveLength(0);await expect(call('reading_group_progress',[gid,bid])).rejects.toThrow();
});
it('deduplicates the group by content hash, with independent progress and no private annotation exposure',async()=>{
 await as(b);await db.query('insert into public.books(id,title,language,content_hash,document)values($1,$2,$3,$4,$5)',[bid2,'Duplicate','vi','hash',{id:bid2,language:'vi',chapters:[]}]);
 expect(await call('add_group_book',[gid,bid2])).toBe(bid);expect((await db.query('select * from public.group_books')).rows).toHaveLength(1);
 await call('save_reading_position',[bid,JSON.stringify({chapter:0,paragraph:0,offset:5}),'2026-10-21T00:00:00Z']);
 await as(a);const states=(await db.query<any>('select * from public.reading_states where book_id=$1',[bid])).rows;expect(states[0].position.offset).toBe(12);
 const tags=(await db.query<any>('select * from public.reading_group_progress($1,$2)',[gid,bid])).rows;expect(tags).toHaveLength(2);expect(tags[0].overrides).toBeUndefined();
});
it('does not overwrite a newer position with a delayed offline update; revoked members lose book/storage access',async()=>{
 await as(b);await call('save_reading_position',[bid,JSON.stringify({chapter:0,paragraph:0,offset:8}),'2026-10-21T00:00:10Z']);
 await call('save_reading_position',[bid,JSON.stringify({chapter:0,paragraph:0,offset:2}),'2026-10-21T00:00:01Z']);
 expect((await db.query<any>('select "position" from public.reading_states where book_id=$1',[bid])).rows[0].position.offset).toBe(8);
 await as(a);await call('remove_reading_member',[gid,b]);
 await as(b);expect((await db.query('select * from public.books where id=$1',[bid])).rows).toHaveLength(0);expect((await db.query('select * from storage.objects')).rows).toHaveLength(0);
 await expect(call('save_reading_position',[bid,'{"chapter":0,"paragraph":0}'])).rejects.toThrow();
});
