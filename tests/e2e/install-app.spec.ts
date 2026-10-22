import {test,expect,type Page} from '@playwright/test';
import {openMenu,navigate,readyPage} from './helpers';
const android='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
async function showInstall(page:Page){await openMenu(page);await page.locator('.sidebar nav').getByRole('button',{name:'Cài đặt ứng dụng',exact:true}).click();return page.getByRole('dialog',{name:'Cài đặt ứng dụng',exact:true});}
async function offer(page:Page,result:'accepted'|'dismissed'|'error'){
 return page.evaluate(result=>{
  (window as any).installCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});
  Object.assign(event,{prompt:()=>{(window as any).installCalls++;return result==='error'?Promise.reject(new Error('Not available')):Promise.resolve();},userChoice:Promise.resolve({outcome:result})});
  window.dispatchEvent(event);return event.defaultPrevented;
 },result);
}
test('Android reader menu offers installation on demand and confirms only after appinstalled',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},userAgent:android});const page=await context.newPage();await page.goto('/');
 await page.getByRole('button',{name:'Thêm sách',exact:true}).click();await page.getByLabel('Nội dung sách').fill('Đọc sách trên điện thoại.');await page.getByRole('textbox',{name:'Tên sách',exact:true}).fill('Sách cài app');await page.getByRole('button',{name:'Nhập & lưu sách',exact:true}).click();await page.getByRole('button',{name:/Sách cài app/}).click();await readyPage(page);
 expect(await offer(page,'accepted')).toBe(true);expect(await page.evaluate(()=>(window as any).installCalls)).toBe(0);const dialog=await showInstall(page);await dialog.getByRole('button',{name:'Cài Lá sách',exact:true}).click();await expect(dialog).toContainText('Đã xác nhận yêu cầu cài');expect(await page.evaluate(()=>(window as any).installCalls)).toBe(1);await expect(dialog.getByText('Lá sách đã được cài',{exact:false})).toHaveCount(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await expect(dialog).toContainText('Lá sách đã được cài');await expect(dialog.getByRole('button',{name:'Cài Lá sách',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Đóng',exact:true}).click();await expect(page.locator('[data-reading-source]')).toContainText('Đọc sách trên điện thoại.');await context.close();
});
test('iPhone shows Safari home-screen steps without a fake install button',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},userAgent:iphone});const page=await context.newPage();await page.goto('/');const dialog=await showInstall(page);await expect(dialog).toContainText('iPhone / iPad · Safari');await expect(dialog).toContainText('Chia sẻ');await expect(dialog).toContainText('Thêm vào MH chính');await expect(dialog.getByRole('button',{name:'Cài Lá sách',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/readbook-install-iphone.png'});await context.close();
});
for(const result of ['dismissed','error'] as const)test(`a ${result} install can be retried after a new browser offer`,async({page})=>{
 await page.goto('/');const dialog=await showInstall(page);await offer(page,result);await dialog.getByRole('button',{name:'Cài Lá sách',exact:true}).click();await expect(dialog).toContainText(result==='dismissed'?'Bạn đã đóng hộp thoại':'Chưa mở được hộp thoại');await expect(dialog.getByRole('button',{name:'Cài Lá sách',exact:true})).toHaveCount(0);await expect(dialog).toContainText('Thêm vào màn hình chính');await offer(page,'accepted');await dialog.getByRole('button',{name:'Cài Lá sách',exact:true}).click();await expect(dialog).toContainText('Đã xác nhận yêu cầu cài');expect(await page.evaluate(()=>(window as any).installCalls)).toBe(1);
});
test('installed app settings show its status instead of another installation action',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));await page.goto('/');await navigate(page,'Cài đặt & kết nối');const panel=page.locator('.panel').filter({has:page.getByRole('heading',{name:'Cài đặt ứng dụng',exact:true})});await expect(panel).toContainText('Lá sách đã được cài');await expect(panel.getByRole('button',{name:'Cài Lá sách',exact:true})).toHaveCount(0);
});
test('production provides real PNG install icons, Apple metadata and offline installation help',async({page,context})=>{
 await page.goto('http://127.0.0.1:8787');await expect(page.getByRole('button',{name:'Mở menu',exact:true})).toBeVisible();await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 const result=await page.evaluate(async()=>{const manifest=await(await fetch('/manifest.webmanifest')).json();const icons=await Promise.all(manifest.icons.filter((i:any)=>i.type==='image/png').map(async(i:any)=>{const img=new Image();img.src=i.src;await img.decode();return {declared:i.sizes,width:img.naturalWidth,height:img.naturalHeight};}));const apple=document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')!;const img=new Image();img.src=apple.href;await img.decode();return {display:manifest.display,scope:manifest.scope,icons,apple:img.naturalWidth};});
 expect(result).toEqual({display:'standalone',scope:'/',icons:[{declared:'192x192',width:192,height:192},{declared:'512x512',width:512,height:512}],apple:180});await context.setOffline(true);await page.reload();const dialog=await showInstall(page);await expect(dialog).toContainText('Đưa Lá sách lên màn hình chính');expect(await dialog.locator('img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth===192)).toBe(true);
});
