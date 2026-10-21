import { Parser } from 'htmlparser2';
const HOSTS = new Set(['dtv-ebook.com.vn', 'www.dtv-ebook.com.vn']);
const LIMIT = 50 * 1024 * 1024;
export function sourceUrl(value: string, base?: string): URL {
  const url = new URL(value, base);
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.port && url.port !== '443' || url.username || url.password)
    throw new Error('Chỉ nhận liên kết HTTPS từ dtv-ebook.com.vn.');
  url.hash = ''; return url;
}
function fileName(url: URL, response: Response) {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i);
  let name = url.pathname.split('/').pop() || 'sach';
  if (match) { try { name = decodeURIComponent(match[1]); } catch { name = match[1]; } }
  name = name.replace(/[\x00-\x1f/\\]/g, '_').slice(0, 180);
  const mime = response.headers.get('content-type') || '';
  if (!/\.(epub|pdf|docx|txt)$/i.test(name)) {
    const ext = /epub/i.test(mime) ? 'epub' : /pdf/i.test(mime) ? 'pdf' : /wordprocessingml/i.test(mime) ? 'docx' : /text\/plain/i.test(mime) ? 'txt' : '';
    if (!ext) return null;
    name += '.' + ext;
  }
  if (/text\/html/i.test(mime)) return null;
  return name;
}
async function follow(url: URL, signal?: AbortSignal) {
  for (let n = 0; n < 4; n++) {
    const response = await fetch(url.href, { redirect: 'manual', signal: signal || AbortSignal.timeout(25000), headers: { Accept: 'text/html,application/pdf,application/epub+zip,application/octet-stream;q=0.8' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get('location');
      await response.body?.cancel();
      if (!next) throw new Error('Trang nguồn chuyển hướng không hợp lệ.');
      url = sourceUrl(next, url.href); continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Trang nguồn từ chối truy cập (HTTP ${response.status}). Hãy mở trang nguồn để tải tệp rồi dùng Chọn tệp sách.`); }
    return { response, url };
  }
  throw new Error('Trang nguồn chuyển hướng quá nhiều lần.');
}
async function limitedText(response: Response) {
  const reader = response.body?.getReader(); if (!reader) return '';
  const decoder = new TextDecoder(); let text = '', bytes = 0;
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break;
      if ((bytes += value.byteLength) > 1500000) throw new Error('Trang giới thiệu quá lớn. Hãy dùng liên kết tệp trực tiếp.');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
}
export function parseSource(html: string, base: string) {
  let title = '', heading = '', author = '', depth = 0;
  const links: { url: string; label: string }[] = [], external: { url: string; label: string }[] = [];
  let anchor: { href: string; text: string; download: boolean } | null = null;
  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === 'title') depth = 1;
      if (name === 'h1') depth = 2;
      if (name === 'meta') {
        if (attrs.property === 'og:title') title = attrs.content || title;
        if (['author', 'book:author'].includes(attrs.name || attrs.property)) author = attrs.content || author;
      }
      if (name === 'a' && attrs.href) anchor = { href: attrs.href, text: '', download: 'download' in attrs || /\.(epub|pdf|docx|txt)([?#]|$)/i.test(attrs.href) };
    },
    ontext(text) { if (depth === 1 && !title) title += text; if (depth === 2) heading += text; if (anchor) anchor.text += text; },
    onclosetag(name) {
      if (name === 'title' || name === 'h1') depth = 0;
      if (name === 'a' && anchor) {
        if (anchor.download || /tải|download|epub|pdf/i.test(anchor.text)) {
          try {
            const url = new URL(anchor.href, base);
            if (url.protocol === 'https:' && !url.username && !url.password) {
              const item = { url: url.href, label: anchor.text.trim().slice(0, 160) || url.pathname.split('/').pop() || 'Tệp sách' };
              if (HOSTS.has(url.hostname)) { sourceUrl(url.href); links.push(item); }
              else external.push(item);
            }
          } catch { /* Drop unsafe/malformed source links. */ }
        }
        anchor = null;
      }
    },
  }, { decodeEntities: true });
  parser.write(html); parser.end();
  const unique = (items: typeof links) => [...new Map(items.map(l => [l.url, l])).values()].slice(0, 30);
  return { title: (heading || title).trim().slice(0, 300), author: author.trim().slice(0, 200), links: unique(links), external: unique(external) };
}
export async function sourceRequest(request: Request, download: boolean) {
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply({ error: 'Chỉ hỗ trợ POST.' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply({ error: 'Nguồn yêu cầu không được phép.' }, 403);
  try {
    const raw = await request.text(); if (raw.length > 5000) return reply({ error: 'Liên kết quá dài.' }, 400);
    const body = JSON.parse(raw); if (typeof body.url !== 'string') return reply({ error: 'Thiếu liên kết trang sách.' }, 400);
    let url: URL;
    try { url = sourceUrl(body.url); } catch { return reply({ error: 'Chỉ nhận liên kết HTTPS từ dtv-ebook.com.vn.' }, 400); }
    const fetched = await follow(url); url = fetched.url; const response = fetched.response;
    const name = fileName(url, response);
    if (!download) {
      if (name) { await response.body?.cancel(); return reply({ title: name.replace(/\.[^.]+$/, ''), author: '', links: [{ url: url.href, label: name }], external: [] }); }
      return reply(parseSource(await limitedText(response), url.href));
    }
    if (!name) { await response.body?.cancel(); return reply({ error: 'Liên kết này chưa trả về tệp EPUB/PDF/DOCX/TXT. Hãy chọn liên kết tải trực tiếp hoặc tải qua trình duyệt rồi nhập tệp.' }, 422); }
    if (Number(response.headers.get('content-length') || 0) > LIMIT) { await response.body?.cancel(); return reply({ error: 'Tệp tối đa 50 MB.' }, 413); }
    let bytes = 0;
    const stream = response.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) {
      if ((bytes += chunk.byteLength) > LIMIT) throw new Error('Tệp vượt 50 MB.'); controller.enqueue(chunk);
    } }));
    return new Response(stream, { headers: { 'Content-Type': 'application/octet-stream', 'X-Book-Filename': encodeURIComponent(name), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return reply({ error: error instanceof Error && !/fetch|timeout|network/i.test(error.message) ? error.message : 'Không kết nối được trang nguồn. Hãy tải tệp trên trang đó rồi chọn tệp để nhập.' }, 502); }
}

export function parseCatalog(html: string, base = 'https://dtv-ebook.com.vn/') {
  const books: { title: string; url: string }[] = [];
  let current: { title: string; label: string; url: string } | null = null;
  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === 'a' && attrs.href) {
        try {
          const url = sourceUrl(attrs.href, base);
          current = /_\d+\.html$/i.test(url.pathname) ? { title: attrs.title || '', label: '', url: url.href } : null;
        } catch { current = null; }
      }
      if (name === 'img' && current && !current.title) current.title = attrs.alt || '';
    },
    ontext(text) { if (current) current.label += text; },
    onclosetag(name) { if (name === 'a' && current) {
      const title = (current.title || current.label).replace(/\s+/g, ' ').trim().slice(0, 300);
      if (title.length > 2) books.push({ title, url: current.url }); current = null;
    } },
  }, { decodeEntities: true });
  parser.write(html); parser.end();
  const unique = new Map<string, typeof books[number]>();
  for (const book of books) if (!unique.has(book.url)) unique.set(book.url, book);
  return [...unique.values()].slice(0, 100);
}
export async function sourceCatalog() {
  try {
    const { response, url } = await follow(sourceUrl('https://dtv-ebook.com.vn/'));
    return Response.json({ books: parseCatalog(await limitedText(response), url.href), source: url.href }, { headers: { 'Cache-Control': 'public, max-age=600' } });
  } catch { return Response.json({ error: 'DTV đang chặn tải danh mục tự động. Bạn vẫn có thể dùng ô tìm kiếm để mở kết quả trên DTV hoặc Google.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } }); }
}
