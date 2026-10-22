import {afterEach,expect,it,vi} from 'vitest';
import {handle} from '../worker';
const env={ASSETS:{fetch:async()=>new Response('app')},TRANSLATION_ENABLED:'true',TRANSLATION_PROVIDER:'google'};
const request=(text='Ăn',path='/api/translate')=>new Request('https://read.example'+path,{method:'POST',headers:{Origin:'https://read.example'},body:JSON.stringify({text,source:'vi',target:'en'})});
afterEach(()=>vi.unstubAllGlobals());
it('advertises Google and translates inline without touching MyMemory',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json([[['Eat','Ăn',null,null,10]],null,'vi']));vi.stubGlobal('fetch',fetch);
 const cap=await handle(new Request('https://read.example/api/capabilities'),env);expect(await cap.json()).toMatchObject({provider:'Google Translate',configured:true});
 const response=await handle(request(),env);expect(response.status).toBe(200);expect(await response.json()).toMatchObject({text:'Eat',provider:'Google Translate'});expect(fetch).toHaveBeenCalledTimes(1);const url=new URL(fetch.mock.calls[0][0]);expect(url.origin).toBe('https://translate.googleapis.com');expect(url.searchParams.get('q')).toBe('Ăn');expect(url.searchParams.get('sl')).toBe('vi');expect(url.searchParams.get('tl')).toBe('en');
});
it('lets the inline Google button work independently of a legacy MyMemory configuration',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json([[['Eat','Ăn']],null,'vi'])));
 const r=await handle(request('Ăn','/api/translate/google'),{...env,TRANSLATION_PROVIDER:'mymemory'});expect(r.status).toBe(200);expect(await r.json()).toMatchObject({provider:'Google Translate'});
});
it.each([403,429,500])('distinguishes provider HTTP %s from a quota error',async status=>{
 const fetch=vi.fn().mockResolvedValue(new Response('',{status}));vi.stubGlobal('fetch',fetch);const r=await handle(request(),env);expect(r.status).toBe(status===429?429:502);const data=await r.json();expect(data.code).toBe(status===429?'GOOGLE_RATE_LIMIT':'GOOGLE_UNAVAILABLE');if(status!==429)expect(data.error).not.toContain('hạn mức');expect(fetch).toHaveBeenCalledTimes(1);
});
it('rejects bad input and redirects, and preserves Unicode while splitting long requests',async()=>{
 const sent:string[]=[];vi.stubGlobal('fetch',vi.fn().mockImplementation((value:URL)=>{const q=new URL(value).searchParams.get('q')!;sent.push(q);return Promise.resolve(Response.json([[[q,q]],null,'vi']));}));
 const text='Ăn cơm 📖 中文. '.repeat(120);const r=await handle(request(text),env);expect(r.status).toBe(200);expect(sent.join('')).toBe(text);expect(sent.every(part=>new TextEncoder().encode(part).length<=1000)).toBe(true);
 expect((await handle(request('a'.repeat(4001)),env)).status).toBe(400);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:302,headers:{Location:'https://evil.example'}})));expect((await handle(request(),env)).status).toBe(502);
});
