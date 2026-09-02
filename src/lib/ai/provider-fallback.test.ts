import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("provider — OpenRouter only (no mock)", () => {
  let origEnv: string | undefined;

  beforeEach(() => {
    origEnv = process.env.OPENROUTER_API_KEY;
    vi.resetModules();
  });
  afterEach(() => {
    if (origEnv === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = origEnv;
    vi.resetModules();
  });

  it("getAiProvider throws for invalid/missing key", async () => {
    process.env.OPENROUTER_API_KEY = "TEST_INVALID_KEY";
    const { getAiProvider } = await import("./index");
    expect(() => getAiProvider()).toThrow();
  });

  it("getAiProvider throws for missing key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { getAiProvider } = await import("./index");
    expect(() => getAiProvider()).toThrow();
  });

  it("getAiProvider returns openrouter for valid sk-or key", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    vi.resetModules();
    const { getAiProvider } = await import("./index");
    const p = getAiProvider();
    expect(p.name).toBe("openrouter");
  });

  it("getImageProvider throws for missing key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { getImageProvider } = await import("./index");
    expect(() => getImageProvider()).toThrow();
  });

  it("getImageProvider returns openrouter for valid key (seedream)", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    vi.resetModules();
    const { getImageProvider } = await import("./index");
    const p = getImageProvider();
    expect(p.name).toBe("openrouter");
  });

  it("isQuotaError detects 429/quota", async () => {
    const { isQuotaError } = await import("./index");
    expect(isQuotaError(new Error("429 quota exceeded"))).toBe(true);
    expect(isQuotaError(new Error("تجاوزت الحصة"))).toBe(true);
    expect(isQuotaError(new Error("some other error"))).toBe(false);
  });
});
