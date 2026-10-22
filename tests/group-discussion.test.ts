import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {beforeAll,afterAll,expect,it} from 'vitest';
let db:PGlite,gid:string,otherGroup:string;
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',c='10000000-0000-4000-8000-000000000003',bid='20000000-0000-4000-8000-000000000001',comment='40000000-0000-4000-8000-000000000001';
async function as(uid:string){await db.exec(`reset role;set request.jwt.claim.sub='${uid}';set role authenticated;`);}
async function call(name:string,args:unknown[]){return (await db.query<any>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}'),('${c}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
 for(const name of ['202610190001_initial','202610210003_groups_and_progress','202610220005_group_discussion'])await db.exec(await readFile(`supabase/migrations/${name}.sql`,'utf8'));
 await as(a);await db.query('insert into public.books(id,title,language,content_hash,document) values($1,$2,$3,$4,$5)',[bid,'Shared','vi','unique',{id:bid,language:'vi',chapters:[]}]);
 gid=await call('create_reading_group',['Nhóm đọc','An']);otherGroup=await call('create_reading_group',['Nhóm khác','An']);await call('add_group_book',[gid,bid]);await call('add_group_book',[otherGroup,bid]);const invite=await call('create_reading_invite',[gid]);await as(b);await call('join_reading_group',[invite,'Bình']);
},30000);
afterAll(async()=>{await db?.close();});
it('saves Unicode/plain text idempotently; only the actual author can edit',async()=>{
 await as(b);const body='Cảm nghĩ 📖 中文 <script>alert(1)</script>';await call('save_group_book_comment',[gid,bid,comment,body]);await call('save_group_book_comment',[gid,bid,comment,body]);let data=await call('group_book_discussion',[gid,bid]);expect(data.comments).toHaveLength(1);expect(data.comments[0]).toMatchObject({body,nickname:'Bình',author_id:b});
 await as(a);await expect(call('save_group_book_comment',[gid,bid,comment,'Sửa của người khác'])).rejects.toThrow('chỉ có thể sửa');
 await as(b);await call('save_group_book_comment',[gid,bid,comment,'Đã đọc lại.']);data=await call('group_book_discussion',[gid,bid]);expect(data.comments[0].body).toBe('Đã đọc lại.');await expect(call('save_group_book_comment',[gid,bid,comment,' '.repeat(4)])).rejects.toThrow();await expect(call('save_group_book_comment',[gid,bid,comment,'a'.repeat(2001)])).rejects.toThrow();
});
it('counts one vote per account, updates it, removes it and validates 1–5 on the server',async()=>{
 await as(a);await call('rate_group_book',[gid,bid,3]);await as(b);await call('rate_group_book',[gid,bid,5]);let data=await call('group_book_discussion',[gid,bid]);expect(data).toMatchObject({average_rating:4,rating_count:2,my_rating:5});await call('rate_group_book',[gid,bid,1]);data=await call('group_book_discussion',[gid,bid]);expect(data).toMatchObject({average_rating:2,rating_count:2,my_rating:1});await call('rate_group_book',[gid,bid,null]);data=await call('group_book_discussion',[gid,bid]);expect(data).toMatchObject({average_rating:3,rating_count:1,my_rating:null});await expect(call('rate_group_book',[gid,bid,6])).rejects.toThrow();await expect(call('rate_group_book',[gid,bid,0])).rejects.toThrow();
 const summary=(await db.query<any>('select * from public.reading_group_book_ratings($1)',[gid])).rows;expect(summary[0]).toMatchObject({book_id:bid,average_rating:'3.0',rating_count:1,my_rating:null});
});
it('rejects outsiders, anonymous callers, cross-group edits and direct forged writes',async()=>{
 await as(c);expect((await db.query('select * from public.group_book_comments')).rows).toHaveLength(0);expect((await db.query('select * from public.group_book_ratings')).rows).toHaveLength(0);
 for(const [name,args] of [['group_book_discussion',[gid,bid]],['reading_group_book_ratings',[gid]],['rate_group_book',[gid,bid,5]],['save_group_book_comment',[gid,bid,comment,'Attack']],['delete_group_book_comment',[gid,bid,comment]]] as const)await expect(call(name,[...args])).rejects.toThrow();
 await as(b);await expect(call('group_book_discussion',[otherGroup,bid])).rejects.toThrow();await expect(call('save_group_book_comment',[otherGroup,bid,comment,'Move'])).rejects.toThrow();
 await expect(db.query('insert into public.group_book_ratings(group_id,book_id,user_id,score)values($1,$2,$3,5)',[gid,bid,a])).rejects.toThrow();await expect(db.query('update public.group_book_comments set author_id=$1 where id=$2',[b,comment])).rejects.toThrow();
 await db.exec('reset role;set role anon');await expect(call('group_book_discussion',[gid,bid])).rejects.toThrow();
});
it('paginates equal timestamps deterministically without exposing another group discussion',async()=>{
 await db.exec('reset role');for(let i=10;i<45;i++)await db.query('insert into public.group_book_comments(id,group_id,book_id,author_id,body,created_at)values($1,$2,$3,$4,$5,$6)',[`40000000-0000-4000-8000-${String(i).padStart(12,'0')}`,gid,bid,a,`Đoạn ${i}`,'2026-10-22T00:00:00Z']);
 await as(a);await call('save_group_book_comment',[otherGroup,bid,'40000000-0000-4000-8000-000000000099','PRIVATE OTHER GROUP']);const first=await call('group_book_discussion',[gid,bid]);expect(first.comments).toHaveLength(30);expect(first.has_more).toBe(true);const last=first.comments.at(-1),next=await call('group_book_discussion',[gid,bid,last.created_at,last.id]);expect(next.comments).toHaveLength(6);expect(next.has_more).toBe(false);expect(new Set([...first.comments,...next.comments].map((r:any)=>r.id)).size).toBe(36);expect(JSON.stringify([...first.comments,...next.comments])).not.toContain('PRIVATE OTHER GROUP');await expect(call('group_book_discussion',[gid,bid,last.created_at,null])).rejects.toThrow();
});
it('only author or group owner can delete comments; removed members lose all discussion access',async()=>{
 await as(a);const ownerComment='40000000-0000-4000-8000-000000000088';await call('save_group_book_comment',[gid,bid,ownerComment,'Của chủ nhóm']);await as(b);await expect(call('delete_group_book_comment',[gid,bid,ownerComment])).rejects.toThrow();await call('delete_group_book_comment',[gid,bid,comment]);await as(a);await call('delete_group_book_comment',[gid,bid,ownerComment]);await call('remove_reading_member',[gid,b]);await as(b);expect((await db.query('select * from public.group_book_comments where group_id=$1',[gid])).rows).toHaveLength(0);await expect(call('group_book_discussion',[gid,bid])).rejects.toThrow();await expect(call('rate_group_book',[gid,bid,5])).rejects.toThrow();
});
it('removing a shared book cascades comments and ratings only in that group',async()=>{
 await as(a);await call('rate_group_book',[otherGroup,bid,5]);await call('remove_group_book',[otherGroup,bid]);await expect(call('group_book_discussion',[otherGroup,bid])).rejects.toThrow();expect((await db.query('select * from public.group_book_comments where group_id=$1',[otherGroup])).rows).toHaveLength(0);expect((await db.query('select * from public.group_book_ratings where group_id=$1',[otherGroup])).rows).toHaveLength(0);expect((await db.query('select * from public.group_book_comments where group_id=$1',[gid])).rows.length).toBeGreaterThan(0);
});
