// Seed template (PRD §4) — enriched for demo.
// These are rough starting numbers ONLY; the contractor edits them immediately.
// For mock/demo mode we seed a richer list so testers see a real-world pricebook.

import { prisma } from "./db";
import { randomUUID as cryptoRandomUUID } from "crypto";

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
 * MVP has no login (per decision): the app operates on a single default
 * contractor, created on first run together with the seed price template.
 * The data model already supports many contractors for later.
 */
export async function ensureDefaultContractor() {
  const existing = await prisma.contractor.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    // Seed demo estimates lazily once, after contractor exists but before dashboard renders.
    // Runs only if no estimates exist yet — safe idempotent.
    await seedDemoEstimatesIfNeeded(existing.id);
    // Backfill phone if still placeholder empty (demo upgrade)
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

  // Seed demo estimates right after first contractor creation
  await seedDemoEstimatesIfNeeded(created.id);

  return created;
}

// ---------------------------------------------------------------------------
// Demo / mock estimates — 5 realistic cases covering all flows:
//  - draft + final statuses, varied rooms, unmatched-item example, AI notes.

async function seedDemoEstimatesIfNeeded(contractorId: string) {
  try {
    // Check if estimates already exist
    const existingEstimates = await prisma.estimate.findMany({
      where: { contractorId },
    });
    if (existingEstimates.length > 0) return;

    const pricelist = await prisma.priceItem.findMany({
      where: { contractorId },
    });
    if (pricelist.length === 0) return;

    const byName = (name: string) => pricelist.find((p) => p.itemName === name);

    // Helper to build a line from pricelist (copies unit/price)
    const lineFrom = (name: string, qty: number) => {
      const p = byName(name);
      if (!p) return null;
      const unitPrice = Number((p as unknown as { unitPrice: number }).unitPrice);
      return {
        priceItemId: (p as unknown as { id: string }).id,
        itemName: p.itemName,
        quantity: qty,
        unit: p.unit,
        unitPrice,
        lineTotal: Math.round(qty * unitPrice * 100) / 100,
        matched: true,
        source: "ai_extracted" as const,
      };
    };

    // Demo photo placeholders — external but rendered ok via <img>
    const demoPhotos: string[] = [];

    const now = Date.now();
    const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    type DemoEstimate = {
      clientName: string;
      roomType: string;
      areaM2: number;
      rawDescription: string;
      photoPaths: string[];
      aiNotes: string | null;
      status: "draft" | "final";
      createdAtOffset: number; // days ago
      items: NonNullable<ReturnType<typeof lineFrom>>[];
    };

    const demos: DemoEstimate[] = [
      {
        clientName: "أحمد بن علي",
        roomType: "صالون",
        areaM2: 28,
        rawDescription:
          "صالون 28 م²، دهان كامل للجدران والسقف بلون أبيض مطفي مع معجون، تركيب بلاط أرضية جديد 28م² مع تفكيك البلاط القديم، + 6 نقاط كهرباء و 4 سبوت لايت.",
        photoPaths: demoPhotos,
        aiNotes: "تم استخراج البنود من وصف + صور — تفكيك البلاط القديم محسوب.",
        status: "final",
        createdAtOffset: 2,
        items: [
          lineFrom("دهان جدران داخلي", 70),
          lineFrom("دهان سقف أبيض مطفي", 28),
          lineFrom("تركيب بلاط أرضية", 28),
          lineFrom("تفكيك/تنظيف أرضية قديمة", 28),
          lineFrom("نقطة كهرباء (تمديد+تركيب)", 6),
          lineFrom("تركيب سبوت لايت LED", 4),
        ].filter(Boolean) as NonNullable<ReturnType<typeof lineFrom>>[],
      },
      {
        clientName: "فاطمة زهرة",
        roomType: "حمام",
        areaM2: 6,
        rawDescription: "حمام 6 م² تجديد كامل — سيراميك أرضية وحوائط، 3 نقاط كهرباء، تفكيك قديم.",
        photoPaths: demoPhotos,
        aiNotes: "تقدير تجريبي (وضع المحاكاة). عدّل الكميات إن لزم.",
        status: "draft",
        createdAtOffset: 1,
        items: [
          lineFrom("تركيب سيراميك حمام", 18),
          lineFrom("نقطة كهرباء (تمديد+تركيب)", 3),
          lineFrom("تفكيك/تنظيف أرضية قديمة", 6),
        ].filter(Boolean) as NonNullable<ReturnType<typeof lineFrom>>[],
      },
      {
        clientName: "محمد سعيد",
        roomType: "غرفة نوم",
        areaM2: 14,
        rawDescription: "غرفة نوم 14 م²، دهان جدران وسقف، بلاط أرضية 14م²، 4 نقاط كهرباء.",
        photoPaths: demoPhotos,
        aiNotes: null,
        status: "draft",
        createdAtOffset: 3,
        items: [
          lineFrom("دهان جدران داخلي", 35),
          lineFrom("دهان سقف أبيض مطفي", 14),
          lineFrom("تركيب بلاط أرضية", 14),
          lineFrom("نقطة كهرباء (تمديد+تركيب)", 4),
        ].filter(Boolean) as NonNullable<ReturnType<typeof lineFrom>>[],
      },
      {
        clientName: "سعيد بوجمعة",
        roomType: "مطبخ",
        areaM2: 9,
        rawDescription: "مطبخ 9 م²، بلاط حائط 20م² + أرضية 9م²، 5 نقاط كهرباء، لوحة رئيسية.",
        photoPaths: demoPhotos,
        aiNotes: "عرض نهائي — جاهز للطباعة والإرسال واتساب.",
        status: "final",
        createdAtOffset: 5,
        items: [
          lineFrom("تركيب بلاط حائط", 20),
          lineFrom("تركيب بلاط أرضية", 9),
          lineFrom("نقطة كهرباء (تمديد+تركيب)", 5),
          lineFrom("لوحة كهرباء رئيسية", 1),
        ].filter(Boolean) as NonNullable<ReturnType<typeof lineFrom>>[],
      },
      {
        // Unmatched-item showcase — teaches user to fill price manually
        clientName: "ليلى مراد",
        roomType: "غرفة معيشة",
        areaM2: 18,
        rawDescription: "غرفة معيشة 18م²، دهان كامل + ورق حائط ديكوري 12م² (غير موجود في قائمتك) + 2 سبوت.",
        photoPaths: demoPhotos,
        aiNotes: "بند واحد غير مطابق — أدخل له سعرًا يدويًا قبل الاعتماد. هذه حالة تعليمية.",
        status: "draft",
        createdAtOffset: 0,
        items: [
          lineFrom("دهان جدران داخلي", 42),
          lineFrom("تركيب سبوت لايت LED", 2),
          // unmatched line — will show orange warning
          {
            priceItemId: null,
            itemName: "ورق حائط ديكوري (غير مطابق)",
            quantity: 12,
            unit: "م²",
            unitPrice: 0,
            lineTotal: 0,
            matched: false,
            source: "ai_extracted" as const,
          },
        ].filter(Boolean) as NonNullable<ReturnType<typeof lineFrom>>[],
      },
    ];

    for (const d of demos) {
      const estId = cryptoRandomId();
      // Use direct store manipulation for createdAt backdating when using mock
      // For real prisma, createdAt is auto-now; we accept now() for simplicity
      // but try to set via raw create then patch createdAt if mock.
      const created = await prisma.estimate.create({
        data: {
          id: estId,
          contractorId,
          clientName: d.clientName,
          roomType: d.roomType,
          areaM2: d.areaM2,
          rawDescription: d.rawDescription,
          photoPaths: d.photoPaths,
          aiNotes: d.aiNotes,
          status: d.status,
          items: { create: d.items },
        },
      });

      // Backdate for nicer dashboard ordering (mock only — real DB will keep now)
      try {
        const mock = (prisma as unknown as { _store?: { estimates: { id: string; createdAt: Date }[] } })?._store;
        if (mock) {
          const e = mock.estimates.find((x) => x.id === estId);
          if (e) (e as { createdAt: Date }).createdAt = daysAgo(d.createdAtOffset);
          const mp = (prisma as unknown as { _save?: () => void })?._save;
          mp?.();
        }
      } catch {}
    }
  } catch (e) {
    console.warn("[seed] demo estimates seeding skipped", e);
  }
}

function cryptoRandomId(): string {
  try {
    return cryptoRandomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
