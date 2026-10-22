import {openSelection} from './helpers';
import {selectionAction} from './helpers';
import {navigate,openMenu,showTools,hideTools,readyPage} from './helpers';
import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {isDeepStrictEqual} from 'node:util';
const uid='10000000-0000-4000-8000-000000000001',bid='20000000-0000-4000-8000-000000000001';
function backend(){
 const book={id:bid,title:'Sách cloud kiểm thử',author:'',language:'vi',genre:'',hash:'hash',createdAt:'2026-10-21T00:00:00Z',shelf:'reading',approvedChildren:[],position:{chapter:0,paragraph:0},chapters:[{id:'chapter',title:'Chương 1',paragraphs:[{id:'paragraph',text:'Reading books every day.',translations:{}}]}]};
 let state:any={book_id:bid,owner_id:uid,position:{chapter:0,paragraph:0},shelf:'reading',overrides:{},approved_children:[],position_updated_at:'2026-10-21T00:00:00Z'};
 const collections:Record<string,Map<string,unknown>>={vocabulary:new Map(),children:new Map()};let fail=false,gate:Promise<void>|null=null,release:(()=>void)|null=null;
 const personal=()=>({shelf:state.shelf,overrides:state.overrides,approved_children:state.approved_children});
 async function attach(context:BrowserContext){
  await context.addInitScript(({uid})=>{
   const user={id:uid,email:'fixture@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
   const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+86400}))+'.fixture';
   localStorage.setItem('sb-offline-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-refresh',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}));
  },{uid});
  await context.route('https://offline-fixture.supabase.co/**',async route=>{
   if(fail)return route.abort();const request=route.request(),path=new URL(request.url()).pathname;
   if(path.endsWith('/rpc/sync_personal_book_state')&&gate)await gate;
   let json:any=[];
   if(path.endsWith('/books'))json=[{id:bid,owner_id:uid,document:book,revision:1}];
   else if(path.endsWith('/reading_states'))json=[state];
   else if(path.endsWith('/vocabulary')||path.endsWith('/children')){const name=path.split('/').at(-1)!;json=[...collections[name].values()].map(document=>({document}));}
   else if(path.endsWith('/rpc/save_reading_position')){const data=request.postDataJSON();state={...state,position:data.reading_position,position_updated_at:data.recorded_at,last_opened_at:data.recorded_at};json=true;}
   else if(path.endsWith('/rpc/sync_personal_book_state')){const data=request.postDataJSON();const current=personal(),applied=isDeepStrictEqual(current,data.expected_state)||isDeepStrictEqual(current,data.next_state);if(applied)state={...state,...data.next_state};json={applied,document:personal()};}
   else if(path.endsWith('/rpc/sync_collection_document')){const data=request.postDataJSON(),items=collections[data.collection_name],current=items.get(data.item_id)||null,applied=isDeepStrictEqual(current,data.expected_document)||isDeepStrictEqual(current,data.next_document);if(applied){if(data.next_document===null)items.delete(data.item_id);else items.set(data.item_id,data.next_document);}json={applied,document:items.get(data.item_id)||null};}
   return route.fulfill({json,headers:{'Access-Control-Allow-Origin':'*'}});
  });
 }
 return {attach,personal,collections,holdWrites:()=>{gate=new Promise<void>(r=>{release=r;});return ()=>{gate=null;release?.();};},setFail:(v:boolean)=>{fail=v;}};
}
async function open(page:Page){await page.goto('/');const card=page.getByRole('button',{name:/Sách cloud kiểm thử/}),reader=page.locator('.reading-paper:not(.viewport-measure)');await expect.poll(async()=>await card.isVisible()||await reader.isVisible()).toBe(true);if(await card.isVisible())await card.click();await expect(reader).toBeVisible();}
async function note(page:Page,text:string){await selectionAction(page,1,'Ghi chú / bản dịch');await page.getByRole('textbox',{name:'Ghi chú',exact:true}).fill(text);await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();await expect(page.locator('.paragraph-note')).toContainText(text);}
async function settings(page:Page){await page.evaluate(()=>scrollTo(0,0));await navigate(page, 'Thư viện của tôi');await navigate(page, /Cài đặt & kết nối/);}
test('offline notes, manual translation and vocabulary survive reload and then sync',async({page,context})=>{
 const server=backend();await server.attach(context);await open(page);await context.setOffline(true);
 await selectionAction(page,1,'Ghi chú / bản dịch');await page.getByRole('textbox',{name:'Ghi chú',exact:true}).fill('Ghi chú ngoại tuyến');await page.getByRole('textbox',{name:'Bản dịch thủ công'}).fill('Đọc sách mỗi ngày.');await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();
 await openSelection(page,1);await page.getByLabel('Từ muốn lưu').fill('Reading');await page.getByLabel('Nghĩa của từ').fill('Đọc');await page.getByRole('button',{name:'Lưu từ',exact:true}).click();await page.getByRole('button',{name:'Đóng tra từ'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(server.personal().overrides).toEqual({});expect(server.collections.vocabulary.size).toBe(0);
 server.setFail(true);await context.setOffline(false);await page.reload();await expect(page.locator('.paragraph-note')).toContainText('Ghi chú ngoại tuyến');await expect(page.locator('.translated')).toContainText('Đọc sách mỗi ngày.');
 await settings(page);await expect(page.getByRole('region',{name:'Thay đổi chờ đồng bộ'})).toContainText('2 thay đổi chờ gửi');
 server.setFail(false);await page.getByRole('button',{name:'Đồng bộ ngay',exact:true}).click();await expect(page.getByRole('region',{name:'Thay đổi chờ đồng bộ'})).toContainText('Không có thay đổi chờ gửi.');
 expect(server.personal().overrides.paragraph.note).toBe('Ghi chú ngoại tuyến');expect(server.collections.vocabulary.size).toBe(1);
});
test('two devices preserve conflicting notes until the reader explicitly chooses a version',async({browser})=>{
 const server=backend(),a=await browser.newContext(),b=await browser.newContext();try{
 await server.attach(a);await server.attach(b);const p=await a.newPage(),q=await b.newPage();await open(p);await open(q);await b.setOffline(true);
 await note(p,'Bản từ máy thứ nhất');await expect.poll(()=>server.personal().overrides.paragraph?.note).toBe('Bản từ máy thứ nhất');await note(q,'Bản từ máy thứ hai');
 await b.setOffline(false);await settings(q);await q.getByRole('button',{name:'Đồng bộ ngay',exact:true}).click();const panel=q.getByRole('region',{name:'Thay đổi chờ đồng bộ'});await expect(panel).toContainText('1 cần xem lại');await expect(panel).toContainText('Bản từ máy thứ nhất');await expect(panel).toContainText('Bản từ máy thứ hai');
 expect(server.personal().overrides.paragraph.note).toBe('Bản từ máy thứ nhất');
 await q.screenshot({path:'/tmp/readbook-sync-conflict-desktop.png'});await q.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();expect(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await q.screenshot({path:'/tmp/readbook-sync-conflict-mobile.png'});
 await q.getByRole('button',{name:'Giữ bản trên thiết bị',exact:true}).click();await expect(panel).toContainText('Không có thay đổi chờ gửi.');expect(server.personal().overrides.paragraph.note).toBe('Bản từ máy thứ hai');
 }finally{await a.close();await b.close();}
});
test('different field edits merge automatically between devices',async({browser})=>{
 const server=backend(),a=await browser.newContext(),b=await browser.newContext();try{
 await server.attach(a);await server.attach(b);const p=await a.newPage(),q=await b.newPage();await open(p);await open(q);await b.setOffline(true);await note(p,'Ghi chú máy thứ nhất');await expect.poll(()=>server.personal().overrides.paragraph?.note).toBe('Ghi chú máy thứ nhất');
 await selectionAction(q,1,'Tô sáng');await b.setOffline(false);await settings(q);await q.getByRole('button',{name:'Đồng bộ ngay',exact:true}).click();await expect(q.getByRole('region',{name:'Thay đổi chờ đồng bộ'})).toContainText('Không có thay đổi chờ gửi.');expect(server.personal().overrides.paragraph).toMatchObject({note:'Ghi chú máy thứ nhất',highlight:true});
 }finally{await a.close();await b.close();}
});

test('reverting a note while its earlier save is in flight still saves the undo',async({page,context})=>{
 const server=backend();await server.attach(context);await open(page);const release=server.holdWrites();const sent=page.waitForRequest(r=>r.url().endsWith('/rpc/sync_personal_book_state'));
 await note(page,'Ghi chú sẽ hoàn tác');await sent;
 await selectionAction(page,1,'Ghi chú / bản dịch');await page.getByRole('textbox',{name:'Ghi chú',exact:true}).fill('');await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();await expect(page.locator('.paragraph-note')).toHaveCount(0);
 release();await settings(page);await page.getByRole('button',{name:'Đồng bộ ngay',exact:true}).click();await expect(page.getByRole('region',{name:'Thay đổi chờ đồng bộ'})).toContainText('Không có thay đổi chờ gửi.');expect(server.personal().overrides.paragraph?.note).toBeFalsy();
});
test('offline bookmarks and imported translations merge with another device note and reach both devices',async({browser})=>{
 const server=backend(),a=await browser.newContext(),b=await browser.newContext();try{
 await server.attach(a);await server.attach(b);const p=await a.newPage(),q=await b.newPage();await open(p);await open(q);await b.setOffline(true);
 await note(p,'Ghi chú từ thiết bị khác');await expect.poll(()=>server.personal().overrides.paragraph?.note).toBe('Ghi chú từ thiết bị khác');
 await selectionAction(q,1,'Lưu dấu trang');await showTools(q);await q.locator('.translation-panel summary').click();await q.getByRole('button',{name:'Nhập bản dịch có sẵn',exact:true}).click();const dialog=q.getByRole('dialog',{name:'Nhập và căn bản dịch'});await dialog.getByLabel('Nội dung bản dịch',{exact:true}).fill('Bản dịch nhập khi ngoại tuyến.');await dialog.getByRole('button',{name:'Đối chiếu bản dịch',exact:true}).click();await dialog.getByLabel('Tôi đã đối chiếu và đồng ý lưu các đoạn đã ghép').check();await dialog.getByRole('button',{name:'Lưu bản dịch đã ghép',exact:true}).click();
 await b.setOffline(false);await settings(q);await q.getByRole('button',{name:'Đồng bộ ngay',exact:true}).click();await expect(q.getByRole('region',{name:'Thay đổi chờ đồng bộ'})).toContainText('Không có thay đổi chờ gửi.');expect(server.personal().overrides.paragraph).toMatchObject({note:'Ghi chú từ thiết bị khác',bookmarks:{'0':{offset:0}},translations:{en:{text:'Bản dịch nhập khi ngoại tuyến.',provider:'import',locked:true}}});
 await p.reload();await readyPage(p);await showTools(p);await p.getByLabel('Kiểu đọc',{exact:true}).selectOption('interleaved');await hideTools(p);await readyPage(p);await expect(p.locator('.reading-paper:not(.viewport-measure) .translated')).toContainText('Bản dịch nhập khi ngoại tuyến.');await showTools(p);await p.getByRole('button',{name:'Dấu trang',exact:true}).click();await expect(p.getByRole('region',{name:'Dấu trang của bạn'}).locator('.saved-bookmark')).toHaveCount(1);
 }finally{await a.close();await b.close();}
});
