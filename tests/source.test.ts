import { afterEach, expect, it, vi } from 'vitest';
import { parseSource, sourceUrl, parseCatalog } from '../worker/source';
import { handle } from '../worker';
const env = { ASSETS: { fetch: async () => new Response('app') } };
const request = (url: string, download = false) => new Request(`https://read.example/api/source/${download ? 'download' : 'inspect'}`, { method: 'POST', headers: { Origin: 'https://read.example' }, body: JSON.stringify({ url }) });
afterEach(() => vi.unstubAllGlobals());
it('extracts metadata and same-site public file links and rejects unsafe URLs', () => {
  const data = parseSource('<meta property="og:title" content="Sách thử"><meta name="author" content="Tác giả"><h1>Sách mẫu</h1><a href="/files/sample.epub">Tải EPUB</a><a href="javascript:alert(1)">Tải</a><a href="https://other.example/file.pdf">PDF ngoài</a>', 'https://dtv-ebook.com.vn/sample.html');
  expect(data.title).toBe('Sách mẫu'); expect(data.author).toBe('Tác giả'); expect(data.links).toEqual([{ url: 'https://dtv-ebook.com.vn/files/sample.epub', label: 'Tải EPUB' }]);
  expect(data.external).toHaveLength(1);
  for (const url of ['https://127.0.0.1/a.pdf', 'http://dtv-ebook.com.vn/', 'https://dtv-ebook.com.vn.evil/a', 'https://user:pass@dtv-ebook.com.vn/', 'https://dtv-ebook.com.vn:444/']) expect(() => sourceUrl(url)).toThrow();
});
it('blocks redirects outside the allowlist before any further fetch', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('', { status: 302, headers: { Location: 'https://127.0.0.1/private' } })); vi.stubGlobal('fetch', fetch);
  expect((await handle(request('https://dtv-ebook.com.vn/a.html'), env)).status).toBe(502); expect(fetch).toHaveBeenCalledTimes(1);
});
it('preserves file bytes and returns filename; clearly reports a blocked source', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('book bytes', { headers: { 'Content-Type': 'application/pdf' } })));
  const r = await handle(request('https://dtv-ebook.com.vn/files/sample.pdf', true), env);
  expect(r.status).toBe(200); expect(await r.text()).toBe('book bytes'); expect(r.headers.get('X-Book-Filename')).toBe('sample.pdf');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
  expect(await (await handle(request('https://dtv-ebook.com.vn/a.html'), env)).text()).toContain('HTTP 403');
});

it('extracts title metadata for catalog browsing without downloading book content', () => {
  const books = parseCatalog('<a href="/truyen-dan-gian_123.html" title="Truyện dân gian"><img alt="Ảnh bìa"></a><a href="/truyen-dan-gian_123.html">Trùng</a><a href="https://evil.example/book_123.html">Ngoài</a>');
  expect(books).toEqual([{ title: 'Truyện dân gian', url: 'https://dtv-ebook.com.vn/truyen-dan-gian_123.html' }]);
});

it('recognizes DTV author cells and public Google Drive PDF links', () => {
  const data = parseSource('<h1>Con Có Thể Làm Được Mà!</h1><table><tr><td>Tác giả</td><td><a href="/author.html">Maja Pitamic</a></td></tr></table><a href="https://docs.google.com/uc?id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12">PDF</a>', 'https://dtv-ebook.com.vn/book_123.html');
  expect(data.author).toBe('Maja Pitamic'); expect(data.external).toEqual([]);
  expect(data.links[0].url).toBe('https://docs.google.com/uc?export=download&id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12');
});
it('downloads a public Drive file through a validated redirect and decodes Vietnamese filenames', async () => {
  const name = 'Con Có Thể Làm Được Mà! - Maja Pitamic.pdf';
  const legacy = Array.from(new TextEncoder().encode(name), byte => String.fromCharCode(byte)).join('');
  const fetch = vi.fn().mockResolvedValueOnce(new Response(null, {status:303,headers:{Location:'https://drive.usercontent.google.com/download?id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12'}})).mockResolvedValueOnce(new Response('%PDF-1.6', {headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${legacy}"`}}));
  vi.stubGlobal('fetch',fetch);
  const r=await handle(request('https://docs.google.com/uc?id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12',true),env);
  expect(r.status).toBe(200);expect(await r.text()).toBe('%PDF-1.6');expect(decodeURIComponent(r.headers.get('X-Book-Filename')!)).toBe(name);
  expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls.every(call=>call[1].redirect==='manual')).toBe(true);
});
it.each(['https://accounts.google.com/login','https://drive.usercontent.google.com/download?id=another_file_123','https://drive.usercontent.google.com:444/download?id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12','https://drive.usercontent.google.com/private?id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12'])('rejects unsafe Drive redirects before fetch: %s', async location => {
  const fetch=vi.fn().mockResolvedValue(new Response(null,{status:302,headers:{Location:location}}));vi.stubGlobal('fetch',fetch);
  expect((await handle(request('https://docs.google.com/uc?id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12',true),env)).status).toBe(502);expect(fetch).toHaveBeenCalledTimes(1);
});
it('never imports a Drive login/confirmation page or an oversized file as a book', async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}})));
  expect((await handle(request('https://drive.google.com/file/d/15zlSM76mB03rLgU9QLSOCT5M55Tqoa12/view',true),env)).status).toBe(422);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('PDF',{headers:{'Content-Type':'application/pdf','Content-Length':String(51*1024*1024)}})));
  expect((await handle(request('https://docs.google.com/uc?id=15zlSM76mB03rLgU9QLSOCT5M55Tqoa12',true),env)).status).toBe(413);
});
