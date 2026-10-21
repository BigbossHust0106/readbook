import type { Lang } from './model';
export type HitWord = {term:string;paragraphId:string;source:Lang;x:number;y:number};
export function hitWord(x:number,y:number,root:HTMLElement):HitWord|null {
  const doc=document as Document & {caretPositionFromPoint?:(x:number,y:number)=>{offsetNode:Node;offset:number}|null};
  const caret=doc.caretRangeFromPoint?.(x,y), position=caret?{offsetNode:caret.startContainer,offset:caret.startOffset}:doc.caretPositionFromPoint?.(x,y);
  if(!position||position.offsetNode.nodeType!==Node.TEXT_NODE)return null;
  const node=position.offsetNode as Text, element=node.parentElement?.closest<HTMLElement>('[data-lookup-lang]');
  if(!element||!root.contains(element))return null;
  const lang=element.dataset.lookupLang as Lang, paragraph=element.closest<HTMLElement>('[data-paragraph-id]');
  if(!paragraph||!['vi','en','zh'].includes(lang))return null;
  const text=node.data,offset=Math.min(position.offset,text.length-1);
  const segments=new Intl.Segmenter(lang==='zh'?'zh-CN':lang,{granularity:'word'}).segment(text);
  for(const segment of segments) {
    if(!segment.isWordLike||offset<segment.index||offset>=segment.index+segment.segment.length)continue;
    const range=document.createRange();range.setStart(node,segment.index);range.setEnd(node,segment.index+segment.segment.length);
    const rects=Array.from(range.getClientRects());
    if(!rects.some(r=>x>=r.left-1&&x<=r.right+1&&y>=r.top-1&&y<=r.bottom+1))return null;
    if(segment.segment.length>100)return null;
    const rect=range.getBoundingClientRect();
    return {term:segment.segment,source:lang,paragraphId:paragraph.dataset.paragraphId!,x:rect.left+rect.width/2,y:rect.top};
  }
  return null;
}
