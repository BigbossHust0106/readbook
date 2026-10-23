import {test,expect,type Page} from '@playwright/test';
import {readyPage,openSelection,openMenu} from './helpers';
async function add(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'Thêm sách',exact:true}).click();await page.getByLabel('Nội dung sách').fill('Reading books opens new worlds.');await page.getByRole('textbox',{name:'Tên sách',exact:true}).fill('DeepL reader');await page.getByLabel('Ngôn ngữ nguyên bản').selectOption('en');await page.getByRole('button',{name:'Nhập & lưu sách',exact:true}).click();await page.getByRole('button',{name:/DeepL reader/}).click();await readyPage(page);
}
const capabilities={configured:true,provider:'DeepL',pairs:[{source:'en',targets:['vi']}],reason:'DeepL API chính thức.'};
test('mobile lookup ignores old Google cache and native translator, then reuses successful DeepL cache',async({page})=>{
 await page.setViewportSize({width:390,height:844});let calls=0;
 await page.addInitScript(()=>{Reflect.set(window,'Translator',{availability:async()=> 'available',create:async()=>({translate:async()=> 'Wrong native translation',destroy:()=>{}})});});
 await page.route('**/api/capabilities',r=>r.fulfill({json:capabilities}));await page.route('**/api/translate',r=>{calls++;return r.fulfill({json:{text:'Đọc sách',provider:'DeepL'}});});
 await add(page);
 await page.evaluate(async()=>{const path='/src/store.ts';const store=await import(/* @vite-ignore */ path);for(const key of ['word-lookup:en:vi:reading book','word-lookup:google:en:vi:reading book','word-lookup:Google Translate:en:vi:reading book'])await store.setSetting(key,{text:'Wrong old Google translation',provider:'Google Translate',at:Date.now()});});
 let popup=await openSelection(page,1);await expect(popup.getByLabel('Nghĩa của từ')).toHaveValue('Đọc sách');expect(calls).toBe(1);await expect(popup).toContainText('DeepL');await popup.getByRole('button',{name:'Đóng tra từ'}).click();
 await page.evaluate(()=>getSelection()?.removeAllRanges());popup=await openSelection(page,1);await expect(popup.getByLabel('Nghĩa của từ')).toHaveValue('Đọc sách');expect(calls).toBe(1);
 await popup.getByLabel('Nghĩa của từ').fill('Nghĩa tôi tự sửa');await popup.getByRole('button',{name:'Lưu từ',exact:true}).click();await expect(popup).toContainText('Đã lưu từ');await page.screenshot({path:'/tmp/readbook-deepl-mobile.png'});
});
test('missing DeepL key is visible in settings and selection lookup, while manual meanings remain usable',async({page})=>{
 await page.route('**/api/capabilities',r=>r.fulfill({json:{configured:false,provider:'DeepL',pairs:[],reason:'Chưa cấu hình DeepL. Thêm Secret DEEPL_API_KEY trong Cloudflare Worker readbook, rồi lưu và triển khai.'}}));
 await page.route('**/api/translate',r=>r.fulfill({status:503,json:{error:'Chưa cấu hình DeepL. Thêm Secret DEEPL_API_KEY trong Cloudflare Worker readbook, rồi lưu và triển khai.',code:'DEEPL_NOT_CONFIGURED'}}));
 await add(page);const popup=await openSelection(page,1);await expect(popup).toContainText('DEEPL_API_KEY');await popup.getByLabel('Nghĩa của từ').fill('Nghĩa tự nhập');await popup.getByRole('button',{name:'Thử dịch lại',exact:true}).click();await expect(popup).toContainText('DEEPL_API_KEY');await expect(popup.getByLabel('Nghĩa của từ')).toHaveValue('Nghĩa tự nhập');await popup.getByRole('button',{name:'Lưu từ',exact:true}).click();await expect(popup).toContainText('Đã lưu từ');await popup.getByRole('button',{name:'Đóng tra từ'}).click();
 await openMenu(page);await page.locator('.sidebar nav').getByRole('button',{name:'Cài đặt & kết nối',exact:true}).click();await expect(page.getByRole('heading',{name:'DeepL · dịch trong trình đọc'})).toBeVisible();await expect(page.getByText('Chưa cấu hình DeepL.',{exact:false})).toBeVisible();
});
