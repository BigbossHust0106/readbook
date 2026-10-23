import {test,expect,type BrowserContext} from '@playwright/test';
import {createHash} from 'node:crypto';
import {navigate} from './helpers';
const host='https://offline-fixture.supabase.co';
const uid='10000000-0000-4000-8000-000000000099';
function session(){const user={id:uid,email:'google-reader@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'google',providers:['google']},user_metadata:{full_name:'Google Reader'},identities:[{provider:'google',id:uid,identity_data:{email:'google-reader@example.com'}}],created_at:new Date().toISOString()};const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';return {access_token:token,refresh_token:'fixture-refresh-token',expires_in:3600,token_type:'bearer',user};}
async function backend(context:BrowserContext,{enabled=true,fail=false}={}){
 let authorized:URL|undefined,exchange:Record<string,string>|undefined,password=false;
 await context.route(host+'/**',async route=>{const r=route.request(),url=new URL(r.url());
  if(url.pathname==='/auth/v1/settings')return route.fulfill({json:{external:{google:enabled},disable_signup:false}});
  if(url.pathname==='/auth/v1/authorize'){authorized=url;expect(url.searchParams.get('provider')).toBe('google');expect(url.searchParams.get('prompt')).toBe('select_account');expect(url.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256');expect(url.searchParams.get('scope')||'').not.toContain('drive');return route.fulfill({status:302,headers:{Location:'http://127.0.0.1:5173/auth/callback?code=fixture-google-code'}});}
  if(url.pathname==='/auth/v1/token'){
   if(url.searchParams.get('grant_type')==='pkce'){exchange=r.postDataJSON();expect(exchange!.auth_code).toBe('fixture-google-code');expect(createHash('sha256').update(exchange!.code_verifier).digest('base64url')).toBe(authorized!.searchParams.get('code_challenge'));}
   else {password=true;expect(r.postDataJSON()).toMatchObject({email:'reader@example.com',password:'valid-password-123'});}
   return fail?route.fulfill({status:400,json:{error:'invalid_grant',error_description:'Invalid code verifier',code:'bad_code_verifier'}}):route.fulfill({json:session()});
  }
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
  if(url.pathname==='/auth/v1/user')return route.fulfill({json:session().user});
  return route.fulfill({json:[],headers:{'Access-Control-Allow-Origin':'*'}});
 });
 return {authorized:()=>authorized,exchange:()=>exchange,password:()=>password};
}
test('Google PKCE login returns to settings, persists the session, and logout works',async({page,context})=>{
 const api=await backend(context);await page.goto('/');await navigate(page,'Cài đặt & kết nối');await page.getByRole('button',{name:'Đăng nhập bằng Google',exact:true}).click();await expect(page.getByText('Đã đăng nhập:',{exact:false})).toBeVisible();await expect(page.locator('main').getByText('google-reader@example.com',{exact:true})).toBeVisible();expect(api.exchange()).toBeDefined();expect(api.authorized()!.searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/auth/callback');await expect(page).toHaveURL('http://127.0.0.1:5173/');
 await page.reload();await navigate(page,'Cài đặt & kết nối');await expect(page.locator('main').getByText('google-reader@example.com',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await expect(page.getByRole('button',{name:'Đăng nhập bằng Google',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
});
test('disabled Google provider stays in the app and permits retry without email input',async({page,context})=>{
 const api=await backend(context,{enabled:false});await page.goto('/');await navigate(page,'Cài đặt & kết nối');await page.getByRole('button',{name:'Đăng nhập bằng Google',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Đăng nhập Google chưa được bật');expect(api.authorized()).toBeUndefined();await expect(page.getByRole('button',{name:'Đăng nhập bằng Google',exact:true})).toBeEnabled();await expect(page).toHaveURL('http://127.0.0.1:5173/');
});
test('cancelled Google login cleans callback errors from the URL and offers another login',async({page,context})=>{
 await backend(context);await page.goto('/auth/callback?error=access_denied&error_description=private-provider-details');await expect(page.getByRole('alert')).toContainText('Bạn đã hủy đăng nhập Google');await expect(page).toHaveURL('http://127.0.0.1:5173/');await expect(page.getByRole('button',{name:'Đăng nhập bằng Google',exact:true})).toBeVisible();await expect(page.locator('main')).not.toContainText('private-provider-details');
});
test('failed code exchange shows a recoverable message rather than a signed-in state',async({page,context})=>{
 await backend(context,{fail:true});await page.goto('/');await navigate(page,'Cài đặt & kết nối');await page.getByRole('button',{name:'Đăng nhập bằng Google',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Đăng nhập Google chưa hoàn tất');await expect(page.getByText('Đã đăng nhập:',{exact:false})).toHaveCount(0);await expect(page.getByRole('button',{name:'Đăng nhập bằng Google',exact:true})).toBeEnabled();await expect(page).toHaveURL('http://127.0.0.1:5173/');
});
test('email password login continues to work with PKCE client settings',async({page,context})=>{
 const api=await backend(context);await page.goto('/');await navigate(page,'Cài đặt & kết nối');await page.getByLabel('Email',{exact:true}).fill('reader@example.com');await page.getByLabel('Mật khẩu',{exact:true}).fill('valid-password-123');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page.getByRole('button',{name:'Mở cài đặt tài khoản',exact:true})).toHaveText('G');await navigate(page,'Cài đặt & kết nối');await expect(page.getByText('Đã đăng nhập:',{exact:false})).toBeVisible();expect(api.password()).toBe(true);expect(api.authorized()).toBeUndefined();
});
test('network failure during provider check keeps login buttons usable',async({page,context})=>{
 await context.route(host+'/auth/v1/settings',r=>r.abort());await page.goto('/');await navigate(page,'Cài đặt & kết nối');await page.getByRole('button',{name:'Đăng nhập bằng Google',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Không kết nối được dịch vụ đăng nhập');await expect(page.getByRole('button',{name:'Đăng nhập bằng Google',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Đăng nhập',exact:true})).toBeEnabled();
});

test('email signup requests PKCE and explains confirmation in the same browser',async({page,context})=>{
 await backend(context);let sent=false;await context.route(host+'/auth/v1/signup',route=>{const body=route.request().postDataJSON();expect(body.email).toBe('reader@example.com');expect(body.code_challenge).toBeTruthy();expect(body.code_challenge_method.toLowerCase()).toBe('s256');sent=true;return route.fulfill({json:session().user});});
 await page.goto('/');await navigate(page,'Cài đặt & kết nối');await page.getByLabel('Email',{exact:true}).fill('reader@example.com');await page.getByLabel('Mật khẩu',{exact:true}).fill('valid-password-123');await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();await expect(page.locator('.toast')).toContainText('trình duyệt bạn vừa dùng để đăng ký');expect(sent).toBe(true);await expect(page.getByRole('button',{name:'Đăng nhập bằng Google',exact:true})).toBeEnabled();
});
