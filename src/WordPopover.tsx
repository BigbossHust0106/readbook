import { useEffect, useState,useRef } from 'react';
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
export function WordPopover({word,target,onClose,onSave}:{word:SelectedText;target:Lang;onClose:()=>void;onSave:(term:string,meaning:string)=>Promise<void>}) {
  const [meaning,setMeaning]=useState<Meaning|null>(null),[draft,setDraft]=useState(''),[term,setTerm]=useState(word.term),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[loading,setLoading]=useState(true);
  const dirty=useRef(false);
  useEffect(()=>{
    const abort=new AbortController();let active=true;dirty.current=false;setTerm(word.term);setMeaning(null);setDraft('');setError('');setSaved(false);setLoading(true);
    void (async()=>{
      try {
        const key=`word-lookup:${word.source}:${target}:${word.term.toLocaleLowerCase()}`;
        const cached=await store.getSetting<Meaning|null>(key,null);
        let result=cached&&Date.now()-cached.at<30*86400000?cached:await nativeMeaning(word.term,word.source,target);
        if(!result){
          const r=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:word.term,source:word.source,target}),signal:abort.signal});
          const data=await r.json();if(!r.ok)throw new Error(data.error||'Chưa dịch được. Bạn có thể nhập nghĩa để lưu.');
          result={text:data.text,provider:data.provider,at:Date.now()};
        }
        if(active){setMeaning(result);if(!dirty.current)setDraft(result.text);await store.setSetting(key,result);}
      }catch(e){if(active&&!(e instanceof DOMException&&e.name==='AbortError'))setError((e as Error).message);}
      finally{if(active)setLoading(false);}
    })();return()=>{active=false;abort.abort();};
  },[word.term,word.source,target]);
  const left=Math.max(12,Math.min(innerWidth-Math.min(360,innerWidth-24)-12,word.x-170));
  const top=Math.max(65,Math.min(innerHeight-430,word.y>300?word.y-360:word.y+28));
  const google=`https://translate.google.com/?sl=${word.source==='zh'?'zh-CN':word.source}&tl=${target==='zh'?'zh-CN':target}&text=${encodeURIComponent(term)}&op=translate`;
  return <aside className="word-popover" role="dialog" aria-label="Dịch và lưu từ" style={{left,top}} onPointerDown={e=>e.stopPropagation()}>
    <header><strong>Dịch và lưu từ</strong><button aria-label="Đóng tra từ" onClick={onClose}>×</button></header>
    <label>Từ hoặc cụm đã chọn<textarea aria-label="Từ muốn lưu" rows={2} maxLength={1000} value={term} onChange={e=>{setTerm(e.target.value);setSaved(false);}}/></label>
    <label>Nghĩa / bản dịch<textarea aria-label="Nghĩa của từ" className="word-meaning" rows={3} value={draft} onChange={e=>{dirty.current=true;setDraft(e.target.value);setSaved(false);}}/></label>
    {loading?<p role="status">Đang dịch phần đã chọn…</p>:error?<p role="status">{error}</p>:<small>{meaning?.provider} · có thể sửa nghĩa trước khi lưu</small>}
    <div className="row"><button disabled={!term.trim()||busy||saved||(loading&&!draft.trim())} onClick={async()=>{setBusy(true);try{await onSave(term.trim(),draft);setSaved(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{saved?'Đã lưu từ':'Lưu từ'}</button><a href={google} target="_blank" rel="noopener noreferrer">Google Dịch</a></div>
  </aside>;
}
