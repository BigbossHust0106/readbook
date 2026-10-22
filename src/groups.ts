import * as store from './store';
import type { Book } from './model';
export type ReadingGroup = { id:string; name:string; owner_id:string; bookIds:string[]; members:{user_id:string;nickname:string}[] };
export type GroupProgress = { user_id:string; nickname:string; position:Book['position']; updated_at:string|null };
export async function rpc<T>(name:string, args:Record<string,unknown>={}):Promise<T> {
  if(!store.supabase) throw new Error('Chưa cấu hình Supabase.');
  const auth=await store.session();
  const {data,error}=await store.supabase.rpc(name,args).setHeader("Authorization",`Bearer ${auth.access_token}`); if(error) throw error; return data as T;
}
export async function listGroups():Promise<ReadingGroup[]> {
  const [g,b,m]=await Promise.all([store.supabase!.from('reading_groups').select('id,name,owner_id').order('created_at'),store.supabase!.from('group_books').select('group_id,book_id'),store.supabase!.from('group_members').select('group_id,user_id,nickname')]);
  if(g.error||b.error||m.error) throw g.error||b.error||m.error;
  return g.data!.map(group=>({...group,bookIds:b.data!.filter(x=>x.group_id===group.id).map(x=>x.book_id),members:m.data!.filter(x=>x.group_id===group.id)}));
}
export async function importGroupBook(gid:string,book:Book,file:Blob) {
  const existing=await rpc<string|null>('find_group_book',{gid,book_hash:book.hash,book_language:book.language});
  if(existing) return existing;
  const books=await store.listBooks(true), own=books.find(b=>b.hash===book.hash&&b.language===book.language&&store.canEditBook(b.id));
  if(own) return rpc<string>('add_group_book',{gid,bid:own.id});
  await store.saveBook(book,true);
  try {
    await store.saveOriginal(book,file,true);
    const canonical=await rpc<string>('add_group_book',{gid,bid:book.id});
    if(canonical!==book.id) await store.deleteBook(book,true);
    return canonical;
  } catch(error) { await store.deleteBook(book,true).catch(()=>{}); throw error; }
}
export type GroupBookRating={book_id:string;average_rating:number|null;rating_count:number;my_rating:number|null};
export type GroupComment={id:string;author_id:string;nickname:string;body:string;created_at:string;updated_at:string};
export type GroupDiscussion={comments:GroupComment[];has_more:boolean;average_rating:number|null;rating_count:number;my_rating:number|null};
