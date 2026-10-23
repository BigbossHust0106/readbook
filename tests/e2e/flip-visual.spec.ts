import {test,expect,type Page} from '@playwright/test';
import {readyPage,showTools,hideTools} from './helpers';
async function setup(page:Page){
 await page.addInitScript(()=>{const original=Element.prototype.attachShadow;(window as any).flipRoots=new Map();Element.prototype.attachShadow=function(options){const root=original.call(this,options);(window as any).flipRoots.set(this,root);return root;};});
 await page.goto('http://127.0.0.1:8787');await page.getByRole('button',{name:'Thêm sách',exact:true}).click();await page.getByLabel('Nội dung sách').fill(Array.from({length:120},(_,i)=>`Đoạn ${i+1}. Những trang sách đưa ta đi xa. Chữ trên giấy phải lật cùng trang sách thật. `).join('\n\n'));await page.getByRole('textbox',{name:'Tên sách',exact:true}).fill('Kiểm tra hoạt ảnh');await page.getByRole('button',{name:'Nhập & lưu sách',exact:true}).click();await page.getByRole('button',{name:/Kiểm tra hoạt ảnh/}).click();await readyPage(page);
}
for(const mobile of [false,true])test(`real painted paper moves during ${mobile?'touch tap':'mouse click'}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:mobile?390:626,height:986},isMobile:mobile,hasTouch:mobile});try{const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);const rect=(await page.locator('.reading-paper:not(.viewport-measure)').boundingBox())!;
 for(const direction of ['forward','backward'] as const){
 const x=direction==='forward'?rect.x+rect.width-30:rect.x+25;
 if(mobile)await page.touchscreen.tap(x,rect.y+200);else await page.mouse.click(x,rect.y+200);
 const samples=[];
 for(let i=0;i<8;i++){if(i===3)await page.screenshot({path:`/tmp/readbook-real-fold-${mobile?'touch':'mouse'}-${direction}.png`});samples.push(await page.evaluate(()=>{const layer=document.querySelector('.page-turn-overlay'),root=(window as any).flipRoots.get(layer) as ShadowRoot|undefined;return Array.from(root?.querySelectorAll<HTMLElement>('.stf__item')||[]).map(n=>({display:getComputedStyle(n).display,transform:getComputedStyle(n).transform,clip:getComputedStyle(n).clipPath,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}));}));await page.waitForTimeout(65);}
 const moving=samples.flatMap(s=>s.filter(n=>n.display!=='none'&&n.width>0&&n.height>0&&n.clip.startsWith('polygon(')).map(n=>n.transform));expect(new Set(moving).size).toBeGreaterThan(2);expect(errors).toEqual([]);await expect(page.locator('.page-turn-overlay')).toHaveCount(0);
 }

 }finally{await context.close();}
});

for(const width of [390,626,1280])test(`hidden page controls give their bottom space back at width ${width}`,async({page})=>{
 await page.setViewportSize({width,height:986});await setup(page);await showTools(page);await page.getByLabel('Hiện nút chuyển trang',{exact:true}).uncheck();await hideTools(page);await readyPage(page);
 for(let i=0;i<3;i++){
 const data=await page.evaluate(()=>{const paper=document.querySelector('.reading-paper:not(.viewport-measure)')!,footer=document.querySelector('.reader-page-status')!,texts=paper.querySelectorAll('[data-reading-source]'),last=texts[texts.length-1],range=document.createRange();range.selectNodeContents(last);const pr=paper.getBoundingClientRect(),fr=footer.getBoundingClientRect();return {frameGap:fr.top-pr.bottom,textGap:fr.top-range.getBoundingClientRect().bottom,leading:parseFloat(getComputedStyle(last).lineHeight),right:innerWidth-fr.right,footerLeft:fr.left,paperBottom:pr.bottom};});
 expect(data.frameGap).toBeGreaterThanOrEqual(0);expect(data.frameGap).toBeLessThan(5);expect(data.textGap).toBeLessThan(data.leading*1.6+15);expect(data.right).toBeLessThanOrEqual(12);expect(data.footerLeft).toBeGreaterThan(width*.7);
 await page.keyboard.press('ArrowRight');await expect(page.locator('.page-turn-overlay')).toHaveCount(0);
 }
 await page.screenshot({path:`/tmp/readbook-full-height-${width}.png`});
});

test('an animation frame timestamp before construction does not stop the renderer',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{const path='/src/vendor/pageFlip.js';const {PageFlip}=await import(/* @vite-ignore */ path);const root=document.createElement('div');root.style.cssText='position:fixed;left:0;top:0;width:320px;height:600px';document.body.append(root);const engine=new PageFlip(root,{width:320,height:600,size:'fixed',usePortrait:true,autoSize:false,useMouseEvents:false});
 try{engine.loadFromHTML([document.createElement('div'),document.createElement('div')]);engine.flipNext('bottom');const state=engine.getState();engine.getRender().render(performance.now()-100);return {state,error:null};}catch(error){return {state:engine.getState(),error:String(error)};}finally{engine.destroy();root.remove();}});expect(result).toEqual({state:'flipping',error:null});
});
