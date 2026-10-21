import {useEffect,useState,type RefObject} from 'react';
import type {Book,Lang} from './model';
import {paginateBook,translatedFragment,type ReadingPage,type Fragment} from './reading';
function safeBoundary(text:string,start:number,end:number){
 if(end>=text.length)return text.length;
 if(/[\uD800-\uDBFF]/.test(text[end-1]))end--;
 const sample=text.slice(start,end),breaks=[...sample.matchAll(/[\s。！？.!?;；]/gu)],last=breaks.at(-1);
 if(last&&last.index!>sample.length*.65)end=start+last.index!+last[0].length;
 const safe=Math.max(start+1,end);return /[\uD800-\uDBFF]/.test(text[safe-1])&&safe<text.length?safe+1:safe;
}
export function useViewportPages({book,frame,enabled,layout,target,font,fontFamily,lineHeight,budget,widthLimit}:{book:Book;frame:RefObject<HTMLDivElement|null>;enabled:boolean;layout:string;target:Lang;font:number;fontFamily:string;lineHeight:number;budget:number;widthLimit:number}){
 const [size,setSize]=useState({width:0,height:0}),[result,setResult]=useState<ReadingPage[]>([]),[busy,setBusy]=useState(enabled),[finished,setFinished]=useState('');
 const content=JSON.stringify(book.chapters.map(c=>c.paragraphs.map(p=>[p.id,p.text,layout==='original'?'':p.translations[target]?.text||''])));
 const layoutKey=JSON.stringify([size.width,size.height,content,layout,target,font,fontFamily,lineHeight,budget]);
 useEffect(()=>{
  if(!enabled||!frame.current)return;
  const node=frame.current,observe=()=>{const rect=node.getBoundingClientRect(),r={width:Math.min(rect.width,widthLimit),height:rect.height};setSize(s=>Math.abs(s.width-r.width)<.5&&Math.abs(s.height-r.height)<.5?s:{width:r.width,height:r.height});};
  const observer=new ResizeObserver(observe);observer.observe(node);observe();return()=>observer.disconnect();
 },[enabled,widthLimit]);
 useEffect(()=>{
  if(!enabled){setBusy(false);return;}
  if(!size.width||!size.height)return;
  let cancelled=false;const root=document.createElement('div');
  root.className=`reading-paper paragraphs layout-${layout} viewport-measure`;root.setAttribute('aria-hidden','true');
  Object.assign(root.style,{position:'fixed',left:'-20000px',top:'0',width:`${size.width}px`,maxWidth:'none',height:'auto',minHeight:'0',overflow:'visible',visibility:'hidden',pointerEvents:'none',fontSize:`${font}px`});
  root.style.setProperty('--reader-font',fontFamily);root.style.setProperty('--reader-leading',String(lineHeight));
  frame.current?.closest('.reader')?.append(root);setBusy(true);
  const create=(f:Fragment)=>{
   const p=book.chapters[f.chapter].paragraphs[f.paragraph],article=document.createElement('article'),row=document.createElement('div');article.className='paragraph';row.className='paragraph-text';article.append(row);
   if(layout!=='translation'){const source=document.createElement('p');source.textContent=p.text.slice(f.start,f.end);if(f.start)source.style.textIndent='0';row.append(source);}
   if(layout!=='original'){const box=document.createElement('div'),translated=document.createElement('p');box.className='translated';if(p.translations[target]?.text)translated.textContent=translatedFragment(p.translations[target]!.text,p.text.length,f.start,f.end);else{translated.className='untranslated';translated.textContent='Chưa có bản dịch ·';}box.append(translated);row.append(box);}
   return article;
  };
  void(async()=>{
   try{
    await document.fonts.ready;if(cancelled)return;
    const pages:ReadingPage[]=[];let page:ReadingPage={chapter:0,fragments:[],characters:0},steps=0;
    const finish=()=>{if(page.fragments.length)pages.push(page);root.replaceChildren();page={chapter:page.chapter,fragments:[],characters:0};};
    const fits=()=>root.getBoundingClientRect().height<=size.height-3;
    for(let ci=0;ci<book.chapters.length;ci++){
     finish();page.chapter=ci;
     for(let pi=0;pi<book.chapters[ci].paragraphs.length;pi++){
      const p=book.chapters[ci].paragraphs[pi];let start=0;
      while(start<p.text.length){
       if(cancelled)return;
       if(page.characters>=budget)finish();
       const max=Math.min(p.text.length,start+Math.max(1,budget-page.characters));
       let end=safeBoundary(p.text,start,max),fragment:Fragment={chapter:ci,paragraph:pi,start,end},node=create(fragment);root.append(node);
       if(!fits()){
        node.remove();let low=start+1,high=end,best=start;
        while(low<=high){const mid=Math.floor((low+high)/2),candidate=create({...fragment,end:mid});root.append(candidate);const fit=fits();candidate.remove();if(fit){best=mid;low=mid+1;}else high=mid-1;}
        if(best===start&&page.fragments.length){finish();continue;}
        end=safeBoundary(p.text,start,Math.max(start+1,best));fragment={...fragment,end};node=create(fragment);root.append(node);
       }
       page.fragments.push(fragment);page.characters+=end-start;start=end;
       if(start<p.text.length)finish();
       if(++steps%20===0)await new Promise<void>(r=>setTimeout(r,0));
      }
     }
    }
    finish();if(!cancelled){setResult(pages.length?pages:paginateBook(book,budget));setFinished(layoutKey);setBusy(false);}
   }finally{root.remove();}
  })();
  return()=>{cancelled=true;root.remove();};
 },[enabled,size.width,size.height,content,layout,target,font,fontFamily,lineHeight,budget]);
 return {pages:result,busy:enabled&&(busy||finished!==layoutKey)};
}
