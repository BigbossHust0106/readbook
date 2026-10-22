import {useEffect,useLayoutEffect,useRef,type RefObject} from 'react';
// A styled snapshot of the visible page only. Decorative copies live in closed,
// inert shadow trees so reading, selection and pagination never see duplicates.
function capture(source:HTMLElement){
 const rect=source.getBoundingClientRect();
 const snapshot=source.cloneNode(true) as HTMLElement;
  const originals=[source,...source.querySelectorAll<HTMLElement>('*')],copies=[snapshot,...snapshot.querySelectorAll<HTMLElement>('*')];
  const properties=['display','box-sizing','font-family','font-size','font-weight','font-style','line-height','letter-spacing','word-spacing','color','text-align','text-indent','white-space','margin','padding','gap','grid-template-columns','border','border-radius','background-color','width','max-width','min-width','height','min-height','max-height','overflow','align-items','justify-content'];
  originals.forEach((node,i)=>{const copy=copies[i],style=getComputedStyle(node);copy.removeAttribute('id');copy.removeAttribute('tabindex');for(const prop of properties)copy.style.setProperty(prop,style.getPropertyValue(prop));copy.style.animation='none';copy.style.transition='none';});
  Object.assign(snapshot.style,{position:'absolute',top:'0',width:`${rect.width}px`,height:`${rect.height}px`,maxWidth:'none',margin:'0',overflow:'hidden'});
 return snapshot;
}

type Turn={layer:HTMLElement;animations:Animation[];timer:ReturnType<typeof setTimeout>;start?:()=>void};
export function usePageTurn(paper:RefObject<HTMLDivElement|null>,frame:RefObject<HTMLDivElement|null>,enabled:boolean,layoutKey:string){
 const active=useRef<Turn|null>(null);
 function cancel(){const previous=active.current;active.current=null;if(previous){clearTimeout(previous.timer);previous.animations.forEach(a=>a.cancel());previous.layer.remove();}}
 // Backward turns need the incoming page, captured after React commits its text.
 // The outgoing page remains underneath until the incoming sheet has settled.
 useLayoutEffect(()=>{const pending=active.current?.start;if(pending){active.current!.start=undefined;pending();}});
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
  const oldPage=capture(source),paperColor=getComputedStyle(source.closest('.reader')!).backgroundColor;
  const layer=document.createElement('div');layer.className=`page-turn-overlay ${direction}`;layer.dataset.direction=direction;layer.setAttribute('aria-hidden','true');layer.inert=true;
  Object.assign(layer.style,{left:`${rect.left-frameRect.left}px`,top:`${rect.top-frameRect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
  layer.style.setProperty('--turn-paper',paperColor==='rgba(0, 0, 0, 0)'?'#fcfcf8':paperColor);
  layer.style.setProperty('--turn-width',`${rect.width}px`);
  function snapshotHost(content:HTMLElement){const host=document.createElement('div');host.attachShadow({mode:'closed'}).append(content);return host;}
  if(direction==='backward'){const cover=snapshotHost(oldPage);cover.className='page-turn-underlay';layer.append(cover);}
  container.append(layer);
  const state:Turn={layer,animations:[],timer:setTimeout(()=>{if(active.current===state)cancel();},1100)};active.current=state;
  function animatePage(){
   if(active.current!==state||!paper.current)return;
   const incoming=direction==='backward',snapshot=incoming?capture(paper.current):oldPage;
   const surface=document.createElement('div');surface.className='page-turn-surface';layer.append(surface);
   const duration=640,easing='cubic-bezier(.4,0,.2,1)',options:KeyframeAnimationOptions={duration,easing,fill:'forwards'};
   let parent=surface;
   for(let i=0;i<8;i++){
    const leaf=document.createElement('div');leaf.className='page-turn-leaf';leaf.style.left=i?'100%':'0';leaf.style.width=i?'100%':'12.5%';
    leaf.style.setProperty('--strip-offset',`-${i*rect.width/8}px`);
    const front=document.createElement('div');front.className='page-turn-face page-turn-front';const copy=snapshot.cloneNode(true) as HTMLElement;copy.style.left=`-${i*rect.width/8}px`;front.append(snapshotHost(copy));
    const back=document.createElement('div');back.className='page-turn-face page-turn-back';leaf.append(front,back);parent.append(leaf);parent=leaf;
    const angle=i===0?(incoming?0:-150):-(incoming?3.5:5.5);
    state.animations.push(leaf.animate(incoming?[{transform:`rotateY(${angle}deg)`},{transform:'rotateY(0deg)'}]:[{transform:'rotateY(0deg)'},{transform:`rotateY(${angle}deg)`}],options));
   }
   if(incoming){
    state.animations.push(surface.animate([
     {transform:`translate3d(-${rect.width*.08}px,-${rect.height*.16}px,80px) rotateX(18deg) rotateY(-42deg) rotateZ(-4deg)`},
     {transform:'translate3d(0,0,0) rotateX(0deg) rotateY(0deg) rotateZ(0deg)'}
    ],options));
   }else state.animations.push(surface.animate([{opacity:1},{opacity:1,offset:.88},{opacity:0}],{duration,fill:'forwards'}));
   const shadow=document.createElement('div');shadow.className='page-turn-shadow';layer.prepend(shadow);
   state.animations.push(shadow.animate(incoming?[{opacity:.2},{opacity:0}]:[{opacity:0},{opacity:.18,offset:.5},{opacity:0}],options));
   Promise.all(state.animations.map(a=>a.finished)).then(()=>{if(active.current===state)cancel();},()=>{});
  }
  if(direction==='backward')state.start=animatePage;else animatePage();
 }
 return {turn,cancel};
}
