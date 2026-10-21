import {useEffect,useState} from 'react';
import {flushEdits,resolveEdit,syncEdits,type SyncEdit} from './cloudSync';
import type {Json} from './merge';
function preview(value:Json|undefined):string {
 if(value===null)return 'Đã xóa';if(!value||typeof value!=='object'||Array.isArray(value))return 'Chưa có bản trên cloud.';
 if('overrides' in value){const notes=Object.values((value.overrides||{}) as Record<string,any>).flatMap(p=>[p.note,...Object.values(p.translations||{}).map((t:any)=>t.text),...Object.values(p.bookmarks||{}).map((b:any)=>`Dấu trang: ${b.label} · vị trí ${b.offset}`)]).filter(Boolean);return notes.join('\n\n')||`Kệ sách: ${{reading:'Đang đọc',later:'Đọc sau',favorite:'Yêu thích',done:'Hoàn thành'}[String(value.shelf)]||value.shelf}`;}
 if('term' in value)return `${value.term}\n${value.meaning||''}\nTrạng thái: ${value.status||''}`;
 return `${value.nickname||'Hồ sơ trẻ'}\n${JSON.stringify(value)}`;
}
export function SyncPanel({onRefresh,notify}:{onRefresh:()=>Promise<void>;notify:(text:string)=>void}) {
 const [entries,setEntries]=useState<SyncEdit[]>([]),[busy,setBusy]=useState(false);
 async function refresh(){setEntries(await syncEdits());}
 useEffect(()=>{const update=()=>void refresh().catch(()=>{});update();window.addEventListener('lasach-sync',update);return()=>window.removeEventListener('lasach-sync',update);},[]);
 async function run(fn:()=>Promise<void>){setBusy(true);try{await fn();await onRefresh();await refresh();}catch(e){notify((e as Error).message||'Chưa đồng bộ được. Thay đổi vẫn giữ trên thiết bị.');}finally{setBusy(false);}}
 function backup(entry:SyncEdit){const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),...entry},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='lasach-thay-doi-chua-dong-bo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="panel sync-panel" aria-label="Thay đổi chờ đồng bộ"><h2>Thay đổi chờ đồng bộ</h2><p>Ghi chú, bản dịch, dấu trang, kệ sách, từ vựng và hồ sơ trẻ được giữ trên thiết bị trước khi gửi lên tài khoản. Các phần sửa khác nhau được gộp; phần sửa trùng nhau cần bạn chọn.</p>
 <p role="status">{entries.length?`${entries.length} thay đổi chờ gửi · ${entries.filter(e=>e.conflicts.length).length} cần xem lại`:'Không có thay đổi chờ gửi.'}</p>
 <button disabled={busy||!navigator.onLine} onClick={()=>void run(flushEdits)}>Đồng bộ ngay</button>
 {entries.map(entry=><article className="sync-entry" key={entry.key}><h3>{entry.label}</h3><span className="pill">{entry.kind==='reading'?'Ghi chú, bản dịch & dấu trang':entry.kind==='vocabulary'?'Từ vựng':'Hồ sơ trẻ'}</span>
 {entry.conflicts.length?<><p role="status">Nội dung này cũng đã được sửa trên thiết bị khác. Hai bản vẫn được giữ để bạn chọn.</p><div className="sync-compare"><div><h4>Bản trên thiết bị</h4><pre>{preview(entry.local)}</pre></div><div><h4>Bản trên cloud</h4><pre>{preview(entry.remote)}</pre></div></div><div className="row"><button disabled={busy} onClick={()=>void run(()=>resolveEdit(entry,'local'))}>Giữ bản trên thiết bị</button><button disabled={busy} onClick={()=>void run(()=>resolveEdit(entry,'cloud'))}>Dùng bản trên cloud</button></div></>:<p role="status">{entry.blocked?'Chưa gửi được: quyền truy cập hoặc dữ liệu đã thay đổi.':entry.error?'Chưa kết nối được cloud. Thay đổi vẫn giữ trên thiết bị.':'Đã giữ trên thiết bị, chờ gửi lên cloud.'}</p>}
 <div className="row"><button onClick={()=>backup(entry)}>Tải bản sao thay đổi</button>{entry.blocked&&<button disabled={busy} onClick={()=>void run(()=>resolveEdit(entry,'retry'))}>Thử lại</button>}{!entry.conflicts.length&&<button disabled={busy} onClick={()=>{if(confirm('Bỏ thay đổi chưa gửi này? Bạn có thể tải bản sao trước.'))void run(()=>resolveEdit(entry,'cloud'));}}>Bỏ thay đổi này</button>}</div>
 </article>)}
 </section>;
}
