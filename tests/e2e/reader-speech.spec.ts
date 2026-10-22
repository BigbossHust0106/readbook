import {selectionAction} from './helpers';
import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {showTools,hideTools,readyPage} from './helpers';
async function add(page:Page,text='Đọc sách mỗi ngày. '.repeat(25)){
 await page.goto('/');await page.getByRole('button',{name:'Thêm sách',exact:true}).click();await page.getByLabel('Nội dung sách').fill(text);await page.getByRole('textbox',{name:'Tên sách',exact:true}).fill('Sách giọng đọc');await page.getByRole('button',{name:'Nhập & lưu sách',exact:true}).click();await page.getByRole('button',{name:/Sách giọng đọc/}).click();await readyPage(page);
}
test('page button visibility is a separate persisted control; hidden buttons leave arrow navigation working',async({page})=>{
 await add(page,'Đọc sách mỗi ngày. '.repeat(160));await showTools(page);await expect(page.getByLabel('Số ký tự mỗi trang')).toHaveCount(0);await page.getByLabel('Hiện nút chuyển trang',{exact:true}).uncheck();await expect(page.getByRole('navigation',{name:'Lật trang'})).toHaveCount(0);await expect(page.getByLabel('Chiều rộng trang',{exact:true})).toHaveCount(0);await hideTools(page);
 await page.keyboard.press('ArrowRight');await expect(page.locator('.reader-page-status')).toContainText('Trang 2/');await page.reload();await readyPage(page);await expect(page.getByRole('navigation',{name:'Lật trang'})).toHaveCount(0);
 await showTools(page);await expect(page.getByLabel('Hiện nút chuyển trang',{exact:true})).not.toBeChecked();await page.getByLabel('Hiện nút chuyển trang',{exact:true}).check();await hideTools(page);await expect(page.getByRole('button',{name:'Trang sau',exact:true})).toBeVisible();
});
test('phone users can show page buttons or hide them and swipe',async({page})=>{
 await page.setViewportSize({width:390,height:844});await add(page,'Đọc sách mỗi ngày. '.repeat(120));await expect(page.getByRole('button',{name:'Trang sau',exact:true})).toBeVisible();await showTools(page);await page.getByLabel('Hiện nút chuyển trang',{exact:true}).uncheck();await hideTools(page);
 const paper=page.locator('.reading-paper:not(.viewport-measure)');await paper.dispatchEvent('pointerdown',{pointerType:'touch',clientX:300,clientY:300});await paper.dispatchEvent('pointerup',{pointerType:'touch',clientX:60,clientY:305});await expect(page.locator('.reader-page-status')).toContainText('Trang 2/');
});
test('online paragraph reading decodes real MP3, pauses, resumes and cancels the queue',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const bytes=await readFile('tests/fixtures/speech-vi.mp3'),sent:{text:string;language:string}[]=[];
 await page.route('**/api/speech',route=>{sent.push(route.request().postDataJSON());return route.fulfill({body:bytes,contentType:'audio/mpeg'});});
 await add(page);await selectionAction(page,1,'Nghe phần chọn');
 const player=page.getByRole('region',{name:'Trình phát đọc sách'}),audio=page.locator('.speech-player audio');await expect(player).toBeVisible();await expect.poll(()=>audio.evaluate((node:HTMLAudioElement)=>node.currentTime)).toBeGreaterThan(0);await expect(player).toContainText('Đang phát giọng đọc.');
 await player.getByRole('button',{name:'Tạm dừng nghe',exact:true}).click();await expect.poll(()=>audio.evaluate((node:HTMLAudioElement)=>node.paused)).toBe(true);await player.getByRole('button',{name:'Tiếp tục nghe',exact:true}).click();await expect.poll(()=>audio.evaluate((node:HTMLAudioElement)=>node.paused)).toBe(false);
 expect(sent[0].language).toBe('vi');expect(Array.from(sent[0].text).length).toBeLessThanOrEqual(180);await player.getByRole('button',{name:'Dừng nghe',exact:true}).click();await expect(player).toBeHidden();expect(await audio.getAttribute('src')).toBeNull();
});
test('quota and audio errors stay visible and retryable without affecting the book',async({page})=>{
 const bytes=await readFile('tests/fixtures/speech-vi.mp3');let calls=0;
 await page.route('**/api/speech',route=>++calls===1?route.fulfill({status:429,json:{error:'Nguồn giọng đọc đang giới hạn lượt.'}}):route.fulfill({body:bytes,contentType:'audio/mpeg'}));
 await add(page,'Đọc sách mỗi ngày.');await page.getByRole('button',{name:'Nghe trang đang đọc',exact:true}).click();const player=page.getByRole('region',{name:'Trình phát đọc sách'});await expect(player).toContainText('giới hạn lượt');expect(calls).toBe(1);await player.getByRole('button',{name:'Thử đọc lại',exact:true}).click();await expect(player).toContainText('Đang phát giọng đọc.');await expect(page.locator('[data-reading-source]')).toContainText('Đọc sách mỗi ngày.');
});
test('device reading waits for voices, chooses Vietnamese and retains chunk order',async({page})=>{
 await page.addInitScript(()=>{
  const events=new EventTarget(),spoken:any[]=[];let voices:any[]=[];
  const synthesis={getVoices:()=>voices,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),cancel:()=>{},pause:()=>{},resume:()=>{},speak:(u:any)=>{spoken.push(u);u.onstart?.();}};
  Object.defineProperty(window,'speechSynthesis',{value:synthesis,configurable:true});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(public text:string){}},configurable:true});
  (window as any).provideVoices=()=>{voices=[{voiceURI:'English',name:'English',lang:'en-US',default:true},{voiceURI:'Vietnamese',name:'Vietnamese',lang:'vi-VN',default:false}];events.dispatchEvent(new Event('voiceschanged'));};
  (window as any).spoken=spoken;(window as any).finishSpeech=()=>spoken.at(-1)?.onend?.();
 });
 let sent=0;await page.route('**/api/speech',route=>{sent++;return route.abort();});const text='Một cuốn sách mở ra thế giới. '.repeat(18).trim();await add(page,text);await showTools(page);await page.getByLabel('Nguồn giọng đọc',{exact:true}).selectOption('device');await hideTools(page);await page.getByRole('button',{name:'Nghe trang đang đọc',exact:true}).click();await page.evaluate(()=>(window as any).provideVoices());const player=page.getByRole('region',{name:'Trình phát đọc sách'});await expect(player).toContainText('Đang phát giọng đọc.');expect(await page.evaluate(()=>(window as any).spoken[0].voice.lang)).toBe('vi-VN');
 for(let i=0;i<20;i++){if(await player.isHidden())break;await page.evaluate(()=>(window as any).finishSpeech());}
 await expect(player).toBeHidden();expect(await page.evaluate(()=>(window as any).spoken.map((u:any)=>u.text).join(''))).toBe(text);expect(sent).toBe(0);
});

test('a device with no Vietnamese voice gets a clear error and sends no text online',async({page})=>{
 await page.addInitScript(()=>{const events=new EventTarget();Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),cancel:()=>{},resume:()=>{}},configurable:true});});
 let sent=0;await page.route('**/api/speech',route=>{sent++;return route.abort();});await add(page,'Đọc sách mỗi ngày.');await showTools(page);await page.getByLabel('Nguồn giọng đọc',{exact:true}).selectOption('device');await hideTools(page);await selectionAction(page,1,'Nghe phần chọn');
 const player=page.getByRole('region',{name:'Trình phát đọc sách'});await expect(player).toContainText('Thiết bị chưa có giọng');await expect(player.getByRole('button',{name:'Thử đọc lại',exact:true})).toBeEnabled();expect(sent).toBe(0);
});
test('an autoplay restriction keeps audio ready for an explicit play action',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLMediaElement.prototype.play;let first=true;HTMLMediaElement.prototype.play=function(){if(first){first=false;return Promise.reject(new DOMException('Gesture required','NotAllowedError'));}return original.call(this);};});
 const bytes=await readFile('tests/fixtures/speech-vi.mp3');await page.route('**/api/speech',route=>route.fulfill({body:bytes,contentType:'audio/mpeg'}));await add(page,'Đọc sách mỗi ngày.');await page.getByRole('button',{name:'Nghe trang đang đọc',exact:true}).click();const player=page.getByRole('region',{name:'Trình phát đọc sách'});await expect(player).toContainText('Bấm Phát');await player.getByRole('button',{name:'Tiếp tục nghe',exact:true}).click();await expect(player).toContainText('Đang phát giọng đọc.');
});
