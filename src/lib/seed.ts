// Seed — production starter kit with realistic Algerian renovation catalog.
// 58 PriceItems across 9 categories, each spawns 3 Materials (economy/mid/premium) with tier-specific visualHint + price.
// Prices in DZD (2024-2025 market, pose incluse where relevant). Edit freely in /prices.
// No demo estimates — dashboard shows empty CTA.

import { prisma } from "./db";

export type MaterialTier = "economy" | "mid" | "premium";
export const MATERIAL_TIERS: MaterialTier[] = ["economy", "mid", "premium"];

export const TIER_MULTIPLIERS: Record<MaterialTier, number> = {
  economy: 0.85,
  mid: 1.0,
  premium: 1.45,
};

// Generic fallback hints if item-specific hint missing
export const TIER_VISUAL_HINTS: Record<MaterialTier, string> = {
  economy: "أبيض مطفي",
  mid: "بيج بورسلان",
  premium: "رخام فاتح",
};

export interface CatalogItem {
  category: string;
  itemName: string;
  unit: string;
  unitPrice: number; // mid price (base)
  hints: Record<MaterialTier, string>;
}

// ——— Master catalog — 58 بند — أسعار mid — economy/premium محسوبة تلقائياً ———
export const DEFAULT_PRICE_ITEMS: CatalogItem[] = [
  // دهان — 8
  { category: "دهان", itemName: "دهان جدران فينيل مطفي", unit: "م²", unitPrice: 380, hints: { economy: "أبيض مطفي ناصع", mid: "بيج فاتح دافئ", premium: "رمادي فاتح حريري فاخر" } },
  { category: "دهان", itemName: "دهان جدران ساتان قابل للغسل", unit: "م²", unitPrice: 520, hints: { economy: "أبيض لؤلؤي", mid: "أحمر قرميدي دافئ", premium: "أزرق مخملي غامق" } },
  { category: "دهان", itemName: "دهان سقف أبيض مطفي مضاد للرطوبة", unit: "م²", unitPrice: 350, hints: { economy: "أبيض ناصع مطفي", mid: "أبيض كريمي دافئ", premium: "أبيض لؤلؤي مع لمعة حريرية" } },
  { category: "دهان", itemName: "معجون وتهيئة جدران + صنفرة", unit: "م²", unitPrice: 280, hints: { economy: "تهيئة عادية", mid: "تهيئة ناعمة", premium: "تهيئة فائقة النعومة" } },
  { category: "دهان", itemName: "دهان خارجي أكريليك مقاوم", unit: "م²", unitPrice: 680, hints: { economy: "بيج فاتح", mid: "رمادي حجري", premium: "أبيض كريمي مقاوم" } },
  { category: "دهان", itemName: "ورق جدران / بديل رخام PVC", unit: "م²", unitPrice: 1800, hints: { economy: "رخام أبيض بسيط", mid: "رخام بيج عروق خفيفة", premium: "رخام أسود عروق ذهبية فاخر" } },
  { category: "دهان", itemName: "دهان باب ونجارة لاك", unit: "وحدة", unitPrice: 4500, hints: { economy: "أبيض لاك مطفي", mid: "بني خشبي", premium: "أسود مطفي فاخر" } },
  { category: "دهان", itemName: "كورنيش جبس + دهان", unit: "م.ط", unitPrice: 900, hints: { economy: "أبيض بسيط", mid: "أبيض مع ظل بيج", premium: "أبيض مع إضاءة ذهبية" } },

  // بلاط وسيراميك ورخام — 8
  { category: "بلاط", itemName: "بلاط أرضية سيراميك 30×30", unit: "م²", unitPrice: 1400, hints: { economy: "سيراميك أبيض 30×30 مطفي", mid: "سيراميك بيج 30×30", premium: "سيراميك رمادي حجري 30×30" } },
  { category: "بلاط", itemName: "بورسلان أرضية 60×60", unit: "م²", unitPrice: 2100, hints: { economy: "بورسلان أبيض 60×60", mid: "بورسلان بيج فاتح 60×60", premium: "بورسلان رخامي كريمي 60×60 لامع" } },
  { category: "بلاط", itemName: "رخام أرضية 80×80 لامع", unit: "م²", unitPrice: 3800, hints: { economy: "رخام أبيض عروق رمادية", mid: "رخام بيج كريمي", premium: "رخام أسود عروق ذهبية فاخر 80×80" } },
  { category: "بلاط", itemName: "فايونس مطبخ 30×60", unit: "م²", unitPrice: 1700, hints: { economy: "فايونس أبيض لامع 30×60", mid: "فايونس بيج مزخرف", premium: "فايونس رخامي أبيض وذهبي" } },
  { category: "بلاط", itemName: "فايونس حمام مزخرف", unit: "م²", unitPrice: 1900, hints: { economy: "فايونس أبيض بسيط", mid: "فايونس رمادي حجري", premium: "فايونس رخامي بيج فاخر" } },
  { category: "بلاط", itemName: "بورسلان حائط لامع", unit: "م²", unitPrice: 2200, hints: { economy: "بورسلان أبيض لامع", mid: "بورسلان بيج لامع", premium: "بورسلان رخامي لامع" } },
  { category: "بلاط", itemName: "عتبة رخام", unit: "م.ط", unitPrice: 2500, hints: { economy: "رخام أبيض", mid: "رخام بيج", premium: "رخام أسود فاخر" } },
  { category: "بلاط", itemName: "بانوار / بلينت سيراميك", unit: "م.ط", unitPrice: 400, hints: { economy: "أبيض مطفي", mid: "بيج", premium: "رخامي" } },

  // جبس وبلاكو — 6
  { category: "جبس", itemName: "سقف بلاكو بلاتر بسيط", unit: "م²", unitPrice: 1800, hints: { economy: "سقف أبيض مستوي بسيط", mid: "سقف أبيض مع كورنيش", premium: "سقف أبيض مع تفاصيل كلاسيك" } },
  { category: "جبس", itemName: "سقف بلاكو مع إضاءة مخفية LED", unit: "م²", unitPrice: 3200, hints: { economy: "LED أبيض بسيط", mid: "LED دافئ مخفي", premium: "LED ذهبي + سبوتات فاخرة" } },
  { category: "جبس", itemName: "حائط فاصل بلاكو", unit: "م²", unitPrice: 2000, hints: { economy: "حائط أبيض بسيط", mid: "حائط أبيض مع رفوف", premium: "حائط مع بديل خشب فاخر" } },
  { category: "جبس", itemName: "كورنيش جبس كلاسيك", unit: "م.ط", unitPrice: 750, hints: { economy: "كورنيش أبيض بسيط 8سم", mid: "كورنيش أبيض مزخرف 12سم", premium: "كورنيش كلاسيك فاخر 15سم" } },
  { category: "جبس", itemName: "رفوف / نيچ جبس", unit: "وحدة", unitPrice: 5500, hints: { economy: "رف أبيض بسيط", mid: "رف مع إضاءة LED", premium: "رف رخامي مع إضاءة ذهبية" } },
  { category: "جبس", itemName: "عازل صوت وحرارة للسقف", unit: "م²", unitPrice: 900, hints: { economy: "عازل أساسي", mid: "عازل صوف صخري", premium: "عازل فاخر مزدوج" } },

  // كهرباء وإنارة — 8
  { category: "كهرباء", itemName: "نقطة كهرباء تمديد + علبة", unit: "نقطة", unitPrice: 2800, hints: { economy: "علبة بيضاء بسيطة", mid: "علبة بيج مع قاطع", premium: "علبة زجاجية سوداء ذكية" } },
  { category: "كهرباء", itemName: "سبوت LED غاطس 7W", unit: "وحدة", unitPrice: 1100, hints: { economy: "سبوت أبيض 7W", mid: "سبوت أسود 7W", premium: "سبوت ذهبي كريستال 7W" } },
  { category: "كهرباء", itemName: "ثريا سقف مودرن", unit: "وحدة", unitPrice: 8500, hints: { economy: "ثريا بيضاء بسيطة", mid: "ثريا سوداء مودرن", premium: "ثريا كريستال ذهبية فاخرة" } },
  { category: "كهرباء", itemName: "شريط LED مخفي", unit: "م.ط", unitPrice: 950, hints: { economy: "LED أبيض", mid: "LED دافئ 3000K", premium: "LED RGB ذكي" } },
  { category: "كهرباء", itemName: "لوحة كهرباء 12 خط", unit: "بالمقطوع", unitPrice: 9000, hints: { economy: "لوحة بيضاء عادية", mid: "لوحة معدنية", premium: "لوحة ذكية" } },
  { category: "كهرباء", itemName: "مأخذ USB / قاطع ذكي", unit: "وحدة", unitPrice: 1800, hints: { economy: "مأخذ أبيض", mid: "مأخذ أسود", premium: "مأخذ زجاجي ذهبي" } },
  { category: "كهرباء", itemName: "مروحة سقف", unit: "وحدة", unitPrice: 12000, hints: { economy: "مروحة بيضاء 3 شفرات", mid: "مروحة خشبية", premium: "مروحة سوداء مع إضاءة" } },
  { category: "كهرباء", itemName: "إنترفون فيديو", unit: "بالمقطوع", unitPrice: 15000, hints: { economy: "إنترفون صوتي", mid: "إنترفون فيديو ملون", premium: "إنترفون ذكي WiFi" } },

  // سباكة وصحي — 7
  { category: "سباكة", itemName: "نقطة سباكة ماء بارد/ساخن", unit: "نقطة", unitPrice: 3500, hints: { economy: "توصيل PPR عادي", mid: "PPR مع عزل", premium: "نحاس مع عزل فاخر" } },
  { category: "سباكة", itemName: "مرحاض معلق", unit: "وحدة", unitPrice: 28000, hints: { economy: "مرحاض أبيض بسيط", mid: "مرحاض أبيض مع غطاء سوفت", premium: "مرحاض أسود معلق فاخر" } },
  { category: "سباكة", itemName: "حوض غسيل مع خلاط", unit: "وحدة", unitPrice: 16000, hints: { economy: "حوض أبيض 60سم", mid: "حوض بيج 80سم", premium: "حوض أسود رخامي 80سم" } },
  { category: "سباكة", itemName: "دش مطري مع خلاط", unit: "وحدة", unitPrice: 22000, hints: { economy: "دش كروم بسيط", mid: "دش أسود مطري", premium: "دش ذهبي مطري فاخر" } },
  { category: "سباكة", itemName: "بانيو أكريليك", unit: "وحدة", unitPrice: 35000, hints: { economy: "بانيو أبيض 150سم", mid: "بانيو أبيض 170سم", premium: "بانيو جاكوزي فاخر" } },
  { category: "سباكة", itemName: "سخان ماء 80 لتر", unit: "وحدة", unitPrice: 24000, hints: { economy: "سخان عادي 80ل", mid: "سخان ستانلس 80ل", premium: "سخان ذكي 80ل" } },
  { category: "سباكة", itemName: "تصريف أرضية + سيفون", unit: "وحدة", unitPrice: 2500, hints: { economy: "سيفون بلاستيك", mid: "سيفون ستانلس", premium: "سيفون مخفي" } },

  // نجارة وألمنيوم — 7
  { category: "نجارة", itemName: "باب داخلي MDF مع إطار", unit: "وحدة", unitPrice: 18500, hints: { economy: "باب أبيض MDF", mid: "باب بني خشبي", premium: "باب أسود مع زجاج فاخر" } },
  { category: "نجارة", itemName: "باب ألمنيوم زجاجي", unit: "م²", unitPrice: 16000, hints: { economy: "ألمنيوم أبيض زجاج شفاف", mid: "ألمنيوم أسود زجاج", premium: "ألمنيوم خشبي زجاج مزدوج" } },
  { category: "نجارة", itemName: "خزانة حائط كولوار", unit: "م²", unitPrice: 19000, hints: { economy: "خزانة بيضاء MDF", mid: "خزانة بنية خشبية", premium: "خزانة سوداء زجاجية فاخرة" } },
  { category: "نجارة", itemName: "مطبخ MDF علوي وسفلي", unit: "م.ط", unitPrice: 28000, hints: { economy: "مطبخ أبيض MDF", mid: "مطبخ بيج خشبي", premium: "مطبخ أسود لامع فاخر" } },
  { category: "نجارة", itemName: "مطبخ ألمنيوم", unit: "م.ط", unitPrice: 22000, hints: { economy: "ألمنيوم أبيض", mid: "ألمنيوم خشبي", premium: "ألمنيوم أسود فاخر" } },
  { category: "نجارة", itemName: "شباك PVC مزدوج زجاج", unit: "م²", unitPrice: 14500, hints: { economy: "PVC أبيض", mid: "PVC بني خشبي", premium: "PVC أسود مزدوج فاخر" } },
  { category: "نجارة", itemName: "درابزين حديد / إينوكس", unit: "م.ط", unitPrice: 11000, hints: { economy: "حديد أسود بسيط", mid: "إينوكس فضي", premium: "إينوكس ذهبي فاخر" } },

  // أرضيات — 4
  { category: "أرضيات", itemName: "باركيه HDF خشبي", unit: "م²", unitPrice: 3200, hints: { economy: "باركيه فاتح", mid: "باركيه بني متوسط", premium: "باركيه غامق فاخر" } },
  { category: "أرضيات", itemName: "باركيه PVC", unit: "م²", unitPrice: 2100, hints: { economy: "PVC فاتح", mid: "PVC بني", premium: "PVC غامق فاخر" } },
  { category: "أرضيات", itemName: "موكيت أرضي", unit: "م²", unitPrice: 1800, hints: { economy: "موكيت بيج بسيط", mid: "موكيت رمادي", premium: "موكيت فاخر سميك" } },
  { category: "أرضيات", itemName: "أرضية إيبوكسي 3D", unit: "م²", unitPrice: 4200, hints: { economy: "إيبوكسي أبيض", mid: "إيبوكسي رخامي", premium: "إيبوكسي 3D فاخر" } },

  // ديكور — 5
  { category: "ديكور", itemName: "بديل خشب WPC للجدران", unit: "م²", unitPrice: 3800, hints: { economy: "WPC فاتح", mid: "WPC بني متوسط", premium: "WPC غامق فاخر مع إضاءة" } },
  { category: "ديكور", itemName: "بديل رخام PVC لامع", unit: "م²", unitPrice: 2600, hints: { economy: "رخام أبيض PVC", mid: "رخام بيج PVC", premium: "رخام أسود ذهبي PVC فاخر" } },
  { category: "ديكور", itemName: "حجر ديكوري داخلي", unit: "م²", unitPrice: 3100, hints: { economy: "حجر أبيض بسيط", mid: "حجر بيج", premium: "حجر رمادي فاخر" } },
  { category: "ديكور", itemName: "مرآة حائط كبيرة", unit: "م²", unitPrice: 8500, hints: { economy: "مرآة عادية", mid: "مرآة مع إطار أسود", premium: "مرآة مع إضاءة LED فاخرة" } },
  { category: "ديكور", itemName: "ستائر بلاك أوت مع سكة", unit: "م.ط", unitPrice: 3500, hints: { economy: "ستائر بيج بسيطة", mid: "ستائر رمادية", premium: "ستائر مخملية فاخرة" } },

  // عام — 5
  { category: "عام", itemName: "هدم وتفكيك أرضية قديمة", unit: "م²", unitPrice: 450, hints: { economy: "تفكيك يدوي", mid: "تفكيك + تنظيف", premium: "تفكيك + تنظيف + نقل" } },
  { category: "عام", itemName: "هدم حائط + إزالة", unit: "م²", unitPrice: 1200, hints: { economy: "هدم بسيط", mid: "هدم + تنظيف", premium: "هدم + تنظيف + نقل" } },
  { category: "عام", itemName: "نقل مخلفات شاحنة", unit: "بالمقطوع", unitPrice: 6000, hints: { economy: "نقل شاحنة صغيرة", mid: "شاحنة متوسطة", premium: "شاحنة كبيرة" } },
  { category: "عام", itemName: "تنظيف نهائي شقة", unit: "م²", unitPrice: 150, hints: { economy: "تنظيف أساسي", mid: "تنظيف شامل", premium: "تنظيف فاخر مع تلميع" } },
  { category: "عام", itemName: "عزل مائي للحمام", unit: "م²", unitPrice: 1100, hints: { economy: "عزل أساسي", mid: "عزل بيتومين", premium: "عزل إيبوكسي فاخر" } },
];

const DEFAULT_CONTRACTOR_NAME = "مؤسسة النور للتشطيب";
const DEFAULT_CONTRACTOR_PHONE = "0555123456";

// ——— Build Materials (3 per PriceItem) with tier-specific visualHint + price ———
export function buildMaterialsForContractor(contractorId: string) {
  const mats: {
    contractorId: string;
    category: string;
    itemName: string;
    grade: MaterialTier;
    unit: string;
    unitPrice: number;
    visualHint: string | null;
    isActive: boolean;
  }[] = [];
  for (const item of DEFAULT_PRICE_ITEMS) {
    for (const tier of MATERIAL_TIERS) {
      const mult = TIER_MULTIPLIERS[tier];
      const hint = item.hints[tier] ?? TIER_VISUAL_HINTS[tier];
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

// Sync helpers
async function syncPriceItems(contractorId: string) {
  const existing = await prisma.priceItem.findMany({ where: { contractorId } });
  const existingNames = new Set(existing.map((p) => `${p.category}::${p.itemName}`));
  const toCreate = DEFAULT_PRICE_ITEMS.filter((i) => !existingNames.has(`${i.category}::${i.itemName}`));
  if (toCreate.length === 0) return 0;
  // Use createMany if available, else loop
  const data = toCreate.map((i) => ({
    contractorId,
    category: i.category,
    itemName: i.itemName,
    unit: i.unit,
    unitPrice: i.unitPrice,
    isActive: true,
  }));
  try {
    const api = prisma.priceItem as unknown as { createMany?: (args: unknown) => Promise<unknown>; create: (a: unknown) => Promise<unknown> };
    if (api.createMany) await api.createMany({ data });
    else for (const d of data) await api.create({ data: d });
  } catch (e) {
    console.warn("[seed] syncPriceItems failed", e);
    return 0;
  }
  return toCreate.length;
}

async function syncMaterials(contractorId: string) {
  const existing = await (prisma as unknown as { material: { findMany: (a: unknown) => Promise<{ category: string; itemName: string; grade: string }[]> } }).material.findMany({
    where: { contractorId },
  });
  const existingKeys = new Set(existing.map((m) => `${m.category}::${m.itemName}::${m.grade}`));
  const allMats = buildMaterialsForContractor(contractorId);
  const toCreate = allMats.filter((m) => !existingKeys.has(`${m.category}::${m.itemName}::${m.grade}`));
  if (toCreate.length === 0) return 0;
  const api = (prisma as unknown as { material: { createMany?: (a: unknown) => Promise<unknown>; create: (a: unknown) => Promise<unknown> } }).material;
  try {
    if (api.createMany) await api.createMany({ data: toCreate });
    else for (const m of toCreate) await api.create({ data: m });
  } catch (e) {
    console.warn("[seed] syncMaterials failed", e);
    return 0;
  }
  return toCreate.length;
}

/**
 * MVP has no login: single default contractor.
 * Production: price starter template seeded; no demo estimates.
 * On every call, backfills missing catalog items (upgrade path for existing DBs with 13 items).
 */
export async function ensureDefaultContractor() {
  const existing = await prisma.contractor.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) {
    if (!existing.phone && DEFAULT_CONTRACTOR_PHONE) {
      try {
        await prisma.contractor.update({ where: { id: existing.id }, data: { phone: DEFAULT_CONTRACTOR_PHONE } });
        (existing as unknown as { phone: string }).phone = DEFAULT_CONTRACTOR_PHONE;
      } catch {}
    }
    // Upgrade path: enrich catalog if contractor was seeded with old 13 items
    try {
      const addedPrices = await syncPriceItems(existing.id);
      const addedMats = await syncMaterials(existing.id);
      if (addedPrices > 0 || addedMats > 0) console.log(`[seed] upgraded catalog: +${addedPrices} priceItems +${addedMats} materials for ${existing.id.slice(0, 8)}`);
    } catch (e) {
      console.warn("[seed] catalog upgrade failed", e);
    }
    return existing;
  }

  // Create new contractor with full catalog
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
              visualHint: i.hints[tier] ?? TIER_VISUAL_HINTS[tier],
              isActive: true,
            }))
          ),
        },
      } as never,
    });
    return created;
  } catch (e) {
    console.warn("[seed] nested create failed, fallback", e);
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
    const mats = buildMaterialsForContractor(created.id);
    const matApi = (prisma as unknown as { material: { createMany?: (a: unknown) => Promise<unknown>; create: (a: unknown) => Promise<unknown> } }).material;
    try {
      if (matApi.createMany) await matApi.createMany({ data: mats });
      else for (const m of mats) await matApi.create({ data: m });
    } catch (err) {
      console.warn("[seed] materials fallback failed", err);
    }
    return created;
  }
}

// For template apply: replace catalog with subset
export async function applyTemplateToContractor(contractorId: string, templateItemNames: string[]) {
  const wanted = new Set(templateItemNames);
  const itemsToCreate = DEFAULT_PRICE_ITEMS.filter((i) => wanted.has(i.itemName));
  // Deactivate items not in template instead of deleting (keep history)
  const existing = await prisma.priceItem.findMany({ where: { contractorId } });
  const existingByName = new Map(existing.map((p) => [p.itemName, p]));
  // Activate wanted, deactivate others (but don't delete — entrepreneur can re-enable)
  for (const p of existing) {
    const shouldActive = wanted.has(p.itemName);
    if (p.isActive !== shouldActive) {
      await prisma.priceItem.update({ where: { id: p.id }, data: { isActive: shouldActive } });
    }
  }
  // Create missing wanted items
  for (const item of itemsToCreate) {
    if (!existingByName.has(item.itemName)) {
      await prisma.priceItem.create({ data: { contractorId, category: item.category, itemName: item.itemName, unit: item.unit, unitPrice: item.unitPrice, isActive: true } });
    }
  }
  // Sync materials similarly
  const mats = await (prisma as unknown as { material: { findMany: (a: unknown) => Promise<{ id: string; itemName: string; grade: string; isActive: boolean }[]> } }).material.findMany({ where: { contractorId } });
  const matByKey = new Map(mats.map((m) => [`${m.itemName}::${m.grade}`, m]));
  for (const item of DEFAULT_PRICE_ITEMS) {
    const inTemplate = wanted.has(item.itemName);
    for (const tier of MATERIAL_TIERS) {
      const key = `${item.itemName}::${tier}`;
      const existingMat = matByKey.get(key);
      if (existingMat) {
        if (existingMat.isActive !== inTemplate) {
          await (prisma as unknown as { material: { update: (a: unknown) => Promise<unknown> } }).material.update({ where: { id: existingMat.id }, data: { isActive: inTemplate } });
        }
      } else if (inTemplate) {
        await (prisma as unknown as { material: { create: (a: unknown) => Promise<unknown> } }).material.create({
          data: {
            contractorId,
            category: item.category,
            itemName: item.itemName,
            grade: tier,
            unit: item.unit,
            unitPrice: Math.round(item.unitPrice * TIER_MULTIPLIERS[tier] * 100) / 100,
            visualHint: item.hints[tier],
            isActive: true,
          },
        });
      }
    }
  }
}
