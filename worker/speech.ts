const LANGUAGES = { vi: 'vi', en: 'en', zh: 'zh-CN' };
export async function speechRequest(request: Request) {
  const reply = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply('Chỉ hỗ trợ POST.', 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply('Nguồn yêu cầu không được phép.', 403);
  try {
    const raw = await request.text(); if (raw.length > 2000) return reply('Đoạn đọc quá dài.', 400);
    let body; try { body = JSON.parse(raw); } catch { return reply('Yêu cầu đọc không hợp lệ.', 400); }
    if (typeof body?.text !== 'string' || !body.text.trim() || Array.from(body.text).length > 180 || !Object.hasOwn(LANGUAGES, body.language)) return reply('Chọn Việt, Anh hoặc Trung và tối đa 180 ký tự mỗi phần đọc.', 400);
    const url = new URL('https://translate.google.com/translate_tts');
    url.search = new URLSearchParams({ ie: 'UTF-8', client: 'tw-ob', tl: LANGUAGES[body.language as keyof typeof LANGUAGES], q: body.text }).toString();
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]), headers: { Accept: 'audio/mpeg' } });
    if (!response.ok || !/audio\/mpeg/i.test(response.headers.get('Content-Type') || '')) {
      await response.body?.cancel();
      return reply(response.status === 429 ? 'Nguồn giọng đọc đang giới hạn lượt. Hãy thử lại sau hoặc chọn giọng thiết bị.' : 'Không lấy được giọng đọc trực tuyến. Hãy thử lại hoặc chọn giọng thiết bị.', response.status === 429 ? 429 : 502);
    }
    if (Number(response.headers.get('Content-Length')) > 1024 * 1024) { await response.body?.cancel(); return reply('Âm thanh trả về quá lớn.', 502); }
    let size = 0;
    const stream = response.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(bytes, controller) {
      if ((size += bytes.byteLength) > 1024 * 1024) throw new Error('Audio too large'); controller.enqueue(bytes);
    } }));
    return new Response(stream, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return reply('Kết nối giọng đọc bị gián đoạn. Bấm thử lại hoặc chọn giọng thiết bị.', 502); }
}
