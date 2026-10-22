import {navigate,openMenu,showTools,hideTools,readyPage} from './helpers';
import {test,expect,type Page} from '@playwright/test';
async function add(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'Thêm sách',exact:true}).click();
 await page.getByLabel('Nội dung sách').fill('Chương 1\n\n'+Array.from({length:30},(_,i)=>`Đoạn ${i+1}. Reading books opens new worlds. `.repeat(10)).join('\n\n')+'\n\nChương 2\n\nNội dung tiếp theo.');
 await page.getByRole('textbox',{name:'Tên sách',exact:true}).fill('Đọc mọi lúc');
 await page.getByRole('button',{name:'Nhập & lưu sách',exact:true}).click();await page.getByRole('button',{name:/Đọc mọi lúc/}).click();
}
async function tools(page:Page){const show=page.getByRole('button',{name:'Hiện công cụ',exact:true});if(await show.isVisible())await show.click();}
async function firstWord(page:Page){return page.locator('[data-reading-source]').first().evaluate(el=>{const r=document.createRange();r.setStart(el.firstChild!,0);r.setEnd(el.firstChild!,4);const b=r.getBoundingClientRect();return {x:b.left+4,y:b.top+b.height/2};});}
test('scroll position automatically persists and reopens the last paragraph without selecting the book',async({page})=>{
 await add(page);await showTools(page);await page.getByLabel('Chế độ đọc').selectOption('continuous');await page.waitForTimeout(1500);
 await page.locator('.paragraph').nth(12).scrollIntoViewIfNeeded();await page.waitForTimeout(900);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('last-progress:local')||'null'));expect(saved.position.paragraph).toBeGreaterThan(8);
 await page.reload();await expect(page.locator('.reading-paper:not(.viewport-measure)')).toBeVisible();await page.waitForTimeout(500);
 const rect=await page.locator(`.paragraph[data-paragraph="${saved.position.paragraph}"]`).first().boundingBox();expect(rect!.y).toBeLessThan(180);expect(rect!.y+rect!.height).toBeGreaterThan(80);
});
test('automatic progress saving never recreates a deleted local book',async({page})=>{
 await add(page);await showTools(page);await page.getByLabel('Chế độ đọc').selectOption('continuous');await page.waitForTimeout(1400);await page.locator('.paragraph').nth(8).scrollIntoViewIfNeeded();await page.waitForTimeout(800);
 await tools(page);await showTools(page);await page.getByRole('button',{name:'Chỉnh thông tin sách'}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Xóa sách',exact:true}).click();await expect(page.locator('.reading-paper:not(.viewport-measure)')).toHaveCount(0);await page.reload();await expect(page.getByRole('heading',{name:'Một cuốn sách. Nhiều cách khám phá.'})).toBeVisible();await expect(page.locator('.book-card')).toHaveCount(0);
});
test('full-book search jumps to a later chapter; reader typography persists',async({page})=>{
 await add(page);await showTools(page);await page.getByLabel('Phông chữ đọc').selectOption('serif');await page.getByLabel('Khoảng dòng',{exact:true}).fill('2.2');
 await page.getByRole('button',{name:'Tìm trong sách',exact:true}).click();await page.getByLabel('Tìm trong toàn sách').fill('noi dung tiep theo');await expect(page.locator('.book-search-results')).toContainText('Nội dung tiếp theo.');await page.locator('.book-search-results .flyout-item').click();await readyPage(page);await expect(page.locator('.reading-paper:not(.viewport-measure)')).toContainText('Nội dung tiếp theo.');
 await page.reload();await expect(page.locator('.reading-paper:not(.viewport-measure)')).toContainText('Nội dung tiếp theo.');
 const show=page.getByRole('button',{name:'Hiện công cụ',exact:true});if(await show.isVisible())await show.click();
 await expect(page.getByLabel('Phông chữ đọc')).toHaveValue('serif');await expect(page.getByLabel('Khoảng dòng',{exact:true})).toHaveValue('2.2');
 const paper=page.locator('.reading-paper:not(.viewport-measure)');expect(await paper.evaluate(el=>getComputedStyle(el).maxWidth)).toBe('none');expect(await page.locator('.reading-paper p').first().evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Georgia');
});
