import {createPortal} from 'react-dom';
import {useState,useMemo,useDeferredValue} from 'react';
import {bookmarksOf} from './bookmarks';
import {searchBook} from './searchBook';
import type {Book} from './model';
export function ReaderDock({book,chapter,onChapter,onClose}:{book:Book;chapter:number;onChapter:(i:number)=>void;onClose:()=>void}){
 const host=document.getElementById('reader-sidebar-content');if(!host)return null;
 return createPortal(<section className="reader-sidebar-panel" aria-label={`Mục lục · ${book.title}`}><header><strong>Mục lục</strong><small>{book.title}</small></header><div className="chapter-scroll" aria-label="Danh sách chương" tabIndex={0}>{book.chapters.map((c,i)=><button key={c.id} className={`flyout-item ${i===chapter?'selected':''}`} aria-current={i===chapter?'true':undefined} onClick={()=>{onChapter(i);onClose();}}>{c.title}</button>)}</div></section>,host);
}
export function BookmarksPanel({book,onPosition,onBookmark,onRemoveBookmark}:{book:Book;onPosition:(position:Book['position'])=>void;onBookmark:(position:Book['position'],label:string)=>Promise<void>;onRemoveBookmark:(paragraphId:string,offset:number)=>Promise<void>}){
 const [label,setLabel]=useState(''),[editing,setEditing]=useState<{position:Book['position'];label:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const marks=useMemo(()=>bookmarksOf(book),[book.chapters]);
 async function save(position:Book['position'],label:string){setBusy(true);setError('');try{await onBookmark(position,label);setLabel('');setEditing(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section aria-label="Dấu trang của bạn"><label>Tên dấu trang mới<input maxLength={120} value={label} disabled={busy} onChange={e=>setLabel(e.target.value)}/></label><button disabled={busy} onClick={()=>void save(book.position,label)}>Lưu trang đang đọc</button>
 {editing&&<div><label>Sửa tên dấu trang<input maxLength={120} value={editing.label} disabled={busy} onChange={e=>setEditing({...editing,label:e.target.value})}/></label><button disabled={busy||!editing.label.trim()} onClick={()=>void save(editing.position,editing.label)}>Lưu tên dấu trang</button></div>}
 {!marks.length&&<p>Chưa có dấu trang. Bôi đen văn bản rồi chọn Lưu dấu trang.</p>}
 {marks.map((m,i)=><div className="saved-bookmark" key={`${m.paragraphId}:${m.offset}`}><button className="flyout-item" onClick={()=>onPosition(m.position)}><strong>{m.label}</strong><small>{m.chapterTitle} · đoạn {m.position.paragraph+1}</small><small>{m.excerpt}</small></button><div className="row"><button aria-label={`Sửa tên dấu trang ${i+1}`} disabled={busy} onClick={()=>setEditing({position:m.position,label:m.label})}>Đổi tên</button><button aria-label={`Xóa dấu trang ${i+1}`} disabled={busy} onClick={async()=>{setBusy(true);try{await onRemoveBookmark(m.paragraphId,m.offset);setEditing(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Xóa dấu trang</button></div></div>)}{error&&<p role="alert">{error}</p>}</section>;
}
export function BookSearchPanel({book,onPosition}:{book:Book;onPosition:(position:Book['position'])=>void}){
 const [query,setQuery]=useState(''),[limit,setLimit]=useState(50),deferred=useDeferredValue(query);
 const results=useMemo(()=>searchBook(book,deferred,limit),[book.chapters,deferred,limit]);
 return <section><label>Tìm trong toàn sách<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(50);}}/></label>{deferred.trim()&&<div className="book-search-results"><p>{results.matches.length} kết quả trong sách{results.more?' (còn nữa)':''}</p>{results.matches.map(m=><button className="flyout-item" key={`${m.chapter}:${m.paragraph}`} onClick={()=>onPosition({chapter:m.chapter,paragraph:m.paragraph,offset:m.offset})}><strong>{book.chapters[m.chapter].title} · đoạn {m.paragraph+1}</strong><small>{m.snippet}</small></button>)}{results.more&&<button onClick={()=>setLimit(v=>v+50)}>Xem thêm kết quả</button>}</div>}</section>;
}
