import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {handle,type Env} from '../worker';
let env:Env;
let serial=0;
const rows=[{lang:'vi',usable_as_source:true,usable_as_target:true},{lang:'zh',usable_as_source:true,usable_as_target:false},{lang:'zh-Hans',usable_as_source:false,usable_as_target:true},{lang:'en',usable_as_source:true,usable_as_target:false},{lang:'en-US',usable_as_source:false,usable_as_target:true}];
const request=(body:unknown={text:'Ăn 📖',source:'vi',target:'en'},origin='https://read.example')=>new Request('https://read.example/api/translate',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)});
const cap=()=>new Request('https://read.example/api/capabilities');
beforeEach(()=>{env={ASSETS:{fetch:async()=>new Response('app')},TRANSLATION_ENABLED:'true',TRANSLATION_PROVIDER:'deepl',DEEPL_API_KEY:`fixture-${++serial}:fx`};});
afterEach(()=>vi.unstubAllGlobals());
it('reports a missing key clearly without contacting any provider',async()=>{
 delete env.DEEPL_API_KEY;const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 expect(await (await handle(cap(),env)).json()).toMatchObject({configured:false,provider:'DeepL',pairs:[],code:'DEEPL_NOT_CONFIGURED'});
 const r=await handle(request(),env);expect(r.status).toBe(503);expect(await r.json()).toMatchObject({code:'DEEPL_NOT_CONFIGURED'});expect(fetch).not.toHaveBeenCalled();
});
it.each([true,false])('uses the correct official Free/Pro host (Free=%s), header, JSON and verified language codes',async free=>{
 if(!free)env.DEEPL_API_KEY='pro-'+serial;
 const fetch=vi.fn().mockResolvedValueOnce(Response.json(rows)).mockResolvedValueOnce(Response.json({translations:[{text:'Eat 📖'}]}));vi.stubGlobal('fetch',fetch);
 expect(await (await handle(cap(),env)).json()).toMatchObject({configured:true,provider:'DeepL',pairs:[{source:'vi',targets:['zh','en']},{source:'zh',targets:['vi','en']},{source:'en',targets:['vi','zh']}]});
 const r=await handle(request(),env);expect(r.status).toBe(200);const data=await r.json();expect(data).toMatchObject({text:'Eat 📖',provider:'DeepL'});expect(JSON.stringify(data)).not.toContain(env.DEEPL_API_KEY!);
 expect(fetch).toHaveBeenCalledTimes(2);
 const [url,options]=fetch.mock.calls[1];expect(url).toBe(`${free?'https://api-free.deepl.com':'https://api.deepl.com'}/v2/translate`);expect(options.headers.Authorization).toBe(`DeepL-Auth-Key ${env.DEEPL_API_KEY}`);expect(options.redirect).toBe('manual');expect(JSON.parse(options.body)).toEqual({text:['Ăn 📖'],source_lang:'VI',target_lang:'EN-US',model_type:'quality_optimized'});
 expect(fetch.mock.calls[0][0]).toContain('/v3/languages?resource=translate_text');
});
it.each([[403,503,'DEEPL_AUTH'],[456,429,'DEEPL_QUOTA'],[429,429,'DEEPL_RATE_LIMIT'],[400,422,'DEEPL_LANGUAGE'],[500,502,'DEEPL_UNAVAILABLE'],[302,502,'DEEPL_UNAVAILABLE']])('distinguishes upstream %s without leaking provider bodies or treating everything as quota',async(status,responseStatus,code)=>{
 const fetch=vi.fn().mockResolvedValueOnce(Response.json(rows)).mockResolvedValueOnce(new Response(JSON.stringify({message:env.DEEPL_API_KEY}),{status:status as number,headers:{Location:'https://evil.example'}}));vi.stubGlobal('fetch',fetch);
 const r=await handle(request(),env);expect(r.status).toBe(responseStatus);const data=await r.json();expect(data.code).toBe(code);expect(data).not.toHaveProperty('text');expect(JSON.stringify(data)).not.toContain(env.DEEPL_API_KEY!);if(status!==456)expect(data.error).not.toContain('đã chạm hạn mức');expect(fetch).toHaveBeenCalledTimes(2);
});
it('checks actual supported languages, including Vietnamese, rather than advertising unsupported pairs',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json(rows.filter(l=>l.lang!=='vi')));vi.stubGlobal('fetch',fetch);
 expect((await (await handle(cap(),env)).json()).pairs).toEqual([{source:'zh',targets:['en']},{source:'en',targets:['zh']}]);
 const r=await handle(request(),env);expect(r.status).toBe(422);expect(await r.json()).toMatchObject({code:'DEEPL_LANGUAGE'});expect(fetch).toHaveBeenCalledTimes(1);
});
it('does not cache provider failures or announce invalid credentials as connected',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response('',{status:403})).mockResolvedValueOnce(Response.json(rows));vi.stubGlobal('fetch',fetch);
 expect(await (await handle(cap(),env)).json()).toMatchObject({configured:false,code:'DEEPL_AUTH'});expect(await (await handle(cap(),env)).json()).toMatchObject({configured:true});expect(fetch).toHaveBeenCalledTimes(2);
});
it('validates text, origin and method before spending characters',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 for(const body of [null,{}, {text:'a'.repeat(4001),source:'vi',target:'en'},{text:'x',source:'vi',target:'vi'}])expect((await handle(request(body),env)).status).toBe(400);
 expect((await handle(request(undefined,'https://evil.example'),env)).status).toBe(403);expect((await handle(new Request('https://read.example/api/translate'),env)).status).toBe(405);expect(fetch).not.toHaveBeenCalled();
});
it('preserves long Unicode text in one request and maps Chinese to Simplified Chinese',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(Response.json(rows)).mockResolvedValueOnce(Response.json({translations:[{text:'译文'}]}));vi.stubGlobal('fetch',fetch);
 const text='Ăn 📖 中文. '.repeat(250);expect((await handle(request({text,source:'en',target:'zh'}),env)).status).toBe(200);const body=JSON.parse(fetch.mock.calls[1][1].body);expect(body.text).toEqual([text]);expect(body.target_lang).toBe('ZH-HANS');
});
it('handles malformed results and network failure without creating translations',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json(rows)).mockResolvedValueOnce(Response.json({translations:[]})).mockRejectedValueOnce(new TypeError('network with secret')));
 for(let i=0;i<2;i++){const r=await handle(request(),env);expect(r.status).toBe(502);expect(await r.json()).toMatchObject({code:'DEEPL_CONNECTION'});}
});
it('never bypasses DeepL with the legacy Google route when DeepL is selected',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json(rows)).mockResolvedValueOnce(Response.json({translations:[{text:'Eat'}]})));
 const r=await handle(new Request('https://read.example/api/translate/google',request()),env);expect(await r.json()).toMatchObject({provider:'DeepL'});
});
