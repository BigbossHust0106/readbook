import {expect,type Page} from '@playwright/test';
export async function openMenu(page:Page){if(!await page.locator('.sidebar').evaluate(el=>el.classList.contains('open')))await page.getByRole('button',{name:'Mở menu',exact:true}).click();await expect(page.locator('.sidebar')).toBeVisible();await expect(page.locator('.sidebar')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');}
export async function navigate(page:Page,name:string|RegExp){await openMenu(page);await page.locator('.sidebar nav').getByRole('button',{name,exact:typeof name==='string'}).click();}
export async function showTools(page:Page){const button=page.getByRole('button',{name:'Hiện công cụ',exact:true});if(await button.isVisible())await button.click();}
export async function hideTools(page:Page){const button=page.getByRole('button',{name:'Ẩn công cụ',exact:true});if(await button.isVisible())await button.click();}
export async function readyPage(page:Page){await expect(page.locator('.reading-paper:not(.viewport-measure)')).toBeVisible();await expect(page.locator('.reading-paper:not(.viewport-measure)')).toHaveAttribute('aria-busy','false');}
