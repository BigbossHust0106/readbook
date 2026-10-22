import {useEffect,useRef,type RefObject} from 'react';
// Snapshot only the visible page, never the book or its pagination measurement roots.
// Closed shadow roots keep decorative copies out of selection, focus and reading selectors.
export function usePageTurn(paper:RefObject<HTMLDivElement|null>,frame:RefObject<HTMLDivElement|null>,enabled:boolean,layoutKey:string){
 const active=useRef<{layer:HTMLElement;animations:Animation[];timer:ReturnType<typeof setTimeout>}|null>(null);
 function cancel(){const previous=active.current;active.current=null;if(previous){clearTimeout(previous.timer);previous.animations.forEach(a=>a.cancel());previous.layer.remove();}}
 useEffect(()=>{cancel();},[enabled,layoutKey]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)'),hidden=()=>{if(document.hidden)cancel();};
  const observer=new ResizeObserver(()=>cancel());if(frame.current)observer.observe(frame.current);
  window.addEventListener('resize',cancel);media.addEventListener('change',cancel);document.addEventListener('visibilitychange',hidden);
  return()=>{cancel();observer.disconnect();window.removeEventListener('resize',cancel);media.removeEventListener('change',cancel);document.removeEventListener('visibilitychange',hidden);};
 },[]);
 function turn(direction:'forward'|'backward'){
  cancel();const source=paper.current,container=frame.current;
  if(!enabled||!source||!container||matchMedia('(prefers-reduced-motion: reduce)').matches||typeof source.animate!=='function')return;
  const rect=source.getBoundingClientRect(),frameRect=container.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const snapshot=source.cloneNode(true) as HTMLElement;
  const originals=[source,...source.querySelectorAll<HTMLElement>('*')],copies=[snapshot,...snapshot.querySelectorAll<HTMLElement>('*')];
  const properties=['display','box-sizing','font-family','font-size','font-weight','font-style','line-height','letter-spacing','word-spacing','color','text-align','text-indent','white-space','margin','padding','gap','grid-template-columns','border','border-radius','background-color','width','max-width','min-width','height','min-height','max-height','overflow','align-items','justify-content'];
  originals.forEach((node,i)=>{const copy=copies[i],style=getComputedStyle(node);copy.removeAttribute('id');copy.removeAttribute('tabindex');for(const prop of properties)copy.style.setProperty(prop,style.getPropertyValue(prop));copy.style.animation='none';copy.style.transition='none';});
  Object.assign(snapshot.style,{position:'absolute',top:'0',width:`${rect.width}px`,height:`${rect.height}px`,maxWidth:'none',margin:'0',overflow:'hidden'});
  const reader=source.closest('.reader')!,paperColor=getComputedStyle(reader).backgroundColor;
  const layer=document.createElement('div');layer.className=`page-turn-overlay ${direction}`;layer.dataset.direction=direction;layer.setAttribute('aria-hidden','true');layer.inert=true;
  Object.assign(layer.style,{left:`${rect.left-frameRect.left}px`,top:`${rect.top-frameRect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
  layer.style.setProperty('--turn-paper',paperColor==='rgba(0, 0, 0, 0)'?'#fcfcf8':paperColor);
  const animations:Animation[]=[],sign=direction==='forward'?-1:1;let parent:HTMLElement=layer;
  for(let i=0;i<4;i++){
   const leaf=document.createElement('div');leaf.className='page-turn-leaf';
   if(!i){leaf.style.width='25%';leaf.style[direction==='forward'?'left':'right']='0';}
   else leaf.style[direction==='forward'?'left':'right']='100%';
   leaf.style.transformOrigin=direction==='forward'?'left center':'right center';
   const front=document.createElement('div');front.className='page-turn-face page-turn-front';
   const host=document.createElement('div'),copy=snapshot.cloneNode(true) as HTMLElement;
   copy.style.left=`-${(direction==='forward'?i:3-i)*rect.width/4}px`;
   host.attachShadow({mode:'closed'}).append(copy);front.append(host);
   const back=document.createElement('div');back.className='page-turn-face page-turn-back';leaf.append(front,back);parent.append(leaf);parent=leaf;
   const angle=sign*(i===0?155:[0,16,12,8][i]);
   animations.push(leaf.animate([{transform:'rotateY(0deg)'},{transform:`rotateY(${angle*.24}deg)`,offset:.36},{transform:`rotateY(${angle}deg)`}],{duration:560,easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'}));
  }
  const shadow=document.createElement('div');shadow.className='page-turn-shadow';layer.prepend(shadow);
  animations.push(shadow.animate([{opacity:0},{opacity:.24,offset:.35},{opacity:0}],{duration:560,fill:'forwards'}));
  animations.push(layer.animate([{opacity:1,offset:0},{opacity:1,offset:.8},{opacity:0}],{duration:560,fill:'forwards'}));
  container.append(layer);const timer=setTimeout(()=>{if(active.current?.layer===layer)cancel();},700);active.current={layer,animations,timer};
  Promise.all(animations.map(a=>a.finished)).then(()=>{if(active.current?.layer===layer)cancel();},()=>{});
 }
 return {turn,cancel};
}
