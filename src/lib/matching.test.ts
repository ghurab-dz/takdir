import { describe, expect, it } from "vitest";
import { matchExtractedItems, normalizeArabic, tokenOverlap, type PricelistEntry } from "./matching";

const pricelist: PricelistEntry[] = [
  { id: "p1", itemName: "دهان جدران داخلي", unit: "م²", unitPrice: 400 },
  { id: "p2", itemName: "تركيب بلاط أرضية", unit: "م²", unitPrice: 800 },
  { id: "p3", itemName: "نقطة كهرباء (تمديد+تركيب)", unit: "نقطة", unitPrice: 2500 },
];

describe("normalizeArabic", () => {
  it("normalizes alef variants and diacritics", () => {
    expect(normalizeArabic("أرضيّة إضاءة")).toBe(normalizeArabic("ارضية اضاءه"));
  });
  it("treats ة and ه as equal", () => {
    expect(normalizeArabic("نقطة")).toBe(normalizeArabic("نقطه"));
  });
});

describe("tokenOverlap", () => {
  it("identical strings score 1", () => {
    expect(tokenOverlap("دهان جدران", "دهان جدران")).toBe(1);
  });
  it("disjoint strings score 0", () => {
    expect(tokenOverlap("دهان", "بلاط")).toBe(0);
  });
});

describe("matchExtractedItems", () => {
  it("matches exact names and copies price + unit from the pricelist", () => {
    const lines = matchExtractedItems(
      [{ itemName: "دهان جدران داخلي", quantity: 30, unit: "م²" }],
      pricelist,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      priceItemId: "p1",
      unitPrice: 400,
      lineTotal: 12000,
      matched: true,
    });
  });

  it("matches despite alef/ta-marbuta spelling differences", () => {
    const lines = matchExtractedItems(
      [{ itemName: "تركيب بلاط ارضية", quantity: 12, unit: "م²" }],
      pricelist,
    );
    expect(lines[0].priceItemId).toBe("p2");
    expect(lines[0].lineTotal).toBe(9600);
  });

  it("marks unknown items as unmatched with price 0", () => {
    const lines = matchExtractedItems(
      [{ itemName: "تركيب ورق جدران", quantity: 10, unit: "م²" }],
      pricelist,
    );
    expect(lines[0]).toMatchObject({ priceItemId: null, unitPrice: 0, lineTotal: 0, matched: false });
  });

  it("merges duplicate extracted rows for the same price item", () => {
    const lines = matchExtractedItems(
      [
        { itemName: "دهان جدران داخلي", quantity: 20, unit: "م²" },
        { itemName: "دهان جدران داخلي", quantity: 10, unit: "م²" },
      ],
      pricelist,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(30);
    expect(lines[0].lineTotal).toBe(12000);
  });

  it("drops zero/negative quantities", () => {
    const lines = matchExtractedItems(
      [
        { itemName: "دهان جدران داخلي", quantity: 0, unit: "م²" },
        { itemName: "دهان جدران داخلي", quantity: -5, unit: "م²" },
      ],
      pricelist,
    );
    expect(lines).toHaveLength(0);
  });

  it("fuzzy-matches near names above threshold", () => {
    const lines = matchExtractedItems(
      [{ itemName: "نقطة كهرباء تمديد وتركيب", quantity: 4, unit: "نقطة" }],
      pricelist,
    );
    expect(lines[0].priceItemId).toBe("p3");
  });
});
