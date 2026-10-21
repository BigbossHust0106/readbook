import {expect,it} from 'vitest';
import {canonicalBook,personalState,applyPersonal} from '../src/bookState';
import type {Book} from '../src/model';
it('keeps PDF source references in the shared book and restores personal data without changing its text',()=>{
 const book:Book={id:'b',title:'Sách',author:'',language:'vi',genre:'',hash:'hash',createdAt:new Date().toISOString(),shelf:'favorite',approvedChildren:['child'],position:{chapter:0,paragraph:0,offset:5},chapters:[{id:'ch',title:'Trang 7',sourcePage:7,ocr:true,paragraphs:[{id:'p',text:'Chữ nguyên bản.',note:'Riêng tư',highlight:true,translations:{en:{text:'Original text.',locked:true,provider:'manual',updatedAt:'now',history:[]}}}]}]};
 const shared=canonicalBook(book);
 expect(shared.chapters[0].sourcePage).toBe(7);expect(shared.chapters[0].paragraphs[0]).toEqual({id:'p',text:'Chữ nguyên bản.',translations:{}});expect(shared.approvedChildren).toEqual([]);
 const personal=applyPersonal(shared,{book_id:book.id,position:book.position,shelf:book.shelf,approved_children:book.approvedChildren,overrides:personalState(book)});
 expect(personal).toEqual(book);expect(applyPersonal(shared).chapters[0].paragraphs[0].note).toBeUndefined();
});
