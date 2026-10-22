import {expect,type Page} from '@playwright/test';
export async function openMenu(page:Page){if(!await page.locator('.sidebar').evaluate(el=>el.classList.contains('open')))await page.getByRole('button',{name:'Mở menu',exact:true}).click();await expect(page.locator('.sidebar')).toBeVisible();await expect(page.locator('.sidebar')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');}
export async function navigate(page:Page,name:string|RegExp){await openMenu(page);await page.locator('.sidebar nav').getByRole('button',{name,exact:typeof name==='string'}).click();}
export async function showTools(page:Page){const button=page.getByRole('button',{name:'Hiện công cụ',exact:true});if(await button.isVisible())await button.click();}
export async function hideTools(page:Page){const button=page.getByRole('button',{name:'Ẩn công cụ',exact:true});if(await button.isVisible())await button.click();}
export async function readyPage(page:Page){await expect(page.locator('.reading-paper:not(.viewport-measure)')).toBeVisible();await expect(page.locator('.reading-paper:not(.viewport-measure)')).toHaveAttribute('aria-busy','false');}
export async function openSelection(page:Page,paragraph:number,offset=0){
 await readyPage(page);await expect(page.locator('.overlay')).toHaveCount(0);
 const source=page.locator(`.reading-paper:not(.viewport-measure) [data-paragraph="${paragraph-1}"] [data-reading-source]`).first();
 await source.evaluate((el,offset)=>{const text=el.firstChild!;const range=document.createRange();const start=Math.min(offset,Math.max(0,text.textContent!.length-1));range.setStart(text,start);range.setEnd(text,Math.min(text.textContent!.length,start+Math.min(12,text.textContent!.length-start)));const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);},offset);
 const popup=page.getByRole('dialog',{name:'Dịch và lưu từ'});await expect(popup).toBeVisible();return popup;
}
export async function selectionAction(page:Page,paragraph:number,name:string,offset=0){
 const popup=await openSelection(page,paragraph,offset);await popup.getByRole('button',{name,exact:true}).click();
 if(name==='Lưu dấu trang')await expect(page.locator('.toast')).toContainText('Đã lưu dấu trang');
 if(['Lưu dấu trang','Lưu vị trí đọc','Tô sáng'].includes(name))await popup.getByRole('button',{name:'Đóng tra từ',exact:true}).click();
}
