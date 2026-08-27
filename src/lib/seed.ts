// Seed template (PRD §4) — inserted automatically for every new contractor.
// These are rough starting numbers ONLY; the contractor edits them immediately.

import { prisma } from "./db";

export const DEFAULT_PRICE_ITEMS: {
  category: string;
  itemName: string;
  unit: string;
  unitPrice: number;
}[] = [
  { category: "دهان", itemName: "دهان جدران داخلي", unit: "م²", unitPrice: 400 },
  { category: "بلاط", itemName: "تركيب بلاط أرضية", unit: "م²", unitPrice: 800 },
  { category: "بلاط", itemName: "تركيب بلاط حائط", unit: "م²", unitPrice: 900 },
  { category: "كهرباء", itemName: "نقطة كهرباء (تمديد+تركيب)", unit: "نقطة", unitPrice: 2500 },
  { category: "عام", itemName: "تفكيك/تنظيف أرضية قديمة", unit: "م²", unitPrice: 200 },
];

const DEFAULT_CONTRACTOR_NAME = "مقاولي (عدّل اسمك من قائمة الأسعار)";

/**
 * MVP has no login (per decision): the app operates on a single default
 * contractor, created on first run together with the seed price template.
 * The data model already supports many contractors for later.
 */
export async function ensureDefaultContractor() {
  const existing = await prisma.contractor.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.contractor.create({
    data: {
      name: DEFAULT_CONTRACTOR_NAME,
      priceItems: {
        create: DEFAULT_PRICE_ITEMS.map((i) => ({
          category: i.category,
          itemName: i.itemName,
          unit: i.unit,
          unitPrice: i.unitPrice,
        })),
      },
    },
  });
}
