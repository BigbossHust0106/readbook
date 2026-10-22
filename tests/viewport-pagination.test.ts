import {expect,it} from 'vitest';
import {measurePages,readingAnchor,type PageMeasure} from '../src/viewportPagination';
import type {Book} from '../src/model';
import type {Fragment,ReadingPage} from '../src/reading';
function fixture(texts:string[][]){return {chapters:texts.map((texts,chapter)=>({id:String(chapter),paragraphs:texts.map((text,paragraph)=>({id:String(paragraph),text}))}))} as Book;}
function measurer(capacity:number):PageMeasure{
 let used=0;
 return {fits:f=>used+f.end-f.start<=capacity,add:f=>{used+=f.end-f.start;},clear:()=>{used=0;}};
}
function pages(iterator:Generator<ReadingPage|null>){return [...iterator].filter((page):page is ReadingPage=>!!page);}
const read=(book:Book,pages:ReadingPage[])=>pages.flatMap(p=>p.fragments.map(f=>book.chapters[f.chapter].paragraphs[f.paragraph].text.slice(f.start,f.end))).join('');
it('measures the requested page before touching earlier chapters and yields between probes',()=>{
 const book=fixture([['Earlier chapter. '.repeat(500)],['Current page. '.repeat(100)]]);
 const anchor={chapter:1,paragraph:0,offset:210},probed:Fragment[]=[];
 const measure=measurer(240),iterator=measurePages(book,anchor,'forward',500,{...measure,fits:f=>{probed.push(f);return measure.fits(f,'forward');}});
 expect(iterator.next().value).toBeNull();let first:ReadingPage|null=null;
 for(let i=0;i<100&&!first;i++)first=iterator.next().value as ReadingPage|null;
 expect(first!.fragments[0]).toMatchObject({chapter:1,paragraph:0,start:210});expect(probed.every(f=>f.chapter===1)).toBe(true);iterator.return(undefined);
});
it.each([0,1,133,500,1299])('reconstructs all text exactly around anchor offset %s, in both directions',offset=>{
 const book=fixture([['Trước đó. '.repeat(100)],['A book 📖 中文。 Một cuốn sách. '.repeat(100),'Đoạn khác. '.repeat(100)],['Kết thúc.']]);
 const anchor=readingAnchor(book,{chapter:1,paragraph:0,offset});
 const before=pages(measurePages(book,anchor,'backward',250,measurer(185))).reverse();
 const after=pages(measurePages(book,anchor,'forward',250,measurer(185)));
 expect(read(book,[...before,...after])).toBe(book.chapters.flatMap(c=>c.paragraphs.map(p=>p.text)).join(''));
 for(const p of [...before,...after]){expect(p.characters).toBeLessThanOrEqual(185);for(const f of p.fragments){const text=book.chapters[f.chapter].paragraphs[f.paragraph].text.slice(f.start,f.end);expect(text).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u);}}
});
it('includes short paragraphs, empty chapters and the previous chapter in reverse reading order',()=>{
 const book=fixture([['Opening.',''],[],['A','B','C','D'],['Last.']]);const anchor={chapter:2,paragraph:2,offset:0};
 const before=pages(measurePages(book,anchor,'backward',500,measurer(100))).reverse();const after=pages(measurePages(book,anchor,'forward',500,measurer(100)));
 expect(read(book,[...before,...after])).toBe('Opening.ABCDLast.');expect(before.at(-1)!.chapter).toBe(2);
});
