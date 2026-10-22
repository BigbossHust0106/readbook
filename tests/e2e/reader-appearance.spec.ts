import {test,expect,type Page} from '@playwright/test';
import {readyPage,showTools,hideTools} from './helpers';
async function open(page:Page,production=false){await page.setViewportSize({width:390,height:844});await page.goto(production?'http://127.0.0.1:8787':'/');await page.getByRole('button',{name:'Thêm sách',exact:true}).click();await page.getByLabel('Nội dung sách').fill('Những trang sách mở ra một thế giới. Ấm áp giữa buổi chiều yên tĩnh. '.repeat(220));await page.getByRole('textbox',{name:'Tên sách',exact:true}).fill('Màu giấy và nét chữ');await page.getByRole('button',{name:'Nhập & lưu sách',exact:true}).click();await page.getByRole('button',{name:/Màu giấy và nét chữ/}).click();await readyPage(page);}
async function anchor(page:Page){return page.locator('.reading-paper:not(.viewport-measure) [data-fragment-start]').first().evaluate(el=>({chapter:el.getAttribute('data-chapter'),paragraph:el.getAttribute('data-paragraph'),offset:el.getAttribute('data-fragment-start')}));}
async function fits(page:Page){expect(await page.locator('.reading-paper:not(.viewport-measure)').evaluate(el=>{const last=el.lastElementChild;return !!last&&last.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom+3;})).toBe(true);}
test('new Vietnamese fonts fit the saved anchor and persist across production offline reload',async({page,context})=>{
 await open(page,true);await page.getByRole('button',{name:'Trang sau',exact:true}).click();await readyPage(page);const position=await anchor(page);
 for(const [value,family] of [['noto-serif','Noto Serif'],['lora','Lora'],['be-vietnam','Be Vietnam Pro']]){
  await showTools(page);await page.getByLabel('Phông chữ đọc').selectOption(value);await hideTools(page);await readyPage(page);expect(await anchor(page)).toEqual(position);await fits(page);
  expect(await page.evaluate(family=>[...document.fonts].some(f=>f.family.replaceAll('"','')===family&&f.status==='loaded'&&f.unicodeRange.includes('U+102')),family)).toBe(true);
  await expect(page.locator('.reading-paper:not(.viewport-measure)')).toHaveCSS('--reader-font',new RegExp(family));
 }
 await showTools(page);await page.getByRole('button',{name:'Màu giấy Xanh lam nhạt',exact:true}).click();await hideTools(page);await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await readyPage(page);await context.setOffline(true);await page.reload();await readyPage(page);await expect(page.locator('.reader')).toHaveClass(/theme-mist/);await expect(page.locator('.reading-paper:not(.viewport-measure)')).toHaveCSS('--reader-font',/Be Vietnam Pro/);expect(await page.evaluate(()=>document.fonts.check('20px "Be Vietnam Pro"','Tiếng Việt ấ ơ ư đ'))).toBe(true);expect(await anchor(page)).toEqual(position);await fits(page);
});
test('all paper colors preview immediately and the selection survives reloading',async({page})=>{
 await open(page);await showTools(page);await expect(page.getByLabel('Phông chữ đọc').locator('option')).toHaveCount(6);await expect(page.getByLabel('Nền đọc',{exact:true}).locator('option')).toHaveCount(8);
 for(const [id,name,color] of [['cream','Kem ấm','rgb(250, 241, 223)'],['sage','Xanh lá nhạt','rgb(234, 241, 229)'],['mist','Xanh lam nhạt','rgb(232, 240, 245)'],['rose','Hồng nhạt','rgb(246, 233, 230)'],['midnight','Xanh đêm','rgb(21, 33, 44)']]){
  await page.getByRole('button',{name:`Màu giấy ${name}`,exact:true}).click();await expect(page.getByLabel('Nền đọc',{exact:true})).toHaveValue(id);await expect(page.locator('.reader')).toHaveCSS('background-color',color);await expect(page.getByRole('button',{name:`Màu giấy ${name}`,exact:true})).toHaveAttribute('aria-pressed','true');
 }
 await page.getByLabel('Phông chữ đọc').selectOption('lora');await page.screenshot({path:'/tmp/readbook-fonts-paper-palette.png'});await hideTools(page);await readyPage(page);await page.reload();await readyPage(page);await expect(page.locator('.reader')).toHaveClass(/theme-midnight/);await expect(page.locator('.reading-paper:not(.viewport-measure)')).toHaveCSS('--reader-font',/Lora/);await fits(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
