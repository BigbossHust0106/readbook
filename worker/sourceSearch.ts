import { sourceUrl } from './source';
type SearchEnv = { BRAVE_SEARCH_API_KEY?: string; GOOGLE_SEARCH_API_KEY?: string; GOOGLE_SEARCH_ENGINE_ID?: string };
type SearchItem = { title?: string; url?: string; link?: string };
export async function sourceSearch(request: Request, env: SearchEnv) {
  const brave = !!env.BRAVE_SEARCH_API_KEY;
  const configured = brave || !!env.GOOGLE_SEARCH_API_KEY && !!env.GOOGLE_SEARCH_ENGINE_ID;
  const provider = brave ? 'Brave Search' : 'Google Programmable Search';
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method === 'GET') return reply({ configured, provider: configured ? provider : null });
  if (request.method !== 'POST') return reply({ error: 'Chỉ hỗ trợ GET hoặc POST.' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply({ error: 'Nguồn yêu cầu không được phép.' }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 2000) return reply({ error: 'Từ khóa quá dài.' }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Yêu cầu tìm kiếm không hợp lệ.' }, 400); }
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const start = body?.start ?? 1;
    if (!query || query.length > 160 || !Number.isInteger(start) || start < 1 || start > 91 || (start - 1) % 10 !== 0)
      return reply({ error: 'Nhập từ khóa tối đa 160 ký tự và trang kết quả hợp lệ.' }, 400);
    if (!configured) return reply({ error: 'Tìm kiếm toàn bộ kho DTV trong ứng dụng chưa được cấu hình. Bạn vẫn có thể tải danh mục mới hoặc dán liên kết trang sách/tệp Google Drive bên dưới.', code: 'SEARCH_NOT_CONFIGURED' }, 503);
    const url = new URL(brave ? 'https://api.search.brave.com/res/v1/web/search' : 'https://customsearch.googleapis.com/customsearch/v1');
    url.search = brave
      ? new URLSearchParams({ q: `site:dtv-ebook.com.vn ${query}`, count: '10', offset: String((start - 1) / 10) }).toString()
      : new URLSearchParams({ key: env.GOOGLE_SEARCH_API_KEY!, cx: env.GOOGLE_SEARCH_ENGINE_ID!, q: query, siteSearch: 'dtv-ebook.com.vn', siteSearchFilter: 'i', num: '10', start: String(start) }).toString();
    const response = await fetch(url, {
      redirect: 'manual', signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      headers: brave ? { 'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY!, Accept: 'application/json' } : { Accept: 'application/json' },
    });
    if (response.status === 429) {
      await response.body?.cancel();
      return reply({ error: 'Nguồn tìm kiếm đã hết hạn mức. Hãy thử lại sau hoặc dùng liên kết trang sách.', code: 'SEARCH_QUOTA' }, 429);
    }
    if (!response.ok) {
      await response.body?.cancel();
      return reply({ error: 'Nguồn tìm kiếm chưa sẵn sàng. Hãy kiểm tra cấu hình, quyền và hạn mức API tìm kiếm.', code: 'SEARCH_UNAVAILABLE' }, 502);
    }
    const data = await response.json() as { items?: SearchItem[]; web?: { results?: SearchItem[] }; query?: { more_results_available?: boolean }; queries?: { nextPage?: { startIndex: number }[] } };
    const books: { title: string; url: string }[] = [];
    for (const item of (brave ? data.web?.results : data.items) || []) {
      try {
        const value = brave ? item.url : item.link;
        if (typeof item.title !== 'string' || !item.title.trim() || typeof value !== 'string') continue;
        const link = sourceUrl(value);
        if (!/_\d+\.html$/i.test(link.pathname)) continue;
        books.push({ title: item.title.trim().slice(0, 300), url: link.href });
      } catch { /* Never return links outside DTV. */ }
    }
    const next = brave ? data.query?.more_results_available ? start + 10 : undefined : data.queries?.nextPage?.[0]?.startIndex;
    return reply({ books: [...new Map(books.map(b => [b.url, b])).values()], query, provider, nextStart: typeof next === 'number' && Number.isInteger(next) && next > start && next <= 91 && (next - 1) % 10 === 0 ? next : null });
  } catch {
    return reply({ error: 'Không kết nối được nguồn tìm kiếm. Kết quả và các tệp đã nhập vẫn được giữ.', code: 'SEARCH_CONNECTION' }, 502);
  }
}
