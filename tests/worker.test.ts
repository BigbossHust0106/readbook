import { afterEach, describe, it, expect, vi } from "vitest";
import { handle, type Env } from "../worker";
const env: Env = { ASSETS: { fetch: async () => new Response("app") } };
const configured = {
  ...env,
  TRANSLATION_ENABLED: "true",
  LOCAL_TRANSLATION: "true",
  LIBRETRANSLATE_URL: "http://127.0.0.1:5000",
};
const req = (body: unknown, origin = "http://localhost:8787") =>
  new Request("http://localhost:8787/api/translate", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
afterEach(() => vi.unstubAllGlobals());
describe("Translation boundary (provider mocked, not a live translation test)", () => {
  it("never sends document content when disabled", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await handle(req({ text: "private" }), env)).status).toBe(503);
    expect(f).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests", async () =>
    expect(
      (await handle(req({}, "https://evil.example"), configured)).status,
    ).toBe(403));
  it("rejects unsupported languages before contacting provider", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(
      (
        await handle(
          req({ text: "hi", source: "fr", target: "vi" }),
          configured,
        )
      ).status,
    ).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("forwards only the allowlisted fields to the server-side provider", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([{ code: "vi", targets: ["en", "zh", "fr"] }]),
      )
      .mockResolvedValueOnce(Response.json({ translatedText: "Hello" }));
    vi.stubGlobal("fetch", f);
    const r = await handle(
      req({
        text: "Xin chào",
        source: "vi",
        target: "en",
        url: "https://evil.example",
        api_key: "attacker",
      }),
      { ...configured, LIBRETRANSLATE_API_KEY: "server-test-key" },
    );
    expect(r.status).toBe(200);
    expect(((await r.json()) as { text: string }).text).toBe("Hello");
    expect(f.mock.calls[1][0]).toBe("http://127.0.0.1:5000/translate");
    const forwarded = JSON.parse(f.mock.calls[1][1].body);
    expect(forwarded.api_key).toBe("server-test-key");
    expect(forwarded.url).toBeUndefined();
  });
  it("reports quota exhaustion without retry or fallback", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(Response.json([{ code: "en", targets: ["vi"] }]))
      .mockResolvedValueOnce(new Response("", { status: 429 }));
    vi.stubGlobal("fetch", f);
    const r = await handle(
      req({ text: "Hello", source: "en", target: "vi" }),
      configured,
    );
    expect(r.status).toBe(429);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("does not bypass authentication on a deployed host even with local flag", async () => {
    const r = await handle(
      new Request("https://read.example/api/translate", {
        method: "POST",
        headers: { Origin: "https://read.example" },
        body: "{}",
      }),
      configured,
    );
    expect(r.status).toBe(503);
  });
  it("refuses a missing language model", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json([{ code: "en", targets: ["zh"] }])),
    );
    expect(
      (
        await handle(
          req({ text: "Hello", source: "en", target: "vi" }),
          configured,
        )
      ).status,
    ).toBe(422);
  });
  it("never returns provider errors or keys verbatim", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("secret-key text")),
    );
    const r = await handle(
      req({ text: "Hello", source: "en", target: "vi" }),
      configured,
    );
    expect(await r.text()).not.toContain("secret-key");
  });
});
