// Seed template (PRD §4) — production starter kit.
// Starter pricebook: contractor edits these to their real prices immediately.
// No demo estimates are created in production — dashboard shows empty CTA.
import { prisma } from "./db";

export const DEFAULT_PRICE_ITEMS: {
  category: string;
  itemName: string;
  unit: string;
  unitPrice: number;
}[] = [
  // دهان — 4 بنود
  { category: "دهان", itemName: "دهان جدران داخلي", unit: "م²", unitPrice: 400 },
  { category: "دهان", itemName: "دهان سقف أبيض مطفي", unit: "م²", unitPrice: 350 },
  { category: "دهان", itemName: "دهان جدران خارجي مقاوم", unit: "م²", unitPrice: 650 },
  { category: "دهان", itemName: "معجون وتهيئة جدران", unit: "م²", unitPrice: 250 },
  // بلاط — 4 بنود
  { category: "بلاط", itemName: "تركيب بلاط أرضية", unit: "م²", unitPrice: 800 },
  { category: "بلاط", itemName: "تركيب بلاط حائط", unit: "م²", unitPrice: 900 },
  { category: "بلاط", itemName: "تركيب سيراميك حمام", unit: "م²", unitPrice: 1100 },
  { category: "بلاط", itemName: "تركيب رخام أرضية", unit: "م²", unitPrice: 1600 },
  // كهرباء — 3 بنود
  { category: "كهرباء", itemName: "نقطة كهرباء (تمديد+تركيب)", unit: "نقطة", unitPrice: 2500 },
  { category: "كهرباء", itemName: "تركيب سبوت لايت LED", unit: "وحدة", unitPrice: 900 },
  { category: "كهرباء", itemName: "لوحة كهرباء رئيسية", unit: "بالمقطوع", unitPrice: 7500 },
  // عام — 2 بنود
  { category: "عام", itemName: "تفكيك/تنظيف أرضية قديمة", unit: "م²", unitPrice: 200 },
  { category: "عام", itemName: "نقل مخلفات ورشة", unit: "بالمقطوع", unitPrice: 3500 },
];

const DEFAULT_CONTRACTOR_NAME = "مؤسسة النور للتشطيب";
const DEFAULT_CONTRACTOR_PHONE = "0555123456";

/**
 * MVP has no login (per decision): single default contractor.
 * Production: only the price starter template is seeded — no demo estimates.
 * Dashboard empty state shows “Create first estimate” CTA when estimates === 0.
 */
export async function ensureDefaultContractor() {
  const existing = await prisma.contractor.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    // Backfill phone if empty (upgrade path)
    if (!existing.phone && DEFAULT_CONTRACTOR_PHONE) {
      try {
        await prisma.contractor.update({
          where: { id: existing.id },
          data: { phone: DEFAULT_CONTRACTOR_PHONE },
        });
        existing.phone = DEFAULT_CONTRACTOR_PHONE;
      } catch {}
    }
    return existing;
  }

  const created = await prisma.contractor.create({
    data: {
      name: DEFAULT_CONTRACTOR_NAME,
      phone: DEFAULT_CONTRACTOR_PHONE,
      priceItems: {
        create: DEFAULT_PRICE_ITEMS.map((i) => ({
          category: i.category,
          itemName: i.itemName,
          unit: i.unit,
          unitPrice: i.unitPrice,
        })),
      },
    } as never,
  });

  return created;
}
