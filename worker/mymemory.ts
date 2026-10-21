import { decodeHTML } from 'entities';
const codes: Record<string, string> = { vi: 'vi', en: 'en', zh: 'zh-CN' };
export function utf8Chunks(text: string, maxBytes = 450): string[] {
  const result: string[] = [], chars = Array.from(text);
  let from = 0;
  while (from < chars.length) {
    let to = from, bytes = 0;
    while (to < chars.length) {
      const size = new TextEncoder().encode(chars[to]).length;
      if (bytes + size > maxBytes) break;
      bytes += size; to++;
    }
    if (to === from) throw new Error('Giới hạn đoạn dịch quá nhỏ.');
    if (to < chars.length) {
      const threshold = from + Math.floor((to - from) / 2);
      let split = -1;
      for (let i = to - 1; i >= threshold; i--) if (/[.!?。！？;；\n]/u.test(chars[i])) { split = i + 1; break; }
      if (split < 0) for (let i = to - 1; i >= threshold; i--) if (/\s/u.test(chars[i])) { split = i + 1; break; }
      if (split > from && new TextEncoder().encode(chars.slice(from, split).join('')).length >= 350) to = split;
    }
    result.push(chars.slice(from, to).join('')); from = to;
  }
  return result;
}
export async function myMemory(request: Request): Promise<Response> {
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
  const deadline=AbortSignal.timeout(45000);
  const fetchChunk=async(url:URL)=>{
    for(let attempt=0;attempt<2;attempt++){
      try {
        // workerd accepts only "manual" or "follow"; non-2xx (including redirects)
        // is rejected below, so text is never forwarded to a redirect destination.
        const response=await fetch(url,{signal:AbortSignal.any([deadline,request.signal,AbortSignal.timeout(12000)]),redirect:'manual'});
        // Retry transient transport/server failures once, never quota or language errors.
        if(attempt===0&&response.status>=500){await response.body?.cancel();continue;}
        return response;
      } catch(e) { if(attempt===1||deadline.aborted||request.signal.aborted)throw e; }
    }
    throw new Error('Translation unavailable');
  };
  try {
    if (Number(request.headers.get('Content-Length') || 0) > 24000) return reply({ error: 'Yêu cầu quá lớn.' }, 413);
    const raw = await request.text();
    if (raw.length > 24000) return reply({ error: 'Yêu cầu quá lớn.' }, 413);
    let input;
    try { input=JSON.parse(raw); } catch { return reply({error:'Nội dung yêu cầu không hợp lệ.'},400); }
    const { text, source, target } = input||{};
    if (typeof text !== 'string' || !text.trim() || text.length > 4000 || !['vi', 'zh', 'en'].includes(source) || !['vi', 'zh', 'en'].includes(target) || source === target)
      return reply({ error: 'Văn bản tối đa 4.000 ký tự; chọn hai ngôn ngữ khác nhau trong vi, zh, en.' }, 400);
    const parts: string[] = [];
    for (const chunk of utf8Chunks(text)) {
      if (!chunk.trim()) { parts.push(chunk); continue; }
      const url = new URL('https://api.mymemory.translated.net/get');
      url.search = new URLSearchParams({ q: chunk.trim(), langpair: `${codes[source]}|${codes[target]}`, mt: '1' }).toString();
      const response = await fetchChunk(url);
      if (response.status === 429) return reply({ error: 'MyMemory đã hết hạn mức miễn phí. Bản dịch đã lưu được giữ nguyên; hãy tiếp tục sau khi hạn mức được làm mới.' }, 429);
      if (!response.ok) return reply({ error: 'MyMemory tạm thời không sẵn sàng. Hãy thử lại; các đoạn đã lưu được giữ nguyên.' }, 502);
      const data = await response.json() as { quotaFinished?: boolean; responseStatus?: number; responseDetails?: string; responseData?: { translatedText?: string } };
      const translated = data.responseData?.translatedText;
      if (data.quotaFinished || Number(data.responseStatus) === 429 || /MYMEMORY WARNING|USED ALL AVAILABLE FREE|NEXT AVAILABLE IN/i.test(translated || ''))
        return reply({ error: 'MyMemory đã hết hạn mức miễn phí trong ngày. Không lưu thông báo hạn mức thành bản dịch. Bạn có thể tiếp tục phần còn thiếu vào lần sau.' }, 429);
      if (Number(data.responseStatus) !== 200 || typeof translated !== 'string' || !translated.trim())
        return reply({ error: 'MyMemory chưa dịch được cặp ngôn ngữ hoặc đoạn này. Các bản dịch đã lưu vẫn được giữ.' }, 502);
      parts.push(decodeHTML(translated).trim());
    }
    return reply({ text: parts.join(target === 'zh' ? '' : ' '), provider: 'MyMemory', at: new Date().toISOString() });
  } catch { return reply({ error: 'Không kết nối được nguồn dịch MyMemory. Hãy thử dịch lại hoặc mở Google Dịch. Nghĩa bạn tự nhập vẫn được giữ.' }, 502); }
}
