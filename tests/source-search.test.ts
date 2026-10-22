import {afterEach,expect,it,vi} from 'vitest';
import {sourceSearch} from '../worker/sourceSearch';
const env={GOOGLE_SEARCH_API_KEY:'private-key',GOOGLE_SEARCH_ENGINE_ID:'engine'};
const request=(query='Harry Potter',start=1)=>new Request('https://read.example/api/source/search',{method:'POST',headers:{Origin:'https://read.example'},body:JSON.stringify({query,start})});
afterEach(()=>vi.unstubAllGlobals());
it('reports missing credentials without pretending the recent catalog is a full search',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const r=await sourceSearch(request(),{});expect(r.status).toBe(503);expect(await r.json()).toMatchObject({code:'SEARCH_NOT_CONFIGURED'});expect(fetch).not.toHaveBeenCalled();
});
it('returns only deduplicated DTV book pages and keeps credentials server-side',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json({items:[{title:'Harry Potter',link:'https://dtv-ebook.com.vn/harry-potter_27717.html#gsc.tab=0'},{title:'Duplicate',link:'https://dtv-ebook.com.vn/harry-potter_27717.html'},{title:'Outside',link:'https://evil.example/book_123.html'},{title:'File',link:'https://dtv-ebook.com.vn/book.pdf'}],queries:{nextPage:[{startIndex:11}]}}));vi.stubGlobal('fetch',fetch);
 const r=await sourceSearch(request(),env);expect(r.status).toBe(200);const text=await r.text();expect(text).not.toContain('private-key');const result=JSON.parse(text);expect(result.books).toHaveLength(1);expect(result.nextStart).toBe(11);
 const upstream=new URL(fetch.mock.calls[0][0]);expect(upstream.origin).toBe('https://customsearch.googleapis.com');expect(upstream.searchParams.get('siteSearch')).toBe('dtv-ebook.com.vn');
});
it('validates origin, query length, pagination and provider quota',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json({error:'quota'},{status:429}));vi.stubGlobal('fetch',fetch);
 expect((await sourceSearch(new Request('https://read.example/api/source/search',{method:'POST'}),env)).status).toBe(403);
 for(const r of [request(''),request('a'.repeat(161)),request('book',100)])expect((await sourceSearch(r,env)).status).toBe(400);
 expect(fetch).not.toHaveBeenCalled();expect((await sourceSearch(request(),env)).status).toBe(429);
});
it('uses Brave Search as the current provider, filters source links and preserves pagination',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json({web:{results:[{title:'Sách Việt',url:'https://dtv-ebook.com.vn/sach-viet_123.html'},{title:'Wrong domain',url:'https://evil.example/book_123.html'}]},query:{more_results_available:true}}));vi.stubGlobal('fetch',fetch);
 const r=await sourceSearch(request('Sách Việt',11),{...env,BRAVE_SEARCH_API_KEY:'private-brave-key'});const result=await r.json();expect(result).toMatchObject({provider:'Brave Search',nextStart:21});expect(result.books).toHaveLength(1);expect(JSON.stringify(result)).not.toContain('private-brave-key');
 const [url,options]=fetch.mock.calls[0];expect(new URL(url).origin).toBe('https://api.search.brave.com');expect(new URL(url).searchParams.get('q')).toBe('site:dtv-ebook.com.vn Sách Việt');expect(new URL(url).searchParams.get('offset')).toBe('1');expect(options.headers['X-Subscription-Token']).toBe('private-brave-key');expect(options.redirect).toBe('manual');
});
