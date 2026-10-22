import { useCallback, useEffect, useState,useRef,type ReactNode } from 'react';
import * as store from './store';
import type { SelectedText } from './wordLookup';
import type { Lang } from './model';
type Meaning = {text:string;provider:string;at:number};
type BrowserTranslator={translate:(text:string)=>Promise<string>;destroy:()=>void};
const nativePairs=new Map<string,Promise<BrowserTranslator>>();
async function nativeMeaning(term:string,source:Lang,target:Lang) {
  const api=(window as unknown as {Translator?:{availability:(options:{sourceLanguage:string;targetLanguage:string})=>Promise<string>;create:(options:{sourceLanguage:string;targetLanguage:string})=>Promise<BrowserTranslator>}}).Translator;
  if(!api)return null;
  try {
    const options={sourceLanguage:source==='zh'?'zh-CN':source,targetLanguage:target==='zh'?'zh-CN':target};
    if(await api.availability(options)!=='available')return null;
    const key=`${source}:${target}`;if(!nativePairs.has(key))nativePairs.set(key,api.create(options));
    return {text:await (await nativePairs.get(key)!).translate(term),provider:'Trình duyệt · mô hình có sẵn',at:Date.now()};
  }catch{return null;}
}
export function WordPopover({word,target,onClose,onSave,actions}:{word:SelectedText;target:Lang;actions?:ReactNode;onClose:()=>void;onSave:(term:string,meaning:string)=>Promise<void>}) {
  const [meaning,setMeaning]=useState<Meaning|null>(null),[draft,setDraft]=useState(''),[term,setTerm]=useState(word.term),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[loading,setLoading]=useState(true);
  const dirty=useRef(false), pending=useRef<AbortController|null>(null);
  const lookup=useCallback((text:string,google=false)=>{
    pending.current?.abort();
    const abort=new AbortController();pending.current=abort;
    setMeaning(null);setError('');setLoading(true);
    const current=()=>pending.current===abort;
    const timer=setTimeout(()=>{if(current()){pending.current=null;abort.abort();setLoading(false);setError('Dịch quá thời gian chờ. Bấm Thử dịch lại; nghĩa bạn đã nhập vẫn được giữ.');}},50000);
    void (async()=>{
      try {
        const key=`word-lookup:${google?'google:':''}${word.source}:${target}:${text.toLocaleLowerCase()}`;
        const cached=await store.getSetting<Meaning|null>(key,null);
        if(abort.signal.aborted)return;
        let result=cached&&Date.now()-cached.at<30*86400000?cached:(google?null:await nativeMeaning(text,word.source,target));
        if(abort.signal.aborted)return;
        if(!result){
          const r=await fetch(google?'/api/translate/google':'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,source:word.source,target}),signal:abort.signal});
          const data=await r.json().catch(()=>null);
          if(!r.ok)throw new Error(data?.error||'Dịch vụ dịch tạm thời không sẵn sàng. Bấm Thử dịch lại hoặc nhập nghĩa để lưu.');
          if(typeof data?.text!=='string'||!data.text.trim())throw new Error('Chưa nhận được bản dịch. Bấm Thử dịch lại hoặc nhập nghĩa để lưu.');
          result={text:data.text,provider:data.provider,at:Date.now()};
        }
        if(current()&&!abort.signal.aborted){
          setMeaning(result);if(!dirty.current){setDraft(result.text);setSaved(false);}
          // A cache write failure must not turn a successful lookup into a translation error.
          await store.setSetting(key,result).catch(()=>{});
        }
      }catch(e){if(current())setError(e instanceof TypeError?'Không kết nối được dịch vụ dịch. Kiểm tra mạng rồi bấm Thử dịch lại.':e instanceof Error?e.message:'Chưa dịch được. Bấm Thử dịch lại.');}
      finally{clearTimeout(timer);if(current()){setLoading(false);pending.current=null;}}
    })();
  },[word.source,target]);
  useEffect(()=>{
    dirty.current=false;setTerm(word.term);setDraft('');setSaved(false);lookup(word.term);
    return()=>{const old=pending.current;pending.current=null;old?.abort();};
  },[word.term,lookup]);
  const left=Math.max(12,Math.min(innerWidth-Math.min(360,innerWidth-24)-12,word.x-170));
  const top=Math.max(65,Math.min(innerHeight-430,word.y>300?word.y-360:word.y+28));

  return <aside className="word-popover" role="dialog" aria-label="Dịch và lưu từ" style={{left,top}} onPointerDown={e=>e.stopPropagation()}>
    <header><strong>Dịch và lưu từ</strong><button aria-label="Đóng tra từ" onClick={onClose}>×</button></header>
    {actions&&<div className="selection-actions">{actions}</div>}
    <label>Từ hoặc cụm đã chọn<textarea aria-label="Từ muốn lưu" rows={2} maxLength={1000} value={term} onChange={e=>{const old=pending.current;pending.current=null;old?.abort();setLoading(false);setMeaning(null);setError('');setTerm(e.target.value);setSaved(false);}}/></label>
    <label>Nghĩa / bản dịch<textarea aria-label="Nghĩa của từ" className="word-meaning" rows={3} value={draft} onChange={e=>{dirty.current=true;setDraft(e.target.value);setSaved(false);}}/></label>
    {loading?<p role="status">Đang dịch phần đã chọn…</p>:error?<p role="status">{error}</p>:<small>{meaning?`${meaning.provider} · có thể sửa nghĩa trước khi lưu`:'Bấm Dịch để tra nội dung đã sửa.'}</small>}
    {meaning&&dirty.current&&draft!==meaning.text&&<div className="lookup-result"><p>Bản dịch: {meaning.text}</p><button onClick={()=>{dirty.current=false;setDraft(meaning.text);setSaved(false);}}>Dùng bản dịch</button></div>}
    <div className="row"><button disabled={!term.trim()||loading||busy} onClick={()=>lookup(term.trim())}>{loading?'Đang dịch…':error?'Thử dịch lại':'Dịch'}</button><button disabled={!term.trim()||busy||saved||(loading&&!draft.trim())} onClick={async()=>{setBusy(true);try{await onSave(term.trim(),draft);setSaved(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{saved?'Đã lưu từ':'Lưu từ'}</button><button disabled={!term.trim()||loading||busy} onClick={()=>lookup(term.trim(),true)}>Dịch bằng Google</button></div>
  </aside>;
}
