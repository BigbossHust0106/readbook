import {afterEach,expect,it,vi} from 'vitest';
import {speechChunks} from '../src/speech';
import {speechRequest} from '../worker/speech';
const request=(text='Đọc sách mỗi ngày.',language='vi')=>new Request('https://read.example/api/speech',{method:'POST',headers:{Origin:'https://read.example'},body:JSON.stringify({text,language})});
afterEach(()=>vi.unstubAllGlobals());
it('queues short chunks with no dropped text or split surrogate pairs',()=>{
 const text=('Đọc sách 📖 mỗi ngày. 阅读让我开心。 A new world! '.repeat(100)).trim();const chunks=speechChunks(text);
 expect(chunks.join('')).toBe(text);expect(chunks.length).toBeGreaterThan(10);for(const chunk of chunks){expect(Array.from(chunk).length).toBeLessThanOrEqual(180);expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u);}
 expect(speechChunks('  ')).toEqual([]);
});
it('validates language, origin and length before sending anything to the voice provider',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 for(const r of [request('', 'vi'),request('a'.repeat(181)),request('hello','other'),new Request('https://read.example/api/speech',{method:'POST',body:'{}'})])expect((await speechRequest(r)).status).toBeGreaterThanOrEqual(400);
 expect(fetch).not.toHaveBeenCalled();
});
it('returns MP3 bytes and sends only the requested short text to the fixed Google endpoint',async()=>{
 const bytes=new Uint8Array([255,243,132,0]);const fetch=vi.fn().mockResolvedValue(new Response(bytes,{headers:{'Content-Type':'audio/mpeg'}}));vi.stubGlobal('fetch',fetch);
 const response=await speechRequest(request());expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
 const [input,options]=fetch.mock.calls[0];const url=new URL(input);expect(url.origin).toBe('https://translate.google.com');expect(url.pathname).toBe('/translate_tts');expect(url.searchParams.get('tl')).toBe('vi');expect(url.searchParams.get('q')).toBe('Đọc sách mỗi ngày.');expect(options.redirect).toBe('manual');expect(options.headers).not.toHaveProperty('Authorization');
});
it.each([302,429,500])('handles provider HTTP %s without following redirects or treating errors as audio',async status=>{
 const fetch=vi.fn().mockResolvedValue(new Response('error',{status,headers:{Location:'https://other.example/audio','Content-Type':'text/html'}}));vi.stubGlobal('fetch',fetch);
 const response=await speechRequest(request());expect(response.status).toBe(status===429?429:502);expect(response.headers.get('Content-Type')).toContain('application/json');expect(fetch).toHaveBeenCalledTimes(1);
});
it('rejects HTML and oversized responses from the voice endpoint',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>challenge</html>',{headers:{'Content-Type':'text/html'}})));expect((await speechRequest(request())).status).toBe(502);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('audio',{headers:{'Content-Type':'audio/mpeg','Content-Length':String(2*1024*1024)}})));expect((await speechRequest(request())).status).toBe(502);
});
