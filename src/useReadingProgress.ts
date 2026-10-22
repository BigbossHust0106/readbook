import {useEffect,useRef,type RefObject} from 'react';
import type {Book} from './model';
const key=(p:Book['position'])=>`${p.chapter}:${p.paragraph}:${p.offset||0}`;
export function useReadingProgress({book,paper,ready,onProgress,onRemote}:{book:Book;paper:RefObject<HTMLDivElement|null>;ready:boolean;onProgress:(p:Book['position'])=>Promise<void>;onRemote:(p:Book['position'])=>void}) {
  const current=useRef({book,onProgress,onRemote});current.current={book,onProgress,onRemote};
  const lastPosition=useRef(book.position);
  const own=useRef(key(book.position)),skip=useRef(Date.now()+1200),timer=useRef<ReturnType<typeof setTimeout>|null>(null),started=useRef(false);
  function restore(position:Book['position']) {
    const p=current.current.book.chapters[position.chapter]?.paragraphs[position.paragraph];if(!p)return;
    const article=document.getElementById(`p-${p.id}`);if(!article)return;
    const source=article.querySelector<HTMLElement>('[data-reading-source]'),node=source?.firstChild;
    if(source&&node?.nodeType===Node.TEXT_NODE) {
      const offset=Math.max(0,Math.min((position.offset||0)-Number(article.dataset.fragmentStart||0),(node as Text).length));
      const range=document.createRange();range.setStart(node,offset);range.setEnd(node,Math.min(offset+1,(node as Text).length));
      const rect=range.getBoundingClientRect();window.scrollBy({top:rect.top-100,behavior:'instant'});
    } else article.scrollIntoView({block:'center',behavior:'instant'});
  }
  async function record(position:Book['position']) {
    lastPosition.current=position;own.current=key(position);skip.current=Date.now()+400;
    if(timer.current){clearTimeout(timer.current);timer.current=null;}
    await current.current.onProgress(position);
  }
  function capture():Book['position']|null {
    if(!paper.current||Date.now()<skip.current||!getSelection()?.isCollapsed)return null;
    if(paper.current.classList.contains("mode-paged"))return lastPosition.current;
    const anchor=Math.min(160,innerHeight*.3);
    const rows=Array.from(paper.current.querySelectorAll<HTMLElement>('[data-paragraph-id]'));
    const article=rows.find(el=>{const r=el.getBoundingClientRect();return r.bottom>anchor&&r.top<innerHeight-35;});
    if(!article)return null;
    const ci=Number(article.dataset.chapter),pi=Number(article.dataset.paragraph),start=Number(article.dataset.fragmentStart||0);
    const text=article.querySelector<HTMLElement>('[data-reading-source]')||article.querySelector<HTMLElement>('.paragraph-text p');
    let offset=start;
    if(text){
      const rect=text.getBoundingClientRect(),x=rect.left+Math.min(28,rect.width/3),y=Math.max(rect.top+8,Math.min(rect.bottom-5,anchor));
      const doc=document as Document&{caretPositionFromPoint?:(x:number,y:number)=>{offsetNode:Node;offset:number}|null};
      const range=doc.caretRangeFromPoint?.(x,y), caret=range?{offsetNode:range.startContainer,offset:range.startOffset}:doc.caretPositionFromPoint?.(x,y);
      if(caret&&text.contains(caret.offsetNode)) {
        const sourceLength=Number(article.dataset.fragmentEnd)-start, factor=text.hasAttribute('data-reading-source')?1:sourceLength/Math.max(1,text.textContent?.length||1);
        offset+=Math.floor(caret.offset*factor);
      }
    }
    const original=current.current.book.chapters[ci]?.paragraphs[pi];if(!original)return null;
    return {chapter:ci,paragraph:pi,offset:Math.min(Math.max(0,offset),Math.max(0,original.text.length-1))};
  }
  useEffect(()=>{
    if(!ready||started.current)return;started.current=true;skip.current=Date.now()+1300;
    const p=current.current.book.position;
    if(p.chapter||p.paragraph||p.offset){const handle=setTimeout(()=>restore(p),100);return()=>clearTimeout(handle);}
  },[ready]);
  useEffect(()=>{
    const incoming=key(book.position);if(incoming===own.current||!ready)return;own.current=incoming;lastPosition.current=book.position;
    skip.current=Date.now()+1400;current.current.onRemote(book.position);
    const handle=setTimeout(()=>restore(book.position),100);return()=>clearTimeout(handle);
  },[book.position.chapter,book.position.paragraph,book.position.offset,ready]);
  useEffect(()=>{
    if(!ready)return;
    const save=()=>{const p=capture();if(p&&key(p)!==own.current)void record(p);};
    const scroll=()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(save,650);};
    const visibility=()=>{if(document.visibilityState==='hidden')save();};
    window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',visibility);
    return()=>{save();if(timer.current)clearTimeout(timer.current);window.removeEventListener('scroll',scroll);window.removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',visibility);};
  },[ready]);
  return {record,reveal:restore};
}
