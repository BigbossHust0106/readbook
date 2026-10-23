import {useEffect,useLayoutEffect,useRef,type RefObject} from 'react';
import {PageFlip,type Point} from './vendor/pageFlip';
import engineCSS from './vendor/pageFlip.css?inline';
import {capturePage} from './pageSnapshot';
type Direction='forward'|'backward';
type Turn={layer:HTMLElement;engine?:PageFlip;timer:ReturnType<typeof setTimeout>;start?:()=>void;readyFrame?:number;drag?:{direction:Direction;x:number;y:number;at:number;width:number;height:number;startX:number;startY:number}};
export function usePageTurn(paper:RefObject<HTMLDivElement|null>,frame:RefObject<HTMLDivElement|null>,enabled:boolean,layoutKey:string,preview:(direction:Direction)=>HTMLElement|null){
 const active=useRef<Turn|null>(null),latest=useRef(preview);latest.current=preview;
 function cancel(){const previous=active.current;active.current=null;if(previous){clearTimeout(previous.timer);if(previous.readyFrame!==undefined)cancelAnimationFrame(previous.readyFrame);previous.engine?.destroy();previous.layer.remove();}}
 useLayoutEffect(()=>{const pending=active.current?.start;if(pending){active.current!.start=undefined;pending();}});
 useEffect(()=>{cancel();},[enabled,layoutKey]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)'),hidden=()=>{if(document.hidden)cancel();};
  const observer=new ResizeObserver(()=>cancel());if(frame.current)observer.observe(frame.current);
  window.addEventListener('resize',cancel);media.addEventListener('change',cancel);document.addEventListener('visibilitychange',hidden);
  return()=>{cancel();observer.disconnect();window.removeEventListener('resize',cancel);media.removeEventListener('change',cancel);document.removeEventListener('visibilitychange',hidden);};
 },[]);
 function create(direction:Direction){
  cancel();const source=paper.current,container=frame.current;
  if(!enabled||!source||!container||matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
  const rect=source.getBoundingClientRect(),parent=container.getBoundingClientRect();if(!rect.width||!rect.height)return null;
  const old=capturePage(source),color=getComputedStyle(source.closest('.reader')!).backgroundColor;
  const layer=document.createElement('div');layer.className=`page-turn-overlay flipbook ${direction}`;layer.dataset.direction=direction;layer.dataset.engine='stpageflip';layer.setAttribute('aria-hidden','true');layer.inert=true;
  Object.assign(layer.style,{left:`${rect.left-parent.left}px`,top:`${rect.top-parent.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
  const shadow=layer.attachShadow({mode:'closed'}),style=document.createElement('style');style.textContent=engineCSS+`\n:host{background:${color};overflow:hidden}.engine-root{position:absolute;inset:0;width:100%;height:100%}.stf__wrapper{height:100%}.flip-sheet{background:${color};overflow:hidden}.flip-sheet>*{visibility:visible!important;}`;shadow.append(style);
  const root=document.createElement('div');root.className='engine-root';shadow.append(root);container.append(layer);
  const state:Turn={layer,timer:setTimeout(()=>{if(active.current===state)cancel();},1800)};active.current=state;
  function initialize(target:HTMLElement,ready?:()=>void){
   if(active.current!==state)return;
   const snapshots=direction==='forward'?[old,target]:[target,old];
   const sheets=snapshots.map(content=>{const sheet=document.createElement('div');sheet.className='flip-sheet';sheet.dataset.density='soft';sheet.append(content);return sheet;});
   const engine=new PageFlip(root,{width:rect.width,height:rect.height,size:'fixed',startPage:direction==='forward'?0:1,usePortrait:true,autoSize:false,showCover:false,drawShadow:true,maxShadowOpacity:.32,flippingTime:720,useMouseEvents:false,showPageCorners:false,disableFlipByClick:false,mobileScrollSupport:false});state.engine=engine;
   if(ready)engine.on('init',()=>{state.readyFrame=requestAnimationFrame(()=>{state.readyFrame=undefined;if(active.current===state)ready();});});
   engine.loadFromHTML(sheets);
   engine.on('changeState',event=>{state.layer.dataset.phase=String(event.data);if(event.data==='read'&&active.current===state)cancel();});
  }
  return {state,rect,initialize,shadow,old};
 }
 function turn(direction:Direction){
  const created=create(direction);if(!created)return;
  // Keep the outgoing content in place until React commits the actual next page.
  const cover=document.createElement('div');cover.className='page-turn-underlay';cover.style.cssText='position:absolute;inset:0;overflow:hidden';cover.append(created.old.cloneNode(true));created.shadow.append(cover);
  created.state.start=()=>{created.initialize(capturePage(paper.current!),()=>{cover.remove();if(direction==='forward')created.state.engine?.flipNext('bottom');else created.state.engine?.flipPrev('top');});};
 }
 function begin(direction:Direction,x:number,y:number){
  if(!enabled||matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
  const target=latest.current(direction);if(!target)return false;
  const created=create(direction);if(!created)return false;created.initialize(target);
  const {state,rect}=created;state.drag={direction,x,y,at:performance.now(),width:rect.width,height:rect.height,startX:x,startY:y};state.layer.dataset.phase='dragging';state.layer.dataset.progress='0';clearTimeout(state.timer);
  state.timer=setTimeout(()=>{if(active.current===state)cancel();},30000);
  // Start at the relevant corner; pointer displacement then controls the fold.
  const point={x:direction==='forward'?rect.width-1:1,y:y<rect.height/2?1:rect.height-1};state.engine!.getFlipController().fold(point);
  return true;
 }
 function move(x:number,y:number){
  const state=active.current,drag=state?.drag;if(!state?.engine||!drag)return false;
  drag.x=x;drag.y=y;
  const distance=(x-drag.startX)*(drag.direction==='forward'?-1:1),progress=Math.max(0,Math.min(1,distance/drag.width));
  state.layer.dataset.progress=progress.toFixed(3);state.layer.dataset.phase='dragging';
  // In portrait mode the return sheet moves in from the left, with a top fold.
  const point:Point={x:drag.direction==='forward'?drag.width-distance:distance,y:Math.max(1,Math.min(drag.height-1,(drag.startY<drag.height/2?1:drag.height-1)+(y-drag.startY)))};
  state.engine.getFlipController().fold(point);return true;
 }
 function release(forceCancel=false):Direction|null{
  const state=active.current,drag=state?.drag;if(!state?.engine||!drag)return null;
  const distance=(drag.x-drag.startX)*(drag.direction==='forward'?-1:1),elapsed=performance.now()-drag.at;
  const accepted=!forceCancel&&(distance>drag.width*.3||distance>55&&elapsed<500);
  state.drag=undefined;state.layer.dataset.phase=accepted?'settling':'returning';
  clearTimeout(state.timer);state.timer=setTimeout(()=>{if(active.current===state)cancel();},1800);
  state.engine.getFlipController().finishFold(accepted);
  return accepted?drag.direction:null;
 }
 return {turn,cancel,begin,move,release,isDragging:()=>!!active.current?.drag};
}
