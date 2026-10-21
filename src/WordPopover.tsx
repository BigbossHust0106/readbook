import { useEffect, useState } from 'react';
import * as store from './store';
import type { HitWord } from './wordLookup';
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
export function WordPopover({word,target,onClose,onSave,onEnter,onLeave}:{word:HitWord;target:Lang;onClose:()=>void;onSave:(meaning:string)=>Promise<void>;onEnter:()=>void;onLeave:()=>void}) {
  const [meaning,setMeaning]=useState<Meaning|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
  useEffect(()=>{
    const abort=new AbortController();let active=true;setMeaning(null);setError('');setSaved(false);
    void (async()=>{
      try {
        const key=`word-lookup:${word.source}:${target}:${word.term.toLocaleLowerCase()}`;
        const cached=await store.getSetting<Meaning|null>(key,null);
        if(cached&&Date.now()-cached.at<30*86400000){if(active)setMeaning(cached);return;}
        let result=await nativeMeaning(word.term,word.source,target);
        if(!result){
          const r=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:word.term,source:word.source,target}),signal:abort.signal});
          const data=await r.json();if(!r.ok)throw new Error(data.error||'Chưa tra được từ này.');
          result={text:data.text,provider:data.provider,at:Date.now()};
        }
        if(active){setMeaning(result);await store.setSetting(key,result);}
      }catch(e){if(active&&!(e instanceof DOMException&&e.name==='AbortError'))setError((e as Error).message);}
    })();return()=>{active=false;abort.abort();};
  },[word.term,word.source,target]);
  const left=Math.max(12,Math.min(innerWidth- Math.min(320,innerWidth-24)-12,word.x-150));
  const top=word.y>250 ? word.y-230 : Math.min(innerHeight-280,word.y+32);
  const google=`https://translate.google.com/?sl=${word.source==='zh'?'zh-CN':word.source}&tl=${target==='zh'?'zh-CN':target}&text=${encodeURIComponent(word.term)}&op=translate`;
  return <aside className="word-popover" role="dialog" aria-label="Tra từ nổi" style={{left,top:Math.max(12,top)}} onMouseEnter={onEnter} onMouseLeave={onLeave} onPointerDown={e=>e.stopPropagation()}>
    <header><strong lang={word.source}>{word.term}</strong><button aria-label="Đóng tra từ" onClick={onClose}>×</button></header>
    {meaning?<><p className="word-meaning" lang={target}>{meaning.text}</p><small>{meaning.provider}</small></>:error?<p role="status">{error}</p>:<p role="status">Đang tra từ…</p>}
    <div className="row"><button disabled={!meaning||busy||saved} onClick={async()=>{setBusy(true);try{await onSave(meaning!.text);setSaved(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{saved?'Đã lưu từ':'Lưu từ'}</button><a href={google} target="_blank" rel="noopener noreferrer">Google Dịch ↗</a></div>
  </aside>;
}
