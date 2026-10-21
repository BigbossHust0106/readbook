import {useEffect,useRef,useState,type DragEvent} from 'react';
import {Upload} from 'lucide-react';
const accept='.pdf,.epub,.txt,.docx,.html,.htm';
const hasFiles=(data:DataTransfer)=>Array.from(data.types).includes('Files');
export function FileDropZone({file,onFile,onError,disabled=false,label='Kéo thả tệp sách vào đây',inputLabel='Tệp sách',compact=false}:{file?:File|null;onFile:(file:File)=>void;onError?:(message:string)=>void;disabled?:boolean;label?:string;inputLabel?:string;compact?:boolean}){
 const [dragging,setDragging]=useState(false),[error,setError]=useState('');const depth=useRef(0);
 const report=(message:string)=>{if(onError)onError(message);else setError(message);};
 useEffect(()=>{
  // Keep a misplaced file from navigating the browser away from unsaved work.
  const stop=(e:globalThis.DragEvent)=>{if(e.dataTransfer&&hasFiles(e.dataTransfer))e.preventDefault();};
  const reset=()=>{depth.current=0;setDragging(false);};
  window.addEventListener('dragover',stop);window.addEventListener('drop',stop);window.addEventListener('drop',reset);window.addEventListener('dragend',reset);
  return()=>{window.removeEventListener('dragover',stop);window.removeEventListener('drop',stop);window.removeEventListener('drop',reset);window.removeEventListener('dragend',reset);};
 },[]);
 useEffect(()=>{if(disabled){depth.current=0;setDragging(false);}},[disabled]);
 function receive(files:File[]){
  if(disabled||!files.length)return;
  if(files.length!==1){report('Mỗi lần chọn một tệp sách để kiểm tra trước khi nhập.');return;}
  const next=files[0];
  if(!/\.(pdf|epub|txt|docx|html|htm)$/i.test(next.name)){report('Hỗ trợ PDF, EPUB, TXT UTF-8, DOCX và HTML.');return;}
  report('');onFile(next);
 }
 function over(e:DragEvent){if(!hasFiles(e.dataTransfer))return;e.preventDefault();e.dataTransfer.dropEffect=disabled?'none':'copy';}
 return <div className={compact?'file-drop compact':'file-drop'}>
  <label className={`dropzone ${dragging?'dragging':''} ${disabled?'disabled':''}`}
   onDragEnter={e=>{if(!hasFiles(e.dataTransfer))return;e.preventDefault();if(!disabled){depth.current++;setDragging(true);}}}
   onDragOver={over} onDragLeave={e=>{if(!hasFiles(e.dataTransfer))return;depth.current=Math.max(0,depth.current-1);if(!depth.current)setDragging(false);}}
   onDrop={e=>{if(!hasFiles(e.dataTransfer))return;e.preventDefault();e.stopPropagation();depth.current=0;setDragging(false);if(disabled)return;
    if(Array.from(e.dataTransfer.items).some(item=>item.webkitGetAsEntry?.()?.isDirectory)){report('Hãy thả một tệp sách, không thả thư mục.');return;}
    receive(Array.from(e.dataTransfer.files));
   }}>
   <Upload size={compact?22:30}/><strong>{dragging?'Thả tệp để thêm sách':file?file.name:label}</strong>
   <span>PDF, EPUB, TXT UTF-8, DOCX, HTML · Tối đa 50 MB · Mỗi lần một tệp</span>
   <span className="file-picker-action">{file?'Chọn tệp khác':'Chọn tệp từ thiết bị'}</span>
   <input type="file" aria-label={inputLabel} accept={accept} disabled={disabled} onChange={e=>{receive(Array.from(e.target.files||[]));e.target.value='';}}/>
  </label>
  {!onError&&error&&<p role="alert" className="error">{error}</p>}
 </div>;
}
