import type {Book,ReadingBookmark} from './model';
export type SavedBookmark=ReadingBookmark&{paragraphId:string;position:Book['position'];excerpt:string;chapterTitle:string};
export function bookmarksOf(book:Book):SavedBookmark[]{
 return book.chapters.flatMap((c,ci)=>c.paragraphs.flatMap((p,pi)=>Object.values(p.bookmarks||{}).sort((a,b)=>a.offset-b.offset).map(mark=>({...mark,paragraphId:p.id,position:{chapter:ci,paragraph:pi,offset:mark.offset},excerpt:p.text.slice(mark.offset,mark.offset+130)||p.text.slice(-130),chapterTitle:c.title}))));
}
export function putBookmark(book:Book,position:Book['position'],label=''):Book{
 const paragraph=book.chapters[position.chapter]?.paragraphs[position.paragraph];
 if(!paragraph)throw new Error('Không tìm thấy vị trí đánh dấu.');
 const offset=Math.max(0,Math.min(paragraph.text.length,position.offset||0));
 const value={label:(label.trim()||`${book.chapters[position.chapter].title} · đoạn ${position.paragraph+1}`).slice(0,120),offset,createdAt:paragraph.bookmarks?.[String(offset)]?.createdAt||new Date().toISOString()};
 return {...book,chapters:book.chapters.map(c=>({...c,paragraphs:c.paragraphs.map(p=>p.id===paragraph.id?{...p,bookmarks:{...p.bookmarks,[String(offset)]:value}}:p)}))};
}
export function removeBookmark(book:Book,paragraphId:string,offset:number):Book{
 return {...book,chapters:book.chapters.map(c=>({...c,paragraphs:c.paragraphs.map(p=>{
  if(p.id!==paragraphId)return p;const bookmarks={...p.bookmarks};delete bookmarks[String(offset)];
  return {...p,bookmarks};
 })}))};
}
