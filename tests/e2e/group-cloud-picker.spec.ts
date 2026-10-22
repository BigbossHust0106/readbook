import {test,expect,type BrowserContext} from '@playwright/test';
import {navigate} from './helpers';
const uid='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',gid='30000000-0000-4000-8000-000000000001';
const ids=[1,2,3,4,5].map(i=>`20000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
async function backend(context:BrowserContext,failSecond=false){
 const titles=['Sách cá nhân thứ nhất','Sách cá nhân thứ hai','Sách từ nhóm khác','Bản riêng cùng nội dung','Bản đã có trong nhóm'];
 const books=ids.map((id,i)=>({id,owner_id:i===2||i===4?other:uid,revision:1,document:{id,title:titles[i],author:'Tác giả',language:'vi',genre:'',hash:i===4?'hash-3':`hash-${i}`,createdAt:'2026-10-21T00:00:00Z',shelf:'reading',approvedChildren:[],position:{chapter:0,paragraph:0},chapters:[{id:`c-${i}`,title:'Nội dung',paragraphs:[{id:`p-${i}`,text:'Nguyên văn giữ nguyên.',translations:{}}]}]}}));
 const shared=[ids[4]],calls:string[]=[];let unexpectedWrites=0;
 await context.addInitScript(({uid})=>{const user={id:uid,email:'fixture@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()},token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+86400}))+'.fixture';localStorage.setItem('sb-offline-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-refresh',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}));},{uid});
 await context.route('https://offline-fixture.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let json:unknown=[];
  if(path.endsWith('/rpc/reading_group_book_ratings'))json=[];
  else if(path.endsWith('/rpc/add_group_book')){const data=req.postDataJSON();calls.push(data.bid);expect(data.gid).toBe(gid);if(failSecond&&data.bid===ids[1])return route.fulfill({status:400,json:{code:'P0001',message:'Lỗi thử nghiệm ở sách thứ hai'}});const row=books.find(b=>b.id===data.bid)!;expect(row.owner_id).toBe(uid);const match=shared.find(id=>books.find(b=>b.id===id)!.document.hash===row.document.hash);if(!match)shared.push(data.bid);json=match||data.bid;}
  else if(req.method()!=='GET'){unexpectedWrites++;return route.fulfill({status:400,json:{message:'Unexpected write'}});}
  else if(path.endsWith('/books'))json=books;
  else if(path.endsWith('/reading_groups'))json=[{id:gid,name:'Nhóm chung',owner_id:uid}];
  else if(path.endsWith('/group_members'))json=[{group_id:gid,user_id:uid,nickname:'Bạn'},{group_id:gid,user_id:other,nickname:'Thành viên'}];
  else if(path.endsWith('/group_books'))json=shared.map(book_id=>({group_id:gid,book_id}));
  return route.fulfill({json,headers:{'Access-Control-Allow-Origin':'*'}});
 });
 return {shared,calls,get unexpectedWrites(){return unexpectedWrites;},allowRetry:()=>{failSecond=false;}};
}
test('shares existing own cloud books without uploading again; hides borrowed books and disables duplicate content',async({page,context})=>{
 const server=await backend(context);await page.setViewportSize({width:390,height:844});await page.goto('/');await navigate(page,/Nhóm đọc & cloud/);await page.getByRole('button',{name:'Chọn sách từ cloud của tôi',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Thêm sách từ thư viện cloud'});
 await expect(dialog.getByLabel('Chọn Sách từ nhóm khác',{exact:true})).toHaveCount(0);await expect(dialog.getByLabel('Chọn Bản riêng cùng nội dung',{exact:true})).toBeDisabled();await dialog.getByLabel('Tìm sách trong cloud').fill('cá nhân');await expect(dialog.getByRole('checkbox')).toHaveCount(2);await dialog.getByLabel('Chọn Sách cá nhân thứ nhất',{exact:true}).check();await dialog.getByLabel('Chọn Sách cá nhân thứ hai',{exact:true}).check();await expect(dialog).toContainText('Đã chọn 2 sách');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/readbook-cloud-book-picker-mobile.png'});await dialog.getByRole('button',{name:'Thêm sách đã chọn vào nhóm',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(page.locator('.group-book-list article')).toHaveCount(3);expect(server.shared).toEqual([ids[4],ids[0],ids[1]]);expect(server.calls).toEqual([ids[0],ids[1]]);expect(server.unexpectedWrites).toBe(0);await page.reload();await navigate(page,/Nhóm đọc & cloud/);await expect(page.locator('.group-book-list article')).toHaveCount(3);
});
test('a partial sharing failure preserves successful books and keeps remaining selections for retry',async({page,context})=>{
 const server=await backend(context,true);await page.goto('/');await navigate(page,/Nhóm đọc & cloud/);await page.getByRole('button',{name:'Chọn sách từ cloud của tôi',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Thêm sách từ thư viện cloud'});await dialog.getByLabel('Chọn Sách cá nhân thứ nhất',{exact:true}).check();await dialog.getByLabel('Chọn Sách cá nhân thứ hai',{exact:true}).check();await dialog.getByRole('button',{name:'Thêm sách đã chọn vào nhóm',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Đã xử lý 1 sách');await expect(dialog.getByLabel('Chọn Sách cá nhân thứ hai',{exact:true})).toBeChecked();await expect(dialog.getByLabel('Chọn Sách cá nhân thứ nhất',{exact:true})).toBeDisabled();expect(server.shared).toEqual([ids[4],ids[0]]);
 server.allowRetry();await dialog.getByRole('button',{name:'Thêm sách đã chọn vào nhóm',exact:true}).click();await expect(dialog).toHaveCount(0);expect(server.shared).toEqual([ids[4],ids[0],ids[1]]);expect(server.calls.filter(id=>id===ids[0])).toHaveLength(1);expect(server.unexpectedWrites).toBe(0);
});
