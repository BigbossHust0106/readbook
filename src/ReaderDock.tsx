import {createPortal} from 'react-dom';
import {searchBook} from './searchBook';
import {useState,useDeferredValue,useMemo} from 'react';
import {BookOpen,Library,GraduationCap,Bookmark} from 'lucide-react';
import {bookmarksOf} from './bookmarks';
import type {Book,Word} from './model';
export function ReaderDock({book,books,words,chapter,onChapter,onBook,onGroups,onPosition,onClose,onBookmark,onRemoveBookmark}:{book:Book;books:Book[];words:Word[];chapter:number;onChapter:(i:number)=>void;onBook:(id:string)=>void;onGroups:()=>void;onPosition:(position:Book['position'])=>void;onClose:()=>void;onBookmark:(position:Book['position'],label:string)=>Promise<void>;onRemoveBookmark:(paragraphId:string,offset:number)=>Promise<void>}) {
  const [panel,setPanel]=useState<'toc'|'library'|'words'|'bookmarks'>('toc'),[query,setQuery]=useState('');
  const [label,setLabel]=useState(''),[editing,setEditing]=useState<{position:Book['position'];label:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const marks=useMemo(()=>bookmarksOf(book),[book.chapters]);
  async function saveBookmark(position:Book['position'],name:string){setBusy(true);setError('');try{await onBookmark(position,name);setLabel('');setEditing(null);}catch(e){setError(e instanceof Error?e.message:'Chưa lưu được dấu trang.');}finally{setBusy(false);}}
  const deferred=useDeferredValue(query),[limit,setLimit]=useState(50);
  const results=useMemo(()=>panel==='toc'?searchBook(book,deferred,limit):{matches:[],more:false},[panel,book.chapters,deferred,limit]);
  const entries=[{id:'toc' as const,label:'Mục lục',icon:BookOpen},{id:'library' as const,label:'Thư viện',icon:Library},{id:'words' as const,label:'Từ vựng',icon:GraduationCap},{id:'bookmarks' as const,label:'Dấu trang',icon:Bookmark}];
  const host=document.getElementById('reader-sidebar-content');if(!host)return null;
  return createPortal(<section className="reader-sidebar-panel" aria-label="Công cụ đọc trong menu">
      <div className="row flyout-tabs">{entries.map(e=><button key={e.id} className={panel===e.id?'selected':''} onClick={()=>{setPanel(e.id);setQuery('');}}>{e.label}</button>)}</div>
      <label>{panel==='toc'?'Tìm chương hoặc toàn sách':'Tìm trong bảng'}<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(50);}} /></label>
      {panel==='bookmarks'&&<section aria-label="Dấu trang của bạn">
        <label>Tên dấu trang mới<input maxLength={120} value={label} disabled={busy} onChange={e=>setLabel(e.target.value)} placeholder="Để trống để dùng tên chương"/></label>
        <button disabled={busy} onClick={()=>void saveBookmark(book.position,label)}>Lưu trang đang đọc</button>
        {editing&&<div><label>Sửa tên dấu trang<input maxLength={120} value={editing.label} disabled={busy} onChange={e=>setEditing({...editing,label:e.target.value})}/></label><div className="row"><button disabled={busy||!editing.label.trim()} onClick={()=>void saveBookmark(editing.position,editing.label)}>Lưu tên dấu trang</button><button disabled={busy} onClick={()=>setEditing(null)}>Hủy đổi tên</button></div></div>}
        {!marks.length&&<p>Chưa có dấu trang. Lưu nhiều vị trí để quay lại; vị trí đọc tiếp vẫn được ghi tự động.</p>}
        {marks.filter(m=>!query||`${m.label} ${m.excerpt} ${m.chapterTitle}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((m,i)=><div className="saved-bookmark" key={`${m.paragraphId}:${m.offset}`}>
          <button className="flyout-item" onClick={()=>{onPosition(m.position);onClose();}}><strong>{m.label}</strong><small>{m.chapterTitle} · đoạn {m.position.paragraph+1}</small><small>{m.excerpt}</small></button>
          <div className="row"><button aria-label={`Sửa tên dấu trang ${i+1}`} disabled={busy} onClick={()=>setEditing({position:m.position,label:m.label})}>Đổi tên</button><button aria-label={`Xóa dấu trang ${i+1}`} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onRemoveBookmark(m.paragraphId,m.offset);setEditing(null);}catch(e){setError(e instanceof Error?e.message:'Chưa xóa được dấu trang.');}finally{setBusy(false);}}}>Xóa dấu trang</button></div>
        </div>)}
        {error&&<p role="alert" className="error">{error}</p>}
      </section>}
      {panel==='toc'&&book.chapters.map((c,i)=>(!query||c.title.toLowerCase().includes(query.toLowerCase()))&&<button key={c.id} className={`flyout-item ${i===chapter?'selected':''}`} onClick={()=>{onChapter(i);onClose();}}>{c.title}</button>)}
      {panel==='toc'&&deferred.trim()&&<div className="book-search-results"><p>{results.matches.length} kết quả trong sách{results.more?' (còn nữa)':''}</p>{results.matches.map(m=><button className="flyout-item" key={`${m.chapter}:${m.paragraph}`} onClick={()=>{onPosition({chapter:m.chapter,paragraph:m.paragraph,offset:m.offset});onClose();}}><strong>{book.chapters[m.chapter].title} · đoạn {m.paragraph+1}{m.translated?' · Bản dịch':''}</strong><small>{m.snippet}</small></button>)}{results.more&&<button onClick={()=>setLimit(v=>v+50)}>Xem thêm kết quả</button>}</div>}
      {panel==='library'&&books.filter(b=>!query||`${b.title} ${b.author}`.toLowerCase().includes(query.toLowerCase())).map(b=><button className={`flyout-item ${b.id===book.id?'selected':''}`} key={b.id} onClick={()=>{onBook(b.id);onClose();}}><strong>{b.title}</strong><small>{b.author}</small></button>)}
      {panel==='words'&&<>{words.filter(w=>!query||`${w.term} ${w.meaning}`.toLowerCase().includes(query.toLowerCase())).map(w=><div className="flyout-word" key={w.id}><strong>{w.term}</strong><p>{w.meaning}</p></div>)}{!words.length&&<p>Bôi đen từ hoặc cụm từ trong sách rồi chọn Lưu từ.</p>}</>}
    </section>,host);
}
