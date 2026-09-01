import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("provider fallback on quota / invalid key", () => {
  const base64 = "a".repeat(200);
  let origFetch: typeof fetch;
  let origEnv: string | undefined;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    origEnv = process.env.GEMINI_API_KEY;
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    if (origEnv === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = origEnv;
    vi.resetModules();
  });

  it("getAiProvider returns mock for AQ. invalid key (H2)", async () => {
    process.env.GEMINI_API_KEY = process.env.TEST_GCP_API_KEY ?? "TEST_INVALID_KEY";
    const { getAiProvider } = await import("./index");
    const p = getAiProvider();
    expect(p.name).toBe("mock");
  });

  it("getAiProvider returns gemini for AIza key", async () => {
    process.env.GEMINI_API_KEY = "AIzaSyFakeValidKey12345678901234567890";
    vi.resetModules();
    const { getAiProvider } = await import("./index");
    const p = getAiProvider();
    expect(p.name).toBe("gemini");
  });

  it("gemini 429 isQuota → fallback mock would be used (renders.ts logic)", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: 429, message: "quota exceeded" } }), {
        status: 429,
      })
    ) as unknown as typeof fetch;
    const { GeminiProvider } = await import("./gemini");
    const { MockProvider } = await import("./mock");
    const g = new GeminiProvider("AIzaFakeKeyForTest1234567890");
    let err: Error | null = null;
    try {
      await g.render({
        basePhoto: { data: base64, mimeType: "image/jpeg" },
        items: [{ itemName: "دهان", category: "دهان", unit: "م²" }],
        roomType: null,
      });
    } catch (e) {
      err = e as Error;
    }
    expect(err).not.toBeNull();
    const msg = err!.message;
    const isQuota =
      msg.includes("429") || msg.includes("الحصة") || msg.toLowerCase().includes("quota");
    expect(isQuota).toBe(true);
    // fallback would trigger MockProvider
    const mock = new MockProvider();
    const res = await mock.render({
      basePhoto: { data: base64, mimeType: "image/jpeg" },
      items: [{ itemName: "دهان", category: "دهان", unit: "م²" }],
      roomType: null,
    });
    expect(res.imageBase64).toBe(base64);
    expect(res.model).toBe("mock");
  });
});
