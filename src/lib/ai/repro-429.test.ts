import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { GeminiProvider } from "./gemini";

describe("[DEBUG-R429] render 429 leak — Phase1 harness", () => {
  const base64 = "fakebase64data".repeat(50);
  let origFetch: typeof fetch;
  beforeEach(() => { origFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = origFetch; vi.restoreAllMocks(); });

  it("GREEN — gemini.render 429 now returns friendly Arabic (fixed)", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 429,
            message:
              "You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests",
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const gemini = new GeminiProvider("AIzaFakeKeyForTest1234567890");
    let caught: unknown = null;
    try {
      await gemini.render({
        basePhoto: { data: base64, mimeType: "image/jpeg" },
        items: [{ itemName: "دهان جدران داخلي", category: "دهان", unit: "م²" }],
        roomType: "صالون",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    const msg = String((caught as Error).message);
    console.log("[DEBUG-R429] caught FIXED:", msg.slice(0, 500));
    // Must start with friendly Arabic, not raw JSON
    expect(msg.startsWith("تجاوزت الحصة")).toBe(true);
    expect(msg).toContain("الحصة");
    expect(msg).toContain("429");
  });
});
