import {translatedFragment,type ReadingPage} from './reading';
import type {Book,Lang} from './model';

export function capturePage(source:HTMLElement){
 const rect=source.getBoundingClientRect();
 const snapshot=source.cloneNode(true) as HTMLElement;
  const originals=[source,...source.querySelectorAll<HTMLElement>('*')],copies=[snapshot,...snapshot.querySelectorAll<HTMLElement>('*')];
  const properties=['display','box-sizing','font-family','font-size','font-weight','font-style','line-height','letter-spacing','word-spacing','color','text-align','text-indent','white-space','overflow-wrap','word-break','margin','padding','gap','grid-template-columns','border','border-radius','background-color','width','max-width','min-width','overflow','align-items','justify-content'];
  // Preserve normal block flow. Freezing every computed height prevents margin
  // collapse and packs the snapshot differently from the actual reading page.
  originals.forEach((node,i)=>{const copy=copies[i],style=getComputedStyle(node);copy.removeAttribute('id');copy.removeAttribute('tabindex');for(const prop of properties)copy.style.setProperty(prop,style.getPropertyValue(prop));copy.style.animation='none';copy.style.transition='none';});
  Object.assign(snapshot.style,{position:'absolute',left:'0',top:'0',width:`${rect.width}px`,height:`${rect.height}px`,maxWidth:'none',maxHeight:'none',minHeight:'0',margin:'0',overflow:'hidden'});
 return snapshot;
}


// Build only one already-measured neighbour, using the same DOM and CSS as the reader.
// The short-lived offscreen node is removed before returning its styled snapshot.
export function previewPage(source:HTMLElement,page:ReadingPage,book:Book,layout:string,target:Lang,search:string){
 const node=source.cloneNode(false) as HTMLElement,rect=source.getBoundingClientRect();
 node.removeAttribute('id');node.removeAttribute('aria-label');node.classList.add('viewport-measure');node.setAttribute('aria-hidden','true');node.inert=true;
 Object.assign(node.style,{position:'fixed',left:'-20000px',top:'0',width:`${rect.width}px`,height:`${rect.height}px`,maxWidth:'none',visibility:'hidden'});
 for(const fragment of page.fragments){
  const p=book.chapters[fragment.chapter].paragraphs[fragment.paragraph];
  if(search&&!p.text.toLowerCase().includes(search.toLowerCase())&&!p.translations[target]?.text.toLowerCase().includes(search.toLowerCase()))continue;
  const article=document.createElement('article');article.className=`paragraph ${p.highlight?'highlighted':''}`;const row=document.createElement('div');row.className='paragraph-text';article.append(row);
  if(layout!=='translation'){const text=document.createElement('p');text.lang=book.language;text.textContent=p.text.slice(fragment.start,fragment.end);if(fragment.start)text.style.textIndent='0';row.append(text);}
  if(layout!=='original'){const translated=document.createElement('div'),text=document.createElement('p');translated.className='translated';translated.lang=target;
   text.textContent=p.translations[target]?.text?translatedFragment(p.translations[target]!.text,p.text.length,fragment.start,fragment.end):'Chưa có bản dịch ·';if(!p.translations[target]?.text)text.className='untranslated';translated.append(text);row.append(translated);}
  node.append(article);
 }
 source.parentElement!.append(node);
 try{return capturePage(node);}finally{node.remove();}
}
