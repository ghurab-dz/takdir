import { describe, expect, it } from "vitest";
import { buildUserPrompt, SYSTEM_INSTRUCTION, RESPONSE_SCHEMA } from "./prompt";

const items = [
  { itemName: "دهان جدران داخلي", unit: "م²", category: "دهان" },
  { itemName: "تركيب بلاط أرضية", unit: "م²", category: "بلاط" },
];

describe("prompt construction", () => {
  it("includes every allowed item name in the user prompt", () => {
    const p = buildUserPrompt("غرفة نوم", items);
    expect(p).toContain('"دهان جدران داخلي"');
    expect(p).toContain('"تركيب بلاط أرضية"');
  });

  it("includes the contractor description", () => {
    const p = buildUserPrompt("دهان وبلاط لغرفة 12 متر", items);
    expect(p).toContain("دهان وبلاط لغرفة 12 متر");
  });

  it("forbids inventing items and prices (PRD §5 critical rule)", () => {
    expect(SYSTEM_INSTRUCTION).toContain("ممنوع اختراع بنود");
    expect(SYSTEM_INSTRUCTION).toContain("ممنوع منعًا باتًا إخراج أي أسعار");
  });

  it("marks the allowed list as closed", () => {
    const p = buildUserPrompt("x", items);
    expect(p).toContain("قائمة مغلقة");
  });

  it("response schema requires the PRD JSON shape", () => {
    expect(RESPONSE_SCHEMA.required).toEqual(["room_type", "area_m2", "items", "notes"]);
  });
});
