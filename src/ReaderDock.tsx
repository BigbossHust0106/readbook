import {createPortal} from 'react-dom';
import {searchBook} from './searchBook';
import {useState,useDeferredValue,useMemo} from 'react';
import {BookOpen,Library,GraduationCap} from 'lucide-react';
import type {Book,Word} from './model';
export function ReaderDock({book,books,words,chapter,onChapter,onBook,onGroups,onPosition,onClose}:{book:Book;books:Book[];words:Word[];chapter:number;onChapter:(i:number)=>void;onBook:(id:string)=>void;onGroups:()=>void;onPosition:(position:Book['position'])=>void;onClose:()=>void}) {
  const [panel,setPanel]=useState<'toc'|'library'|'words'>('toc'),[query,setQuery]=useState('');
  const deferred=useDeferredValue(query),[limit,setLimit]=useState(50);
  const results=useMemo(()=>panel==='toc'?searchBook(book,deferred,limit):{matches:[],more:false},[panel,book.chapters,deferred,limit]);
  const entries=[{id:'toc' as const,label:'Mục lục',icon:BookOpen},{id:'library' as const,label:'Thư viện',icon:Library},{id:'words' as const,label:'Từ vựng',icon:GraduationCap}];
  const host=document.getElementById('reader-sidebar-content');if(!host)return null;
  return createPortal(<section className="reader-sidebar-panel" aria-label="Công cụ đọc trong menu">
      <div className="row flyout-tabs">{entries.map(e=><button key={e.id} className={panel===e.id?'selected':''} onClick={()=>{setPanel(e.id);setQuery('');}}>{e.label}</button>)}</div>
      <label>{panel==='toc'?'Tìm chương hoặc toàn sách':'Tìm trong bảng'}<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(50);}} /></label>
      {panel==='toc'&&book.chapters.map((c,i)=>(!query||c.title.toLowerCase().includes(query.toLowerCase()))&&<button key={c.id} className={`flyout-item ${i===chapter?'selected':''}`} onClick={()=>{onChapter(i);onClose();}}>{c.title}</button>)}
      {panel==='toc'&&deferred.trim()&&<div className="book-search-results"><p>{results.matches.length} kết quả trong sách{results.more?' (còn nữa)':''}</p>{results.matches.map(m=><button className="flyout-item" key={`${m.chapter}:${m.paragraph}`} onClick={()=>{onPosition({chapter:m.chapter,paragraph:m.paragraph,offset:m.offset});onClose();}}><strong>{book.chapters[m.chapter].title} · đoạn {m.paragraph+1}{m.translated?' · Bản dịch':''}</strong><small>{m.snippet}</small></button>)}{results.more&&<button onClick={()=>setLimit(v=>v+50)}>Xem thêm kết quả</button>}</div>}
      {panel==='library'&&books.filter(b=>!query||`${b.title} ${b.author}`.toLowerCase().includes(query.toLowerCase())).map(b=><button className={`flyout-item ${b.id===book.id?'selected':''}`} key={b.id} onClick={()=>{onBook(b.id);onClose();}}><strong>{b.title}</strong><small>{b.author}</small></button>)}
      {panel==='words'&&<>{words.filter(w=>!query||`${w.term} ${w.meaning}`.toLowerCase().includes(query.toLowerCase())).map(w=><div className="flyout-word" key={w.id}><strong>{w.term}</strong><p>{w.meaning}</p></div>)}{!words.length&&<p>Bôi đen từ hoặc cụm từ trong sách rồi chọn Lưu từ.</p>}</>}
    </section>,host);
}
