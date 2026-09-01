import { describe, it, expect } from "vitest";
import { buildRenderPrompt, hashRenderInput, RENDER_SYSTEM_INSTRUCTION } from "./render-prompt";

describe("render-prompt", () => {
  it("system instruction forbids inventing decor", () => {
    expect(RENDER_SYSTEM_INSTRUCTION).toContain("ممنوع إضافة أثاث");
    expect(RENDER_SYSTEM_INSTRUCTION).toContain("فقط");
  });

  it("builds prompt with allowed list", () => {
    const p = buildRenderPrompt(
      [
        { itemName: "دهان جدران داخلي", category: "دهان" },
        { itemName: "تركيب بلاط أرضية", category: "بلاط" },
      ],
      "غرفة نوم",
    );
    expect(p).toContain("دهان جدران داخلي");
    expect(p).toContain("تركيب بلاط أرضية");
    expect(p).toContain("غرفة نوم");
    expect(p).toContain("لا تضف");
  });

  it("handles empty items", () => {
    const p = buildRenderPrompt([], null);
    expect(p).toContain("فارغة");
  });

  it("hash is stable and order-independent", () => {
    const a = hashRenderInput(
      [
        { itemName: "ب", category: "دهان" },
        { itemName: "أ", category: "بلاط" },
      ],
      "صالون",
    );
    const b = hashRenderInput(
      [
        { itemName: "أ", category: "بلاط" },
        { itemName: "ب", category: "دهان" },
      ],
      "صالون",
    );
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it("hash changes when roomType changes", () => {
    const h1 = hashRenderInput([{ itemName: "دهان جدران داخلي", category: "دهان" }], "مطبخ");
    const h2 = hashRenderInput([{ itemName: "دهان جدران داخلي", category: "دهان" }], "حمام");
    expect(h1).not.toBe(h2);
  });
});
