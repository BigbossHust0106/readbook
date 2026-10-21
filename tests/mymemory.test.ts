import { afterEach, expect, it, vi } from 'vitest';
import { handle } from '../worker';
import { utf8Chunks } from '../worker/mymemory';
const env = { ASSETS: { fetch: async () => new Response('app') }, TRANSLATION_ENABLED: 'true', TRANSLATION_PROVIDER: 'mymemory' };
const req = (text = 'Một cuốn sách.', source = 'vi', target = 'en') => new Request('https://read.example/api/translate', { method: 'POST', headers: { Origin: 'https://read.example' }, body: JSON.stringify({ text, source, target }) });
afterEach(() => vi.unstubAllGlobals());
it('splits UTF-8 safely under provider byte limit without dropping source text', () => {
  const text = 'Sách tiếng Việt 📖 阅读中文 '.repeat(100);
  const chunks = utf8Chunks(text);
  expect(chunks.join('')).toBe(text);
  expect(chunks.every(c => new TextEncoder().encode(c).length <= 450)).toBe(true);
});
it('advertises all six pairs and uses only official provider endpoint', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ responseStatus: 200, quotaFinished: false, responseData: { translatedText: 'A book.' } }));
  vi.stubGlobal('fetch', fetch);
  const cap = await (await handle(new Request('https://read.example/api/capabilities'), env)).json() as any;
  expect(cap.pairs).toHaveLength(3); expect(cap.pairs.every((p: any) => p.targets.length === 2)).toBe(true);
  const response = await handle(req(), env);
  expect(response.status).toBe(200); expect((await response.json() as any).text).toBe('A book.');
  expect(new URL(fetch.mock.calls[0][0]).origin).toBe('https://api.mymemory.translated.net');
});
it('never saves provider quota warnings as translations', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ responseStatus: 200, quotaFinished: true, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' } })));
  const r = await handle(req(), env); expect(r.status).toBe(429);
  expect((await r.json() as any).text).toBeUndefined();
});
it('rejects invalid pairs before provider requests', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect((await handle(req('hi', 'en', 'en'), env)).status).toBe(400); expect(fetch).not.toHaveBeenCalled();
});
it('retries a transient connection failure once and returns the real translation',async()=>{
  const fetch=vi.fn().mockRejectedValueOnce(new TypeError('connection reset')).mockResolvedValueOnce(Response.json({responseStatus:200,responseData:{translatedText:'In her heart, she would feel pressure.'}}));
  vi.stubGlobal('fetch',fetch);
  const response=await handle(req(', trong lòng dì sẽ cảm thấy áp lực'),env);
  expect(response.status).toBe(200);expect((await response.json() as any).text).toBe('In her heart, she would feel pressure.');expect(fetch).toHaveBeenCalledTimes(2);
});
it('retries server failures but stops after two attempts with an actionable error',async()=>{
  const fetch=vi.fn().mockImplementation(()=>Promise.resolve(new Response('unavailable',{status:503})));
  vi.stubGlobal('fetch',fetch);
  const response=await handle(req(),env);
  expect(response.status).toBe(502);expect((await response.json() as any).text).toBeUndefined();expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not retry quota responses or expose provider network errors',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response('',{status:429}));vi.stubGlobal('fetch',fetch);
  expect((await handle(req(),env)).status).toBe(429);expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockReset().mockRejectedValue(new TypeError('internal details'));
  const response=await handle(req(),env),data=await response.json() as any;
  expect(response.status).toBe(502);expect(data.error).toContain('thử dịch lại');expect(data.error).not.toContain('internal details');expect(fetch).toHaveBeenCalledTimes(2);
});
it('rejects malformed JSON without contacting the provider',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const response=await handle(new Request('https://read.example/api/translate',{method:'POST',headers:{Origin:'https://read.example'},body:'{'}),env);
  expect(response.status).toBe(400);expect(fetch).not.toHaveBeenCalled();
});
