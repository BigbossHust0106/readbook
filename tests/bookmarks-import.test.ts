import {expect,it} from 'vitest';
import {assertBook,type Book} from '../src/model';
import {bookmarksOf,putBookmark,removeBookmark} from '../src/bookmarks';
import {canonicalBook,personalState,applyPersonal} from '../src/bookState';
import {alignTranslations,applyImportedTranslations,translationSources} from '../src/translationImport';
import {clean,mergeDocuments,type Json} from '../src/merge';
const book=():Book=>({id:'b',title:'Sách',author:'',language:'vi',genre:'',hash:'hash',createdAt:'2026-10-21T00:00:00Z',shelf:'reading',approvedChildren:[],position:{chapter:0,paragraph:0,offset:2},chapters:[{id:'c1',title:'Chương 1',paragraphs:[{id:'p1',text:'Một đoạn dài để đọc và đánh dấu.',translations:{}},{id:'p2',text:'Một đoạn khác.',translations:{}}]},{id:'c2',title:'Chương 2',paragraphs:[{id:'p3',text:'Nội dung cuối.',translations:{}}]}]});
it('stores multiple bookmark offsets without moving progress and isolates them from the shared book',()=>{
 const original=book(),first=putBookmark(original,{chapter:0,paragraph:0,offset:4},'Câu hay'),marked=putBookmark(first,{chapter:0,paragraph:0,offset:14},'Đọc lại');
 expect(marked.position).toEqual(original.position);expect(bookmarksOf(marked).map(m=>m.offset)).toEqual([4,14]);expect(bookmarksOf(original)).toEqual([]);
 const renamed=putBookmark(marked,{chapter:0,paragraph:0,offset:4},'Tên mới');expect(bookmarksOf(renamed)).toHaveLength(2);expect(bookmarksOf(renamed)[0].createdAt).toBe(bookmarksOf(first)[0].createdAt);
 const shared=canonicalBook(renamed);expect(shared.chapters[0].paragraphs[0].bookmarks).toBeUndefined();
 const restored=applyPersonal(shared,{position:renamed.position,overrides:personalState(renamed)});expect(bookmarksOf(restored)).toEqual(bookmarksOf(renamed));
 expect(bookmarksOf(removeBookmark(restored,'p1',4)).map(m=>m.label)).toEqual(['Đọc lại']);assertBook(restored);
});
it('merges bookmarks added at different offsets and keeps a remote deletion',()=>{
 const original=putBookmark(book(),{chapter:0,paragraph:0,offset:0},'Mở đầu');
 const local=putBookmark(original,{chapter:0,paragraph:0,offset:7},'Máy một');
 const remote=putBookmark(removeBookmark(original,'p1',0),{chapter:0,paragraph:0,offset:14},'Máy hai');
 const merged=mergeDocuments(clean(personalState(original)) as Json,clean(personalState(local)) as Json,clean(personalState(remote)) as Json);
 expect(merged.conflicts).toEqual([]);const restored=applyPersonal(canonicalBook(original),{overrides:merged.value as ReturnType<typeof personalState>});expect(bookmarksOf(restored).map(m=>m.label)).toEqual(['Máy một','Máy hai']);
});
it('accepts older backups but rejects invalid bookmark coordinates and metadata',()=>{
 assertBook(book());const valid=putBookmark(book(),{chapter:0,paragraph:1,offset:3},'Đánh dấu');assertBook(valid);
 for(const bad of [{label:'',offset:3,createdAt:new Date().toISOString()},{label:'Lỗi',offset:999,createdAt:new Date().toISOString()},{label:'Lỗi',offset:3,createdAt:'not a date'}]){
  const corrupted=clean(valid);corrupted.chapters[0].paragraphs[1].bookmarks!['3']=bad;expect(()=>assertBook(corrupted)).toThrow('Dấu trang');
 }
});
it('imports manually aligned paragraphs, preserves source and keeps locked translations',()=>{
 const original=book();original.chapters[0].paragraphs[0].translations.en={text:'Locked',provider:'manual',locked:true,updatedAt:'now',history:[]};
 original.chapters[0].paragraphs[1].translations.en={text:'Earlier',provider:'MyMemory',locked:false,updatedAt:'now',history:['First']};
 const plan=alignTranslations(translationSources(original).map(p=>p.id),['Replacement','New version','Last paragraph']);
 const first=applyImportedTranslations(original,'en',plan);expect(first.saved).toBe(1);expect(first.skipped).toBe(2);expect(first.book.chapters[0].paragraphs[1].translations.en!.text).toBe('Earlier');
 const result=applyImportedTranslations(original,'en',plan,true,true);
 expect(result.saved).toBe(2);expect(result.skipped).toBe(1);expect(result.book.chapters[0].paragraphs[0].translations.en!.text).toBe('Locked');expect(result.book.chapters[0].paragraphs[1].translations.en).toMatchObject({text:'New version',provider:'import',locked:true,history:['First','Earlier']});
 expect(canonicalBook(result.book)).toEqual(canonicalBook(original));expect(original.chapters[1].paragraphs[0].translations.en).toBeUndefined();assertBook(result.book);
});
it('imports only the chosen scope and rejects stale mappings or identical languages',()=>{
 const original=book(),sources=translationSources(original,1);expect(sources.map(p=>p.id)).toEqual(['p3']);
 const result=applyImportedTranslations(original,'zh',alignTranslations(sources.map(p=>p.id),['结尾。']),false,false);
 expect(result.saved).toBe(1);expect(result.book.chapters[1].paragraphs[0].translations.zh).toMatchObject({text:'结尾。',provider:'import',locked:false});expect(result.book.chapters[0].paragraphs[0].translations).toEqual({});
 expect(()=>applyImportedTranslations(original,'en',{missing:{text:'Lost',from:[0]}})).toThrow('Cấu trúc sách');expect(()=>applyImportedTranslations(original,'vi',{})).toThrow('khác nguyên văn');
});
