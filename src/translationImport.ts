import {applyTranslation,type Book,type Lang} from './model';
export type TranslationDraft={text:string;from:number[]};
export type TranslationPlan=Record<string,TranslationDraft>;
export function translationSources(book:Book,chapter?:number){
 return book.chapters.flatMap((c,ci)=>chapter===undefined||ci===chapter?c.paragraphs.map((p,pi)=>({id:p.id,text:p.text,chapter:ci,paragraph:pi,chapterTitle:c.title})):[]);
}
export function alignTranslations(ids:string[],texts:string[]):TranslationPlan{
 return Object.fromEntries(ids.map((id,i)=>[id,{text:texts[i]||'',from:i<texts.length?[i]:[]}]));
}
export function applyImportedTranslations(book:Book,target:Lang,plan:TranslationPlan,replaceExisting=false,locked=true){
 if(target===book.language)throw new Error('Chọn ngôn ngữ bản dịch khác nguyên văn.');
 const ids=new Set(book.chapters.flatMap(c=>c.paragraphs.map(p=>p.id)));
 if(Object.keys(plan).some(id=>!ids.has(id)))throw new Error('Cấu trúc sách đã thay đổi. Hãy mở lại màn hình căn bản dịch.');
 let saved=0,skipped=0;
 const next={...book,chapters:book.chapters.map(c=>({...c,paragraphs:c.paragraphs.map(p=>{
  const text=plan[p.id]?.text.trim();if(!text)return p;
  const prior=p.translations[target];if(prior?.locked||prior?.text&&!replaceExisting){skipped++;return p;}
  saved++;const updated=applyTranslation(p,target,text,'import');
  return {...updated,translations:{...updated.translations,[target]:{...updated.translations[target]!,locked}}};
 })}))};
 return {book:next,saved,skipped};
}
