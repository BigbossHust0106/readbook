import {test,expect,type Page} from '@playwright/test';
async function add(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'Thêm sách',exact:true}).click();
 await page.getByLabel('Nội dung sách').fill('Chương 1\n\n'+Array.from({length:30},(_,i)=>`Đoạn ${i+1}. Reading books opens new worlds. `.repeat(10)).join('\n\n')+'\n\nChương 2\n\nNội dung tiếp theo.');
 await page.getByRole('textbox',{name:'Tên sách',exact:true}).fill('Đọc mọi lúc');
 await page.getByRole('button',{name:'Nhập & lưu sách',exact:true}).click();await page.getByRole('button',{name:/Đọc mọi lúc/}).click();
}
async function tools(page:Page){const show=page.getByRole('button',{name:'Hiện công cụ',exact:true});if(await show.isVisible())await show.click();}
async function firstWord(page:Page){return page.locator('[data-reading-source]').first().evaluate(el=>{const r=document.createRange();r.setStart(el.firstChild!,0);r.setEnd(el.firstChild!,4);const b=r.getBoundingClientRect();return {x:b.left+4,y:b.top+b.height/2};});}
test('blank page edges turn pages; hover dock stays in reader; floating tools stay at current scroll',async({page})=>{
 await add(page);await page.getByRole('slider',{name:'Số ký tự mỗi trang'}).fill('500');
 const paper=page.locator('.reading-paper'),status=page.locator('.reader-page-status');
 await expect(page.getByRole('button',{name:'Trang sau',exact:true})).toHaveCount(0);
 await paper.scrollIntoViewIfNeeded();let box=(await paper.boundingBox())!;
 await page.mouse.click(box.x+box.width-8,Math.max(50,box.y+50));await expect(status).toContainText('Trang 2/');
 box=(await paper.boundingBox())!;await page.mouse.click(box.x+8,Math.max(50,box.y+50));await expect(status).toContainText('Trang 1/');
 await page.getByRole('button',{name:'Mở Mục lục',exact:true}).hover();await expect(page.locator('.reader-flyout')).toContainText('Chương 2');
 await page.getByRole('button',{name:'Mở Thư viện',exact:true}).hover();await expect(page.locator('.reader-flyout')).toContainText('Đọc mọi lúc');await expect(paper).toBeVisible();
 await page.mouse.move(1000,600);await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
 await expect(page.getByRole('button',{name:'Hiện công cụ',exact:true})).toBeVisible();
 const before=await page.evaluate(()=>scrollY);await tools(page);await expect(page.locator('.reader-controls.tools-floating')).toBeVisible();expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThan(3);
 await page.screenshot({path:'/tmp/readbook-reader-desktop.png'});
});
test('hover/tap looks up only a word, caches meaning and offers Google; touch swipes turn in both directions',async({page})=>{
 const requests:string[]=[];await page.route('**/api/translate',r=>{requests.push(r.request().postDataJSON().text);return r.fulfill({json:{text:'Nghĩa thử nghiệm',provider:'Test fixture'}});});
 await add(page);await page.getByRole('slider',{name:'Số ký tự mỗi trang'}).fill('500');await page.locator('.reading-paper').scrollIntoViewIfNeeded();
 expect(requests).toHaveLength(0);let point=await firstWord(page);await page.mouse.move(point.x,point.y);
 const popup=page.getByRole('dialog',{name:'Tra từ nổi'});await expect(popup).toContainText('Nghĩa thử nghiệm');expect(requests).toHaveLength(1);expect(requests[0]).toBe('Đoạn');
 await expect(popup.getByRole('link',{name:/Google Dịch/})).toHaveAttribute('href',/translate.google.com/);
 await popup.getByRole('button',{name:'Đóng tra từ'}).click();await page.mouse.click(point.x,point.y);await expect(popup).toContainText('Nghĩa thử nghiệm');expect(requests).toHaveLength(1);
 await popup.getByRole('button',{name:'Lưu từ',exact:true}).click();await expect(popup).toContainText('Đã lưu từ');await popup.getByRole('button',{name:'Đóng tra từ'}).click();
 await page.setViewportSize({width:390,height:844});await page.locator('.reading-paper').scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'Mở bảng công cụ đọc'}).click();await expect(page.locator('.reader-flyout')).toBeVisible();await page.getByRole('button',{name:'Đóng bảng công cụ đọc'}).click();
 const swipe=async(from:number,to:number)=>{await page.locator('.reading-paper').dispatchEvent('pointerdown',{pointerType:'touch',clientX:from,clientY:400});await page.locator('.reading-paper').dispatchEvent('pointerup',{pointerType:'touch',clientX:to,clientY:405});};
 await swipe(300,70);await expect(page.locator('.reader-page-status')).toContainText('Trang 2/');await swipe(70,300);await expect(page.locator('.reader-page-status')).toContainText('Trang 1/');
 await page.waitForTimeout(550);await page.locator("[data-reading-source]").first().scrollIntoViewIfNeeded();point=await firstWord(page);await page.mouse.click(point.x,point.y);await expect(popup).toContainText('Nghĩa thử nghiệm');expect(requests).toHaveLength(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/readbook-reader-mobile.png'});
});
test('scroll position automatically persists and reopens the last paragraph without selecting the book',async({page})=>{
 await add(page);await page.getByLabel('Chế độ đọc').selectOption('continuous');await page.waitForTimeout(1500);
 await page.locator('.paragraph').nth(12).scrollIntoViewIfNeeded();await page.waitForTimeout(900);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('last-progress:local')||'null'));expect(saved.position.paragraph).toBeGreaterThan(8);
 await page.reload();await expect(page.locator('.reading-paper')).toBeVisible();await page.waitForTimeout(500);
 const rect=await page.locator(`.paragraph[data-paragraph="${saved.position.paragraph}"]`).first().boundingBox();expect(rect!.y).toBeLessThan(180);expect(rect!.y+rect!.height).toBeGreaterThan(80);
});
test('automatic progress saving never recreates a deleted local book',async({page})=>{
 await add(page);await page.getByLabel('Chế độ đọc').selectOption('continuous');await page.waitForTimeout(1400);await page.locator('.paragraph').nth(8).scrollIntoViewIfNeeded();await page.waitForTimeout(800);
 await tools(page);await page.getByRole('button',{name:'Chỉnh thông tin sách'}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Xóa sách',exact:true}).click();await expect(page.locator('.reading-paper')).toHaveCount(0);await page.reload();await expect(page.getByRole('heading',{name:'Một cuốn sách. Nhiều cách khám phá.'})).toBeVisible();await expect(page.locator('.book-card')).toHaveCount(0);
});
