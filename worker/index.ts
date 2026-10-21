import { sourceRequest, sourceCatalog } from "./source";
import { myMemory } from "./mymemory";
export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  LIBRETRANSLATE_URL?: string;
  LIBRETRANSLATE_API_KEY?: string;
  TRANSLATION_ENABLED?: string;
  TRANSLATION_PROVIDER?: string;
  LOCAL_TRANSLATION?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}
const supported = ["vi", "zh", "en"];
function endpoint(env: Env) {
  if (env.TRANSLATION_ENABLED !== "true" || !env.LIBRETRANSLATE_URL)
    return null;
  const url = new URL(env.LIBRETRANSLATE_URL);
  if (url.username || url.password || url.search || url.hash)
    throw new Error("Cấu hình URL máy chủ dịch không hợp lệ.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.protocol !== "https:" &&
    !(local && env.LOCAL_TRANSLATION === "true" && url.protocol === "http:")
  )
    throw new Error("Máy chủ dịch cần HTTPS.");
  return url.href.replace(/\/$/, "");
}
async function providerLanguages(base: string) {
  const r = await fetch(`${base}/languages`, {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!r.ok)
    throw new Error("Không đọc được danh sách mô hình từ máy chủ dịch.");
  const data: unknown = await r.json();
  if (!Array.isArray(data)) throw new Error("Danh sách ngôn ngữ không hợp lệ.");
  return data
    .filter(
      (p): p is { code: string; targets: string[] } =>
        p && typeof p.code === "string" && Array.isArray(p.targets),
    )
    .filter((p) => supported.includes(p.code))
    .map((p) => ({
      source: p.code,
      targets: p.targets.filter(
        (t: string) => supported.includes(t) && t !== p.code,
      ),
    }));
}
export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/source/catalog") return request.method === "GET" ? sourceCatalog() : json({ error: "Chỉ hỗ trợ GET." }, 405);
  if (url.pathname === "/api/source/inspect") return sourceRequest(request, false);
  if (url.pathname === "/api/source/download") return sourceRequest(request, true);
  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname === "/api/capabilities") {
    try {
      if (env.TRANSLATION_ENABLED === "true" && env.TRANSLATION_PROVIDER === "mymemory") return json({
        configured: true, provider: "MyMemory", pairs: supported.map(source => ({ source, targets: supported.filter(t => t !== source) })),
        reason: "API chính thức MyMemory, miễn phí có hạn mức (thông thường 5.000 ký tự/ngày theo IP dịch vụ). Tạm dừng khi hết hạn mức; không phải dịch không giới hạn.",
      });
      const base = endpoint(env);
      if (!base)
        return json({
          configured: false,
          provider: "LibreTranslate",
          pairs: [],
          reason:
            "Chưa bật máy chủ LibreTranslate tự triển khai. Đọc và lưu dữ liệu vẫn hoạt động.",
        });
      return json({
        configured: true,
        provider: "LibreTranslate",
        pairs: await providerLanguages(base),
      });
    } catch {
      return json({
        configured: false,
        provider: "LibreTranslate",
        pairs: [],
        reason: "Máy chủ dịch không sẵn sàng hoặc cấu hình chưa hợp lệ.",
      });
    }
  }
  if (url.pathname === "/api/translate") {
    if (request.method !== "POST")
      return json({ error: "Chỉ hỗ trợ POST." }, 405);
    // Same-origin browser writes. Never trust a client-provided provider URL or key.
    if (request.headers.get("Origin") !== url.origin)
      return json({ error: "Nguồn yêu cầu không được phép." }, 403);
    if (env.TRANSLATION_ENABLED === "true" && env.TRANSLATION_PROVIDER === "mymemory") return myMemory(request);
    let base: string | null;
    try {
      base = endpoint(env);
    } catch {
      return json({ error: "Cấu hình máy chủ dịch không hợp lệ." }, 503);
    }
    if (!base)
      return json(
        { error: "Chưa cấu hình dịch vụ dịch. Không có văn bản nào được gửi." },
        503,
      );
    const localRequest = ["localhost", "127.0.0.1", "[::1]"].includes(
      url.hostname,
    );
    if (env.LOCAL_TRANSLATION !== "true" || !localRequest) {
      if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY)
        return json(
          { error: "Cần cấu hình xác thực trước khi bật dịch trên Internet." },
          503,
        );
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer "))
        return json({ error: "Cần đăng nhập để dịch." }, 401);
      try {
        const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth },
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);
      } catch {
        return json({ error: "Không xác minh được phiên đăng nhập." }, 503);
      }
    }
    try {
      if (Number(request.headers.get("Content-Length") || 0) > 24000)
        return json({ error: "Yêu cầu quá lớn." }, 413);
      const raw = await request.text();
      if (raw.length > 24000) return json({ error: "Yêu cầu quá lớn." }, 413);
      const body = JSON.parse(raw);
      const { text, source, target } = body;
      if (
        typeof text !== "string" ||
        !text.trim() ||
        text.length > 4000 ||
        !supported.includes(source) ||
        !supported.includes(target) ||
        source === target
      )
        return json(
          {
            error:
              "Văn bản tối đa 4.000 ký tự; chọn hai ngôn ngữ khác nhau trong vi, zh, en.",
          },
          400,
        );
      const pairs = await providerLanguages(base);
      if (!pairs.some((p) => p.source === source && p.targets.includes(target)))
        return json(
          { error: "Máy chủ chưa có mô hình cho cặp ngôn ngữ này." },
          422,
        );
      const r = await fetch(`${base}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          source,
          target,
          format: "text",
          ...(env.LIBRETRANSLATE_API_KEY
            ? { api_key: env.LIBRETRANSLATE_API_KEY }
            : {}),
        }),
        signal: AbortSignal.timeout(25000),
        redirect: "error",
      });
      if (r.status === 429)
        return json(
          {
            error: "Máy chủ báo hết hạn mức. Đã dừng; không chuyển nguồn dịch.",
          },
          429,
        );
      if (!r.ok)
        return json(
          {
            error:
              "Máy chủ dịch từ chối yêu cầu. Không tự thử lại hoặc chuyển nhà cung cấp.",
          },
          502,
        );
      const data = (await r.json()) as { translatedText?: string };
      if (
        typeof data.translatedText !== "string" ||
        !data.translatedText.trim()
      )
        throw new Error("empty");
      return json({
        text: data.translatedText,
        provider: "LibreTranslate",
        at: new Date().toISOString(),
      });
    } catch {
      return json(
        {
          error:
            "Dịch bị gián đoạn hoặc dữ liệu không hợp lệ. Bản dịch đã lưu được giữ nguyên.",
        },
        502,
      );
    }
  }
  if (url.pathname.startsWith("/api/"))
    return json({ error: "Không tìm thấy API." }, 404);
  const response = await env.ASSETS.fetch(request);
  const copy = new Response(response.body, response);
  copy.headers.set("X-Content-Type-Options", "nosniff");
  copy.headers.set("Referrer-Policy", "no-referrer");
  copy.headers.set(
    "Permissions-Policy",
    "microphone=(self), camera=(), geolocation=()",
  );
  copy.headers.set("X-Frame-Options", "DENY");
  copy.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  return copy;
}
export default { fetch: handle };
