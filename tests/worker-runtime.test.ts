import { afterEach, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions, Response as RuntimeResponse, type Request as RuntimeRequest } from 'miniflare';
import { readFile } from 'node:fs/promises';

// Execute the bundled handler in workerd, not Node's fetch implementation.
// Only outbound provider responses are fixtures; redirect validation is real.
let script:string, compatibilityDate:string;
const runtimes:Miniflare[]=[];
beforeAll(async()=>{
  compatibilityDate=(await readFile('wrangler.jsonc','utf8')).match(/"compatibility_date":\s*"([^"]+)"/)![1];
  const bundle=await build({entryPoints:['worker/index.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
  script=bundle.outputFiles[0].text;
});
afterEach(async()=>{await Promise.all(runtimes.splice(0).map(mf=>mf.dispose()));});
function runtime(outboundService:(req:RuntimeRequest)=>RuntimeResponse,libre=false){
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate,script,outboundService,bindings:libre?{TRANSLATION_ENABLED:'true',LOCAL_TRANSLATION:'true',LIBRETRANSLATE_URL:'http://127.0.0.1:5000'}:{TRANSLATION_ENABLED:'true',TRANSLATION_PROVIDER:'mymemory'}}));
  runtimes.push(mf);return mf;
}
const request={method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({text:'Ăn',source:'vi',target:'en'})};
it('translates a selected Vietnamese word through the actual Worker runtime',async()=>{
  const calls:string[]=[];
  const mf=runtime(req=>{calls.push(req.url);return RuntimeResponse.json({responseStatus:200,responseData:{translatedText:'Eat'}});});
  const response=await mf.dispatchFetch('http://localhost/api/translate',request);
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({text:'Eat',provider:'MyMemory'});
  expect(calls).toHaveLength(1);expect(new URL(calls[0]).origin).toBe('https://api.mymemory.translated.net');expect(new URL(calls[0]).searchParams.get('q')).toBe('Ăn');
});
it('refuses a provider redirect without following or forwarding selected text',async()=>{
  const calls:string[]=[];
  const mf=runtime(req=>{calls.push(req.url);return new RuntimeResponse('',{status:302,headers:{Location:'https://untrusted.example/collect'}});});
  const response=await mf.dispatchFetch('http://localhost/api/translate',request);
  expect(response.status).toBe(502);expect(await response.json()).not.toHaveProperty('text');expect(calls).toHaveLength(1);expect(calls[0]).toContain('https://api.mymemory.translated.net/');
});
it('keeps quota responses out of translations in workerd',async()=>{
  let calls=0;
  const mf=runtime(()=>{calls++;return RuntimeResponse.json({responseStatus:429,quotaFinished:true,responseData:{translatedText:'MYMEMORY WARNING'}});});
  const response=await mf.dispatchFetch('http://localhost/api/translate',request);
  expect(response.status).toBe(429);expect(await response.json()).not.toHaveProperty('text');expect(calls).toBe(1);
});
it('supports LibreTranslate capability and translation requests in workerd',async()=>{
  const calls:string[]=[];
  const mf=runtime(req=>{const path=new URL(req.url).pathname;calls.push(path);return RuntimeResponse.json(path==='/languages'?[{code:'vi',targets:['en']}]:{translatedText:'Eat'});},true);
  const response=await mf.dispatchFetch('http://localhost/api/translate',request);
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({text:'Eat',provider:'LibreTranslate'});expect(calls).toEqual(['/languages','/translate']);
});
it.each(['/languages','/translate'])('rejects LibreTranslate redirects from %s',async redirectPath=>{
  const calls:string[]=[];
  const mf=runtime(req=>{const path=new URL(req.url).pathname;calls.push(path);return path===redirectPath?new RuntimeResponse('',{status:307,headers:{Location:'https://untrusted.example/collect'}}):RuntimeResponse.json([{code:'vi',targets:['en']}]);},true);
  const response=await mf.dispatchFetch('http://localhost/api/translate',request);
  expect(response.status).toBe(502);expect(await response.json()).not.toHaveProperty('text');expect(calls).toEqual(redirectPath==='/languages'?['/languages']:['/languages','/translate']);
});
it('downloads a public Drive file through validated redirects in workerd',async()=>{
 const calls:string[]=[];
 const mf=runtime(req=>{calls.push(req.url);return calls.length===1?new RuntimeResponse(null,{status:303,headers:{Location:'https://drive.usercontent.google.com/download?id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12'}}):new RuntimeResponse('%PDF-1.6',{headers:{'Content-Type':'application/pdf','Content-Disposition':"attachment; filename*=UTF-8''Con%20C%C3%B3%20Th%E1%BB%83.pdf"}});});
 const response=await mf.dispatchFetch('http://localhost/api/source/download',{method:'POST',headers:{Origin:'http://localhost'},body:JSON.stringify({url:'https://docs.google.com/uc?id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12'})});
 expect(response.status).toBe(200);expect(await response.text()).toBe('%PDF-1.6');expect(decodeURIComponent(response.headers.get('X-Book-Filename')!)).toBe('Con Có Thể.pdf');expect(calls).toHaveLength(2);
});
it('streams MP3 speech in the actual Worker runtime and rejects provider redirects',async()=>{
 const calls:string[]=[];const mf=runtime(req=>{calls.push(req.url);return new RuntimeResponse(new Uint8Array([255,243,132,0]),{headers:{'Content-Type':'audio/mpeg'}});});
 const request={method:'POST',headers:{Origin:'http://localhost'},body:JSON.stringify({text:'Đọc sách.',language:'vi'})};
 const response=await mf.dispatchFetch('http://localhost/api/speech',request);expect(response.status).toBe(200);expect(response.headers.get('Content-Type')).toBe('audio/mpeg');expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([255,243,132,0]));expect(new URL(calls[0]).hostname).toBe('translate.google.com');
 const redirect=runtime(()=>new RuntimeResponse(null,{status:302,headers:{Location:'https://untrusted.example/audio'}}));expect((await redirect.dispatchFetch('http://localhost/api/speech',request)).status).toBe(502);
});
