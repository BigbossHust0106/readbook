import type {SupabaseClient} from '@supabase/supabase-js';
export async function signInWithGoogle(client:SupabaseClient,origin:string){
 const base=import.meta.env.VITE_SUPABASE_URL,publicKey=import.meta.env.VITE_SUPABASE_ANON_KEY;
 let response:Response;
 try{response=await fetch(`${base}/auth/v1/settings`,{headers:{apikey:publicKey},signal:AbortSignal.timeout(10000),redirect:'error'});}
 catch{throw new Error('Không kết nối được dịch vụ đăng nhập. Kiểm tra mạng rồi thử lại.');}
 if(!response.ok)throw new Error('Dịch vụ đăng nhập tạm thời không sẵn sàng. Hãy thử lại sau.');
 const settings=await response.json().catch(()=>null);
 if(settings?.external?.google!==true)throw new Error('Đăng nhập Google chưa được bật. Bạn vẫn có thể đăng nhập bằng email.');
 const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('/auth/callback',origin).href,queryParams:{prompt:'select_account'}}});
 if(error)throw error;
}
