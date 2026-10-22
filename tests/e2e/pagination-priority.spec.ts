import {test,expect,type Page} from '@playwright/test';
import {readyPage,showTools,hideTools} from './helpers';
async function holdBackground(page:Page){
 await page.addInitScript(()=>{
  const native=window.requestIdleCallback.bind(window),cancel=window.cancelIdleCallback.bind(window);
  const pending=new Map<number,IdleRequestCallback>();let id=1_000_000;
  window.requestIdleCallback=callback=>{pending.set(++id,callback);return id;};
  window.cancelIdleCallback=handle=>{if(handle>1_000_000)pending.delete(handle);else cancel(handle);};
  (window as any).resumePagination=()=>{window.requestIdleCallback=native;for(const callback of pending.values())native(callback,{timeout:100});pending.clear();};
  const original=Element.prototype.getBoundingClientRect;
  (window as any).paginationProbes=0;
  Element.prototype.getBoundingClientRect=function(){if(this.classList.contains('viewport-measure'))(window as any).paginationProbes++;return original.call(this);};
 });
}
async function longBook(page:Page,small=false){
 await page.goto('/');await page.getByRole('button',{name:'Thêm sách',exact:true}).waitFor();
 const characters=await page.evaluate(async small=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('lasach-v1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const book={id:'pagination-long',title:'Sách dài kiểm tra phân trang',author:'Fixture',language:'vi',genre:'',hash:'pagination-long',createdAt:new Date().toISOString(),shelf:'reading',approvedChildren:[],position:small?{chapter:1,paragraph:1,offset:180}:{chapter:30,paragraph:7,offset:200},chapters:Array.from({length:small?3:40},(_,ci)=>({id:`c${ci}`,title:`Chương ${ci+1}`,paragraphs:Array.from({length:small?2:20},(_,pi)=>({id:`p${ci}-${pi}`,text:`Vị trí ${ci}-${pi}. `+'Đọc sách mỗi ngày để mở rộng hiểu biết. '.repeat(small?18:65),translations:{}}))}))};
  const tx=db.transaction('books','readwrite');tx.objectStore('books').put(book);await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();return book.chapters.flatMap(c=>c.paragraphs).reduce((sum,p)=>sum+p.text.length,0);
 },small);
 const start=Date.now();await page.reload();await readyPage(page);return {milliseconds:Date.now()-start,characters};
}
async function first(page:Page){return page.locator('.reading-paper:not(.viewport-measure) [data-paragraph-id]').first().evaluate(el=>({chapter:Number((el as HTMLElement).dataset.chapter),paragraph:Number((el as HTMLElement).dataset.paragraph),start:Number((el as HTMLElement).dataset.fragmentStart),end:Number((el as HTMLElement).dataset.fragmentEnd)}));}
async function fits(page:Page){await readyPage(page);const box=await page.locator('.page-frame').evaluate(frame=>{const paper=frame.querySelector('.reading-paper:not(.viewport-measure)')!;return {scroll:paper.scrollHeight,client:paper.clientHeight,bottom:Math.max(...Array.from(paper.querySelectorAll('.paragraph-text')).map(p=>p.getBoundingClientRect().bottom)),limit:frame.getBoundingClientRect().bottom};});expect(box.scroll).toBeLessThanOrEqual(box.client+1);expect(box.bottom).toBeLessThanOrEqual(box.limit+1);}
test('opens the saved page without scanning earlier chapters; turns both ways while background work is paused',async({page})=>{
 await holdBackground(page);const {milliseconds,characters}=await longBook(page);
 await expect(page.locator('.page-frame')).toHaveAttribute('data-pagination-complete','false');expect(await first(page)).toMatchObject({chapter:30,paragraph:7,start:200});
 const probes=await page.evaluate(()=>(window as any).paginationProbes);expect(probes).toBeLessThan(100);await fits(page);
 await page.getByRole('button',{name:'Trang sau',exact:true}).click();await readyPage(page);expect(await first(page)).not.toMatchObject({chapter:30,paragraph:7,start:200});
 await page.getByRole('button',{name:'Trang trước',exact:true}).click();await expect.poll(()=>first(page)).toMatchObject({chapter:30,paragraph:7,start:200});
 await page.getByRole('button',{name:'Trang trước',exact:true}).click();await readyPage(page);const previous=await first(page);expect(previous.chapter).toBe(30);expect(previous.paragraph===7?previous.start<200:previous.paragraph<7).toBe(true);await fits(page);
 console.log(JSON.stringify({firstPageMs:milliseconds,layoutProbesBeforeFirstPage:probes,bookCharacters:characters,backgroundPaused:true}));
});
test('font, width, character budget and orientation changes prioritize the same reading position and cancel old jobs',async({page})=>{
 await page.setViewportSize({width:390,height:844});await holdBackground(page);await longBook(page);
 await showTools(page);await page.getByLabel('Cỡ chữ',{exact:true}).fill('28');await page.getByLabel('Chiều rộng trang',{exact:true}).fill('560');await page.getByLabel('Số ký tự mỗi trang').fill('500');await hideTools(page);await readyPage(page);
 expect(await first(page)).toMatchObject({chapter:30,paragraph:7,start:200});await expect(page.locator('.page-frame')).toHaveAttribute('data-pagination-complete','false');await fits(page);
 await page.setViewportSize({width:844,height:390});await readyPage(page);expect(await first(page)).toMatchObject({chapter:30,paragraph:7,start:200});await fits(page);
 await page.getByRole('button',{name:'Trang sau',exact:true}).click();await readyPage(page);const next=await first(page);
 await showTools(page);await page.getByLabel('Cỡ chữ',{exact:true}).fill('18');await page.getByLabel('Cỡ chữ',{exact:true}).fill('24');await page.getByLabel('Cỡ chữ',{exact:true}).fill('20');await hideTools(page);await readyPage(page);expect(await first(page)).toMatchObject({chapter:next.chapter,paragraph:next.paragraph,start:next.start});await fits(page);
 expect(await page.locator('.viewport-measure').count()).toBeLessThanOrEqual(2);await page.screenshot({path:'/tmp/readbook-priority-pagination.png'});
});

test('background finishes without moving the page, preserves reverse pagination and reuses cached layout without idle callbacks',async({page})=>{
 await page.addInitScript(()=>{
  Reflect.deleteProperty(window,'requestIdleCallback');Reflect.deleteProperty(window,'cancelIdleCallback');
  (window as any).paginationProbes=0;const original=Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect=function(){if(this.classList.contains('viewport-measure'))(window as any).paginationProbes++;return original.call(this);};
 });
 await longBook(page,true);const anchor=await first(page);
 await expect(page.locator('.page-frame')).toHaveAttribute('data-pagination-complete','true');expect(await first(page)).toEqual(anchor);await fits(page);
 await showTools(page);await page.getByLabel('Cỡ chữ',{exact:true}).fill('28');await hideTools(page);await readyPage(page);await expect(page.locator('.page-frame')).toHaveAttribute('data-pagination-complete','true');await fits(page);
 const count=await page.evaluate(()=>(window as any).paginationProbes);
 await showTools(page);await page.getByLabel('Cỡ chữ',{exact:true}).fill('20');await hideTools(page);await readyPage(page);await expect(page.locator('.page-frame')).toHaveAttribute('data-pagination-complete','true');expect(await page.evaluate(()=>(window as any).paginationProbes)).toBe(count);expect(await first(page)).toEqual(anchor);
 for(let i=0;i<50;i++){const prev=page.getByRole('button',{name:'Trang trước',exact:true});if(await prev.isDisabled())break;await prev.click();await fits(page);}
 const texts:string[]=[];
 for(let i=0;i<100;i++){texts.push((await page.locator('[data-reading-source]').allTextContents()).join(''));await fits(page);const next=page.getByRole('button',{name:'Trang sau',exact:true});if(await next.isDisabled())break;await next.click();await readyPage(page);}
 const original=Array.from({length:3},(_,ci)=>Array.from({length:2},(_,pi)=>`Vị trí ${ci}-${pi}. `+'Đọc sách mỗi ngày để mở rộng hiểu biết. '.repeat(18)).join('')).join('');expect(texts.join('')).toBe(original);
});
