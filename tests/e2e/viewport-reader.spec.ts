import {test,expect,type Page} from '@playwright/test';
import {showTools,hideTools,readyPage,openMenu} from './helpers';
async function add(page:Page,text:string){await page.goto('/');await page.getByRole('button',{name:'Thêm sách',exact:true}).click();await page.getByLabel('Nội dung sách').fill(text);await page.getByRole('textbox',{name:'Tên sách',exact:true}).fill('Một màn hình một trang');await page.getByRole('button',{name:'Nhập & lưu sách',exact:true}).click();await page.getByRole('button',{name:/Một màn hình một trang/}).click();await readyPage(page);}
async function fits(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);const data=await page.locator('.page-frame').evaluate(frame=>{const box=frame.getBoundingClientRect(),paper=frame.querySelector('.reading-paper:not(.viewport-measure)')!;return {frameHeight:box.height,visibleHeight:paper.getBoundingClientRect().height,scroll:paper.scrollHeight,client:paper.clientHeight,bottom:Math.max(...Array.from(paper.querySelectorAll('.paragraph-text')).map(el=>el.getBoundingClientRect().bottom)),limit:box.bottom};});expect(data.scroll).toBeLessThanOrEqual(data.client+1);expect(data.bottom).toBeLessThanOrEqual(data.limit+1);}
test('viewport pagination preserves all source text, supports buttons and arrow keys, and never scrolls vertically',async({page})=>{
 const source='Một cuốn sách mở ra thế giới. '.repeat(120);await add(page,source);await fits(page);
 const fragments:string[]=[];for(let i=0;i<40;i++){fragments.push((await page.locator('[data-reading-source]').allTextContents()).join(''));const next=page.getByRole('button',{name:'Trang sau',exact:true});if(await next.isDisabled())break;await next.click();await fits(page);}
 expect(fragments.join('')).toBe(source.trim());await page.keyboard.press('ArrowLeft');await expect(page.locator('.reader-page-status')).not.toContainText(`Trang ${fragments.length}/`);
 await page.screenshot({path:'/tmp/readbook-viewport-desktop.png'});
});
test('phone pages fit after font, line spacing and screen size change; swipe turns a page',async({page})=>{
 await page.setViewportSize({width:390,height:844});await add(page,'Reading sách mỗi ngày. '.repeat(140));await fits(page);await showTools(page);await page.getByLabel('Cỡ chữ',{exact:true}).fill('30');await page.getByLabel('Khoảng dòng',{exact:true}).fill('2.5');await hideTools(page);await readyPage(page);await fits(page);
 const before=await page.locator('.reader-page-status').innerText();const paper=page.locator('.reading-paper:not(.viewport-measure)');await paper.dispatchEvent('pointerdown',{pointerType:'touch',clientX:300,clientY:300});await paper.dispatchEvent('pointerup',{pointerType:'touch',clientX:60,clientY:305});await expect(page.locator('.reader-page-status')).not.toHaveText(before);await fits(page);
 await page.setViewportSize({width:844,height:390});await readyPage(page);await fits(page);await page.screenshot({path:'/tmp/readbook-viewport-landscape.png'});
});
test('only selecting text opens the combined translate and vocabulary form; hovering sends nothing',async({page})=>{
 const sent:string[]=[];await page.route('**/api/translate',route=>{sent.push(route.request().postDataJSON().text);return route.fulfill({json:{text:'Đọc sách',provider:'Test fixture'}});});await add(page,'Reading books opens new worlds.');
 const source=page.locator('[data-reading-source]').first();await source.hover();await page.waitForTimeout(700);expect(sent).toHaveLength(0);await expect(page.getByRole('dialog',{name:'Dịch và lưu từ'})).toHaveCount(0);
 await source.evaluate(el=>{const range=document.createRange();range.setStart(el.firstChild!,0);range.setEnd(el.firstChild!,13);const s=getSelection()!;s.removeAllRanges();s.addRange(range);});
 const popup=page.getByRole('dialog',{name:'Dịch và lưu từ'});await expect(popup.getByLabel('Nghĩa của từ')).toHaveValue('Đọc sách');expect(sent).toEqual(['Reading books']);await popup.getByLabel('Nghĩa của từ').fill('Nghĩa đã sửa');await popup.getByRole('button',{name:'Lưu từ',exact:true}).click();await expect(popup).toContainText('Đã lưu từ');await popup.getByRole('button',{name:'Đóng tra từ'}).click();
 await openMenu(page);await expect(page.locator('.sidebar nav')).toContainText('Thư viện của tôi');await expect(page.locator('.sidebar nav')).toContainText('Cài đặt & kết nối');await expect(page.locator('.reader-sidebar-panel')).toBeVisible();await page.screenshot({path:'/tmp/readbook-unified-menu.png'});
});
test('long bilingual fragments fit a narrow page and preserve translated text across pages',async({page})=>{
 const source='Đọc sách mỗi ngày. '.repeat(75).trim(),translation='Reading books can open new worlds and bring new ideas. '.repeat(90).trim();await add(page,source);
 await page.getByRole('button',{name:'Sửa bản dịch và ghi chú đoạn 1'}).click();await page.getByLabel('Bản dịch thủ công').fill(translation);await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();await readyPage(page);
 await showTools(page);await page.getByLabel('Chiều rộng trang',{exact:true}).fill('560');await hideTools(page);await readyPage(page);const translated:string[]=[];
 for(let i=0;i<80;i++){await fits(page);translated.push((await page.locator('.reading-paper:not(.viewport-measure) .translated p').allTextContents()).join(''));const next=page.getByRole('button',{name:'Trang sau',exact:true});if(await next.isDisabled())break;await next.click();}
 expect(translated.join('')).toBe(translation);await page.screenshot({path:'/tmp/readbook-viewport-bilingual.png'});
});
test('real emulated touch events swipe pages without vertical scrolling',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});try{const page=await context.newPage();await add(page,'Một cuốn sách để đọc trên điện thoại. '.repeat(100));const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:320,y:350}]});for(const x of [260,180,80])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:350}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('.reader-page-status')).toContainText('Trang 2/');await fits(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:80,y:350}]});for(const x of [150,240,320])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:350}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('.reader-page-status')).toContainText('Trang 1/');await fits(page);await openMenu(page);await page.screenshot({path:'/tmp/readbook-menu-phone.png'});
 }finally{await context.close();}
});
