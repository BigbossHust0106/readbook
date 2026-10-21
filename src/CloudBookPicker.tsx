import {useMemo,useState} from 'react';
import {Modal} from './Modal';
import {languages,type Book} from './model';
import {rpc,type ReadingGroup} from './groups';
import * as store from './store';
export function CloudBookPicker({group,books,onRefresh,onClose,notify}:{group:ReadingGroup;books:Book[];onRefresh:()=>Promise<void>;onClose:()=>void;notify:(text:string)=>void}){
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(0);
 const own=useMemo(()=>books.filter(b=>store.canEditBook(b.id)),[books]);
 const existing=books.filter(b=>group.bookIds.includes(b.id));
 const shared=(b:Book)=>existing.some(e=>e.id===b.id||e.hash===b.hash&&e.language===b.language);
 const matches=own.filter(b=>`${b.title} ${b.author} ${languages[b.language]}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 async function add(){
  setBusy(true);setError('');setDone(0);const completed:string[]=[];let failure='';
  try{
   if(!navigator.onLine)throw new Error('Cần kết nối mạng để chia sẻ sách cloud vào nhóm.');
   for(const bid of selected){
    if(!store.canEditBook(bid))throw new Error('Chỉ chia sẻ sách do tài khoản của bạn tải lên.');
    // Existing RPC enforces ownership and membership, and deduplicates by hash/language.
    await rpc<string>('add_group_book',{gid:group.id,bid});completed.push(bid);setDone(completed.length);
   }
  }catch(e){failure=e&&typeof e==='object'&&'message' in e?String(e.message):'Chưa thêm được sách vào nhóm.';}
  setSelected(ids=>ids.filter(id=>!completed.includes(id)));
  try{await onRefresh();}catch{failure||='Chưa tải lại được danh sách. Bấm đồng bộ để xem sách vừa thêm.';}
  setBusy(false);
  if(failure)setError(`${completed.length?`Đã xử lý ${completed.length} sách; các lựa chọn còn lại được giữ. `:''}${failure}`);
  else {notify(`Đã thêm ${completed.length} sách vào nhóm. Sách đã có cùng nội dung được dùng lại.`);onClose();}
 }
 return <Modal title="Thêm sách từ thư viện cloud" onClose={()=>{if(!busy)onClose();}}>
  <p>Chia sẻ sách bạn đã tải lên vào nhóm <strong>{group.name}</strong>. Thành viên sẽ đọc được nguyên văn và tải tệp gốc. Ghi chú, bản dịch, dấu trang và vị trí của bạn vẫn riêng tư.</p>
  <label>Tìm sách trong cloud<input disabled={busy} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tên sách, tác giả hoặc ngôn ngữ…"/></label>
  <div className="cloud-book-picker">{matches.map(b=><label className="cloud-book-choice" key={b.id}><input aria-label={`Chọn ${b.title}`} type="checkbox" disabled={busy||shared(b)} checked={selected.includes(b.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,b.id]:ids.filter(id=>id!==b.id))}/><span><strong>{b.title}</strong><small>{b.author} · {languages[b.language]}</small>{shared(b)&&<small>Đã có trong nhóm hoặc có sách cùng nội dung</small>}</span></label>)}</div>
  {!own.length&&<p>Thư viện cloud của bạn chưa có sách do bạn tải lên. Thêm sách vào thư viện cloud trước, hoặc dùng Thêm sách vào nhóm để tải tệp mới.</p>}
  {!!own.length&&!matches.length&&<p>Không tìm thấy sách phù hợp.</p>}
  <p className="muted">Chỉ chọn sách do bạn sở hữu trên cloud. Sách được đọc nhờ nhóm khác không thể chia sẻ lại từ đây. Sách cùng nội dung và ngôn ngữ trong nhóm được dùng chung, không tải tệp lên lại.</p>
  <p role="status">{busy?`Đang thêm ${done}/${selected.length} sách…`:`Đã chọn ${selected.length} sách`}</p>
  {error&&<p role="alert" className="error">{error}</p>}
  <button className="primary" disabled={busy||!selected.length||!navigator.onLine} onClick={()=>void add()}>Thêm sách đã chọn vào nhóm</button>
 </Modal>;
}
