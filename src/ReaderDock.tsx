import {useState} from 'react';
import {BookOpen,Library,GraduationCap,Cloud,Menu,X} from 'lucide-react';
import type {Book,Word} from './model';
export function ReaderDock({book,books,words,chapter,onChapter,onBook,onGroups}:{book:Book;books:Book[];words:Word[];chapter:number;onChapter:(i:number)=>void;onBook:(id:string)=>void;onGroups:()=>void}) {
  const [panel,setPanel]=useState<'toc'|'library'|'words'|null>(null),[query,setQuery]=useState('');
  const entries=[{id:'toc' as const,label:'Mục lục',icon:BookOpen},{id:'library' as const,label:'Thư viện',icon:Library},{id:'words' as const,label:'Từ vựng',icon:GraduationCap}];
  return <div className="reader-dock" onMouseLeave={()=>{if(matchMedia('(hover:hover)').matches)setPanel(null);}} onKeyDown={e=>{if(e.key==='Escape')setPanel(null);}}>
    <button className="reader-mobile-menu" aria-label="Mở bảng công cụ đọc" onClick={()=>setPanel(panel?null:'toc')}><Menu /></button>
    <nav aria-label="Thanh công cụ bên trái">{entries.map(e=><button key={e.id} title={e.label} aria-label={`Mở ${e.label}`} aria-expanded={panel===e.id} onMouseEnter={()=>{if(matchMedia('(hover:hover)').matches){setPanel(e.id);setQuery('');}}} onFocus={()=>setPanel(e.id)} onClick={()=>{setPanel(e.id);setQuery('');}}><e.icon /></button>)}<button aria-label="Mở nhóm đọc và cloud" title="Nhóm & cloud" onClick={onGroups}><Cloud /></button></nav>
    {panel&&<section className="reader-flyout" aria-label={entries.find(e=>e.id===panel)!.label}>
      <header><h2>{entries.find(e=>e.id===panel)!.label}</h2><button aria-label="Đóng bảng công cụ đọc" onClick={()=>setPanel(null)}><X size={18}/></button></header>
      <div className="row flyout-tabs">{entries.map(e=><button key={e.id} className={panel===e.id?'selected':''} onClick={()=>{setPanel(e.id);setQuery('');}}>{e.label}</button>)}</div>
      <label>Tìm trong bảng<input value={query} onChange={e=>setQuery(e.target.value)} /></label>
      {panel==='toc'&&book.chapters.map((c,i)=>(!query||c.title.toLowerCase().includes(query.toLowerCase()))&&<button key={c.id} className={`flyout-item ${i===chapter?'selected':''}`} onClick={()=>{onChapter(i);setPanel(null);}}>{c.title}</button>)}
      {panel==='library'&&books.filter(b=>!query||`${b.title} ${b.author}`.toLowerCase().includes(query.toLowerCase())).map(b=><button className={`flyout-item ${b.id===book.id?'selected':''}`} key={b.id} onClick={()=>{onBook(b.id);setPanel(null);}}><strong>{b.title}</strong><small>{b.author}</small></button>)}
      {panel==='words'&&<>{words.filter(w=>!query||`${w.term} ${w.meaning}`.toLowerCase().includes(query.toLowerCase())).map(w=><div className="flyout-word" key={w.id}><strong>{w.term}</strong><p>{w.meaning}</p></div>)}{!words.length&&<p>Rê chuột hoặc chạm vào chữ trong sách rồi chọn Lưu từ.</p>}</>}
    </section>}
  </div>;
}
