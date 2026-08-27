import { describe, expect, it } from "vitest";
import { buildQuoteText, buildWhatsAppLink } from "./whatsapp";

const sample = {
  contractorName: "مؤسسة البناء الحديث",
  contractorPhone: "+213 555 12 34 56",
  clientName: "السيد أحمد",
  roomType: "مطبخ",
  date: "2026-08-27",
  lines: [
    { itemName: "دهان جدران داخلي", quantity: 30, unit: "م²", unitPrice: 400, lineTotal: 12000 },
    { itemName: "نقطة كهرباء (تمديد+تركيب)", quantity: 4, unit: "نقطة", unitPrice: 2500, lineTotal: 10000 },
  ],
  total: 22000,
};

describe("buildQuoteText", () => {
  it("includes contractor, client, lines and total", () => {
    const t = buildQuoteText(sample);
    expect(t).toContain("عرض سعر — مؤسسة البناء الحديث");
    expect(t).toContain("الزبون: السيد أحمد");
    expect(t).toContain("دهان جدران داخلي — 30 م² × 400 = 12 000 دج");
    expect(t).toContain("المجموع الكلي: 22 000 دج");
  });

  it("omits optional fields when missing", () => {
    const t = buildQuoteText({ ...sample, clientName: null, roomType: null, contractorPhone: null });
    expect(t).not.toContain("الزبون:");
    expect(t).not.toContain("المكان:");
    expect(t).not.toContain("الهاتف:");
  });
});

describe("buildWhatsAppLink", () => {
  it("builds a wa.me link with normalized phone", () => {
    const link = buildWhatsAppLink("مرحبا", "+213 555 12 34 56");
    expect(link).toBe(`https://wa.me/213555123456?text=${encodeURIComponent("مرحبا")}`);
  });

  it("builds a contact-picker link without phone", () => {
    const link = buildWhatsAppLink("مرحبا", null);
    expect(link).toBe(`https://wa.me/?text=${encodeURIComponent("مرحبا")}`);
  });
});
