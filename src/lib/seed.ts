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

// Phase 1 — Material catalog multipliers and visual hints per tier
export const MATERIAL_TIERS = ["economy", "mid", "premium"] as const;
export type MaterialTier = (typeof MATERIAL_TIERS)[number];

export const TIER_MULTIPLIERS: Record<MaterialTier, number> = {
  economy: 0.85,
  mid: 1.0,
  premium: 1.45,
};

export const TIER_VISUAL_HINTS: Record<MaterialTier, string> = {
  economy: "أبيض مطفي",
  mid: "بيج بورسلان",
  premium: "رخام فاتح",
};

/**
 * Build 3× Materials entries from DEFAULT_PRICE_ITEMS for a given contractor.
 * Each price item spawns one material per tier with tier-adjusted price and generic visualHint.
 */
export function buildMaterialsForContractor(contractorId: string): {
  contractorId: string;
  category: string;
  itemName: string;
  grade: MaterialTier;
  unit: string;
  unitPrice: number;
  visualHint: string | null;
  isActive: boolean;
}[] {
  const mats: ReturnType<typeof buildMaterialsForContractor> = [];
  for (const item of DEFAULT_PRICE_ITEMS) {
    for (const tier of MATERIAL_TIERS) {
      const mult = TIER_MULTIPLIERS[tier];
      const hint = TIER_VISUAL_HINTS[tier];
      mats.push({
        contractorId,
        category: item.category,
        itemName: item.itemName,
        grade: tier,
        unit: item.unit,
        unitPrice: Math.round(item.unitPrice * mult * 100) / 100,
        visualHint: hint,
        isActive: true,
      });
    }
  }
  return mats;
}

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
    // Backfill materials if contractor exists but has 0 materials (Phase 1 migration)
    try {
      const matCount = await (prisma as unknown as { material: { count: (args: unknown) => Promise<number> } }).material.count({
        where: { contractorId: existing.id },
      });
      if (matCount === 0) {
        const mats = buildMaterialsForContractor(existing.id);
        const matApi = (prisma as unknown as {
          material: { createMany?: (args: unknown) => Promise<unknown>; create: (args: unknown) => Promise<unknown> };
        }).material;
        if (matApi.createMany) {
          await matApi.createMany({ data: mats });
        } else {
          for (const m of mats) {
            await matApi.create({ data: m });
          }
        }
      }
    } catch (e) {
      console.warn("[seed] backfill materials failed", e);
    }
    return existing;
  }

  const mats = buildMaterialsForContractor("tmp"); // placeholder contractorId, will be replaced below
  // For real Prisma we can use nested create; for mock we also support nested materials.create
  // We generate material entries with correct contractorId after we know the id — so we create contractor first then bulk insert materials
  // Try nested create first (works with real Prisma and updated mock)
  try {
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
        materials: {
          create: DEFAULT_PRICE_ITEMS.flatMap((i) =>
            MATERIAL_TIERS.map((tier) => ({
              category: i.category,
              itemName: i.itemName,
              grade: tier,
              unit: i.unit,
              unitPrice: Math.round(i.unitPrice * TIER_MULTIPLIERS[tier] * 100) / 100,
              visualHint: TIER_VISUAL_HINTS[tier],
              isActive: true,
            }))
          ),
        },
      } as never,
    });
    return created;
  } catch (e) {
    // Fallback: create contractor with priceItems only, then insert materials separately
    console.warn("[seed] nested materials create failed, falling back to separate insert", e);
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
    const withId = buildMaterialsForContractor(created.id);
    const matApi = (prisma as unknown as {
      material: { createMany?: (args: unknown) => Promise<unknown>; create: (args: unknown) => Promise<unknown> };
    }).material;
    try {
      if (matApi.createMany) {
        await matApi.createMany({ data: withId });
      } else {
        for (const m of withId) await matApi.create({ data: m });
      }
    } catch (err) {
      console.warn("[seed] materials bulk insert fallback failed", err);
    }
    return created;
  }
}
