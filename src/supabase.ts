import {createClient} from "@supabase/supabase-js";
export const supabase =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {auth:{flowType:"pkce",detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}},
      )
    : null;
