import type {Book} from './model';
export type BookMatch={chapter:number;paragraph:number;offset:number;snippet:string;translated:boolean};
export function fold(text:string){return text.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLocaleLowerCase();}
function sourceOffset(text:string,index:number){let original=0,folded=0;for(const char of text){const length=fold(char).length;if(folded+length>index)return original;folded+=length;original+=char.length;}return original;}
export function searchBook(book:Book,query:string,limit=50):{matches:BookMatch[];more:boolean} {
 const needle=fold(query.trim()),matches:BookMatch[]=[];if(!needle)return {matches,more:false};
 for(let ci=0;ci<book.chapters.length;ci++)for(let pi=0;pi<book.chapters[ci].paragraphs.length;pi++){
  const p=book.chapters[ci].paragraphs[pi];
  const candidates=[{text:p.text,translated:false},...Object.values(p.translations).map(t=>({text:t!.text,translated:true}))];
  for(const item of candidates){const at=fold(item.text).indexOf(needle);if(at<0)continue;
   if(matches.length===limit)return {matches,more:true};const offset=sourceOffset(item.text,at),start=Math.max(0,offset-50),end=Math.min(item.text.length,offset+needle.length+100);
   matches.push({chapter:ci,paragraph:pi,offset:item.translated?0:offset,snippet:(start?'…':'')+item.text.slice(start,end)+(end<item.text.length?'…':''),translated:item.translated});break;
  }
 }
 return {matches,more:false};
}
