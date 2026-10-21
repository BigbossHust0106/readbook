import {useMemo,useState} from 'react';
import {Modal} from './Modal';
import {importDocument} from './importer';
import {languages,type Book,type Lang} from './model';
import {alignTranslations,translationSources,type TranslationPlan} from './translationImport';

export function TranslationImport({book,chapter,target,onSave,onClose}:{book:Book;chapter:number;target:Lang;onSave:(target:Lang,plan:TranslationPlan,replace:boolean,locked:boolean)=>Promise<void>;onClose:()=>void}){
 const [language,setLanguage]=useState(target),[scope,setScope]=useState(String(chapter));
 const [text,setText]=useState(''),[file,setFile]=useState<File|null>(null),[parts,setParts]=useState<string[]>([]),[plan,setPlan]=useState<TranslationPlan|null>(null);
 const [sourceIndex,setSourceIndex]=useState(0),[translationIndex,setTranslationIndex]=useState(0);
 const [replace,setReplace]=useState(false),[locked,setLocked]=useState(true),[ignoreUnused,setIgnoreUnused]=useState(false),[reviewed,setReviewed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const sources=useMemo(()=>translationSources(book,scope==='all'?undefined:Number(scope)),[book.chapters,scope]);
 const source=sources[Math.min(sourceIndex,sources.length-1)],draft=plan?.[source?.id];
 const used=new Set(Object.values(plan||{}).filter(p=>p.text.trim()).flatMap(p=>p.from));
 const unused=parts.map((_,i)=>i).filter(i=>!used.has(i));
 const stats=sources.reduce((out,p)=>{const candidate=plan?.[p.id]?.text.trim(),prior=book.chapters[p.chapter].paragraphs[p.paragraph].translations[language];if(candidate){if(prior?.locked)out.locked++;else if(prior?.text&&!replace)out.existing++;else out.save++;}return out;},{save:0,locked:0,existing:0});
 const reset=()=>{setPlan(null);setParts([]);setReviewed(false);setIgnoreUnused(false);setError('');};
 const change=(id:string,value:{text:string;from:number[]})=>{setPlan(p=>({...p,[id]:value}));setReviewed(false);setIgnoreUnused(false);};
 async function preview(){
  setBusy(true);setError('');
  try{
   if(language===book.language)throw new Error('Chọn ngôn ngữ bản dịch khác nguyên văn.');
   const translated=await importDocument(file,text,{title:'Bản dịch nhập sẵn',author:'',language,genre:''});
   const texts=translated.chapters.flatMap(c=>c.paragraphs.map(p=>p.text));
   setParts(texts);setPlan(alignTranslations(sources.map(p=>p.id),texts));setSourceIndex(0);setTranslationIndex(0);setReviewed(false);setIgnoreUnused(false);
  }catch(e){setError(e instanceof Error?e.message:'Không đọc được bản dịch.');}finally{setBusy(false);}
 }
 return <Modal title="Nhập và căn bản dịch" onClose={()=>{if(!busy)onClose();}}>
  <p>Nhập bản dịch bạn có sẵn, đối chiếu với nguyên văn rồi lưu. Không gọi dịch máy. Bản dịch được lưu riêng trong tài khoản của bạn khi dùng cloud.</p>
  <div className="row">
   <label>Ngôn ngữ bản dịch<select disabled={busy||!!plan} value={language} onChange={e=>setLanguage(e.target.value as Lang)}>{Object.entries(languages).filter(([key])=>key!==book.language).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label>Phạm vi căn bản dịch<select disabled={busy||!!plan} value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Toàn sách</option>{book.chapters.map((c,i)=><option key={c.id} value={String(i)}>{c.title}</option>)}</select></label>
  </div>
  {!plan?<>
   <label>Chọn tệp bản dịch<input disabled={busy} type="file" accept=".txt,.epub,.docx,.html,.htm" onChange={e=>{setFile(e.target.files?.[0]||null);setError('');}}/></label>
   <p className="muted">TXT, EPUB, DOCX hoặc HTML, tối đa 50 MB. Nội dung tệp được ưu tiên nếu đã chọn.</p>
   {file&&<button disabled={busy} onClick={()=>setFile(null)}>Bỏ tệp đã chọn</button>}
   <label>Nội dung bản dịch<textarea disabled={busy} rows={7} value={text} onChange={e=>setText(e.target.value)} placeholder="Dán bản dịch, cách các đoạn bằng một dòng trống…"/></label>
   <button className="primary" disabled={busy||(!file&&!text.trim())} onClick={()=>void preview()}>{busy?'Đang đọc bản dịch…':'Đối chiếu bản dịch'}</button>
  </>:<>
   <p role="status">{sources.length} đoạn nguyên văn · {parts.length} đoạn dịch · {unused.length} đoạn dịch chưa ghép.</p>
   <p className="notice">Ghép ban đầu theo thứ tự đoạn, không phải căn chỉnh tự động theo nghĩa. Kiểm tra tên chương và nội dung, nhất là khi hai bản chia đoạn khác nhau.</p>
   <div className="alignment-pair">
    <section><label>Đoạn nguyên văn<input type="number" min={1} max={sources.length} value={sourceIndex+1} disabled={busy} onChange={e=>setSourceIndex(Math.max(0,Math.min(sources.length-1,Number(e.target.value)-1)))}/></label><small>{source.chapterTitle} · đoạn {source.paragraph+1}</small><p className="alignment-source">{source.text}</p></section>
    <section><label>Bản dịch đang ghép<textarea aria-label="Bản dịch đang ghép" rows={7} disabled={busy} value={draft?.text||''} onChange={e=>change(source.id,{text:e.target.value,from:draft?.from||[]})}/></label>{book.chapters[source.chapter].paragraphs[source.paragraph].translations[language]?.locked&&<p className="notice">Đoạn này đã khóa và sẽ được giữ nguyên.</p>}</section>
   </div>
   <div className="row"><button disabled={busy||sourceIndex===0} onClick={()=>setSourceIndex(i=>i-1)}>Đoạn trước</button><button disabled={busy||sourceIndex>=sources.length-1} onClick={()=>setSourceIndex(i=>i+1)}>Đoạn tiếp</button><button disabled={busy||!draft?.text} onClick={()=>change(source.id,{text:'',from:[]})}>Bỏ ghép đoạn này</button></div>
   <details className="alignment-adjust"><summary>Điều chỉnh khi hai bản chia đoạn khác nhau</summary>
    <label>Đoạn trong bản dịch<input type="number" min={1} max={parts.length} value={translationIndex+1} disabled={busy} onChange={e=>setTranslationIndex(Math.max(0,Math.min(parts.length-1,Number(e.target.value)-1)))}/></label><p className="alignment-source">{parts[translationIndex]}</p>
    <div className="row"><button disabled={busy} onClick={()=>change(source.id,{text:parts[translationIndex],from:[translationIndex]})}>Gán đoạn dịch này</button><button disabled={busy||draft?.from.includes(translationIndex)} onClick={()=>change(source.id,{text:[draft?.text,parts[translationIndex]].filter(Boolean).join('\n\n'),from:[...draft?.from||[],translationIndex]})}>Ghép thêm đoạn dịch này</button></div>
    {!!unused.length&&<p>Chưa ghép: {unused.slice(0,30).map(i=><button className="alignment-number" key={i} disabled={busy} onClick={()=>setTranslationIndex(i)}>{i+1}</button>)}{unused.length>30?'…':''}</p>}
    <p className="muted">Chọn đoạn nguyên văn rồi gán hoặc ghép thêm đoạn dịch. Bạn cũng có thể sửa, cắt và dán trong ô bản dịch đang ghép.</p>
   </details>
   <p>{stats.save} đoạn sẽ lưu · {stats.locked} đoạn khóa được giữ · {stats.existing} đoạn đã có bản dịch được giữ.</p>
   <label className="checkbox"><input type="checkbox" disabled={busy} checked={replace} onChange={e=>{setReplace(e.target.checked);setReviewed(false);}}/>Thay bản dịch đã có, luôn giữ đoạn khóa</label>
   <label className="checkbox"><input type="checkbox" disabled={busy} checked={locked} onChange={e=>setLocked(e.target.checked)}/>Khóa các bản dịch vừa nhập</label>
   {!!unused.length&&<label className="checkbox"><input type="checkbox" disabled={busy} checked={ignoreUnused} onChange={e=>setIgnoreUnused(e.target.checked)}/>Bỏ qua {unused.length} đoạn dịch chưa ghép trong lần lưu này</label>}
   <label className="checkbox"><input type="checkbox" disabled={busy} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>Tôi đã đối chiếu và đồng ý lưu các đoạn đã ghép</label>
   <div className="row"><button className="primary" disabled={busy||!reviewed||!stats.save||!!unused.length&&!ignoreUnused} onClick={async()=>{setBusy(true);setError('');try{await onSave(language,plan,replace,locked);onClose();}catch(e){setError(e instanceof Error?e.message:'Chưa lưu được bản dịch.');}finally{setBusy(false);}}}>{busy?'Đang lưu…':'Lưu bản dịch đã ghép'}</button><button disabled={busy} onClick={reset}>Chọn lại bản dịch</button></div>
  </>}
  {error&&<p role="alert" className="error">{error}</p>}
 </Modal>;
}
