// Mock provider — lets the whole flow run in dev without a Gemini key.
// Picks plausible items from the contractor's OWN list based on keywords
// in the description, so the matching engine always gets realistic input.

import type {
  AiProvider,
  ExtractionInput,
  ExtractionResult,
  GenerateOptionsInput,
  GenerateOptionsResult,
  RenderInput,
  RenderResult,
  Tier,
} from "./types";

export class MockProvider implements AiProvider {
  readonly name = "mock";

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const desc = input.description;
    const items: ExtractionResult["items"] = [];

    const areaGuess = guessArea(desc);
    const area = areaGuess ?? 12;

    const byCategory = (cat: string) =>
      input.allowedItems.filter((i) => i.category.includes(cat));

    const wants = (re: RegExp) => re.test(desc);
    const noFilter = () => true;

    // Paint walls when painting is mentioned (or nothing specific is said)
    for (const p of byCategory("دهان")) {
      if (wants(/دهان|طلاء|صبغ/) || !wants(/بلاط|كهرب/)) {
        items.push({ itemName: p.itemName, quantity: area * 2.5, unit: p.unit });
        break;
      }
    }
    // Floor tiles
    for (const t of byCategory("بلاط").filter((i) => /أرض|ارض/.test(i.itemName))) {
      if (wants(/بلاط|أرض|ارض|سيراميك/) || noFilter()) {
        items.push({ itemName: t.itemName, quantity: area, unit: t.unit });
        break;
      }
    }
    // Electricity points
    for (const e of byCategory("كهرباء")) {
      if (wants(/كهرب|نقط|مآخذ|مفاتيح/)) {
        items.push({ itemName: e.itemName, quantity: 4, unit: e.unit });
        break;
      }
    }
    // Old floor removal when mentioned
    for (const g of input.allowedItems.filter((i) => /تفكيك|تنظيف/.test(i.itemName))) {
      if (wants(/تفكيك|قديم|إزالة|ازالة/)) {
        items.push({ itemName: g.itemName, quantity: area, unit: g.unit });
        break;
      }
    }

    return {
      roomType: guessRoomType(desc),
      areaM2: areaGuess,
      items,
      notes:
        "هذا تقدير تجريبي (وضع المحاكاة بدون مفتاح Gemini). أضف GEMINI_API_KEY في ملف .env للحصول على تحليل حقيقي بالصور.",
    };
  }

  async generateOptions(input: GenerateOptionsInput): Promise<GenerateOptionsResult> {
    const desc = input.description ?? "";
    // Dims: prefer explicit dims, else guess from description
    const dims = input.dims ?? { lengthM: null, widthM: null, heightM: null, areaM2: null };
    let area = dims.areaM2;
    if (area == null && dims.lengthM != null && dims.widthM != null) {
      area = Math.round(dims.lengthM * dims.widthM * 100) / 100;
    }
    if (area == null) {
      // Try guess from "طول × عرض" pattern (regex (\d+[.,]?\d*)\s*[×x*]\s*(\d+[.,]?\d*)) or "12 م²"
      const dimGuess = guessDims(desc);
      if (dimGuess.lengthM != null && dimGuess.widthM != null) area = Math.round(dimGuess.lengthM * dimGuess.widthM * 100) / 100;
      else area = guessArea(desc) ?? 12;
    }

    const roomType = input.roomType ?? guessRoomType(desc);
    const tiers: Tier[] = ["economy", "mid", "premium"];
    const titles: Record<Tier, string> = { economy: "اقتصادي", mid: "متوازن", premium: "ممتاز" };
    const rationale: Record<Tier, string> = {
      economy: "مواد اقتصادية — أقل تكلفة مع تشطيب عملي",
      mid: "مواد متوازنة — موصى به، جودة وسعر متوازن",
      premium: "مواد ممتازة — تشطيب راقٍ بتفاصيل فاخرة",
    };

    // Build items per tier using allowedMaterials filtered by grade
    const options = tiers.map((tier) => {
      const matForTier = input.allowedMaterials.filter((m) => m.grade === tier);
      // If no materials for tier, fallback to any material (should not happen after seed)
      const pool = matForTier.length > 0 ? matForTier : input.allowedMaterials.filter((m) => m.grade === "mid");
      const items: GenerateOptionsResult["options"][number]["items"] = [];

      // Keyword-based selection similar to extract, but per-tier materials
      const wants = (re: RegExp) => re.test(desc);
      const byCategory = (cat: string) => pool.filter((m) => m.category.includes(cat));

      // Paint
      const paint = byCategory("دهان");
      if (paint.length > 0 && (wants(/دهان|طلاء|صبغ/) || !wants(/بلاط|كهرب/))) {
        const m = paint[0];
        items.push({ itemName: m.itemName, quantity: Math.round(area * 2.5 * 100) / 100, unit: m.unit, materialId: m.id, category: m.category });
      }
      // Floor tile
      const tilesAll = byCategory("بلاط");
      const tiles = tilesAll.filter((m) => /أرض|ارض/.test(m.itemName));
      const tilePool = tiles.length > 0 ? tiles : tilesAll;
      if (tilePool.length > 0) {
        const m = tilePool[0];
        items.push({ itemName: m.itemName, quantity: Math.round(area * 100) / 100, unit: m.unit, materialId: m.id, category: m.category });
      } else if (pool.length > 0) {
        // fallback: take first material if no tile match
        const m = pool[0];
        if (!items.find((it) => it.materialId === m.id)) {
          items.push({ itemName: m.itemName, quantity: Math.round(area * 100) / 100, unit: m.unit, materialId: m.id, category: m.category });
        }
      }
      // Electricity
      const elec = byCategory("كهرباء");
      if (elec.length > 0 && wants(/كهرب|نقط|مآخذ|مفاتيح|سبوت|لوحة/)) {
        const m = elec[0];
        items.push({ itemName: m.itemName, quantity: 4, unit: m.unit, materialId: m.id, category: m.category });
      }
      // General fallback: if we still have <2 items, take up to 2 from pool not yet used
      if (items.length < 2) {
        for (const m of pool) {
          if (items.find((it) => it.materialId === m.id)) continue;
          items.push({ itemName: m.itemName, quantity: Math.round(area * 100) / 100, unit: m.unit, materialId: m.id, category: m.category });
          if (items.length >= 2) break;
        }
      }
      // Ensure at least one item
      if (items.length === 0 && pool.length > 0) {
        const m = pool[0];
        items.push({ itemName: m.itemName, quantity: Math.round(area * 100) / 100, unit: m.unit, materialId: m.id, category: m.category });
      }

      return {
        tier,
        title: titles[tier],
        items,
        rationale: rationale[tier],
      };
    });

    // Tiny async tick to emulate latency
    await new Promise((r) => setTimeout(r, 200));

    return {
      roomType: roomType ?? null,
      areaM2: area ?? null,
      options,
      notes: "وضع المحاكاة — 3 خيارات مولدة محليًا بنفس الكميات مع اختلاف المادة حسب المستوى (اقتصادي/متوازن/ممتاز).",
    };
  }

  async render(input: RenderInput): Promise<RenderResult> {
    // Mock: return the base photo unchanged — the whole flow works without a key.
    // In mock mode we deliberately do NOT hallucinate finishes; the UI will
    // show "وضع المحاكاة — الصورة الأصلية" as the render.
    // Tier-aware model name so compare view shows 3 distinct cards.
    const tier = (input as unknown as { tier?: string | null }).tier ?? null;
    await new Promise((r) => setTimeout(r, 400));
    const model = tier ? `mock-${tier}` : "mock";
    return {
      imageBase64: input.basePhoto.data,
      mimeType: input.basePhoto.mimeType,
      model,
    };
  }
}

// Hoisted regex — vercel best practice
const DIMS_RE = /(\d+[.,]?\d*)\s*[×x*]\s*(\d+[.,]?\d*)/;
const AREA_RE = /(\d+(?:[.,]\d+)?)\s*(?:م²|م2|متر مربع|م\b)/;

function guessArea(desc: string): number | null {
  const m = desc.match(AREA_RE);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function guessDims(desc: string): { lengthM: number | null; widthM: number | null } {
  const m = desc.match(DIMS_RE);
  if (!m) return { lengthM: null, widthM: null };
  const a = parseFloat(m[1].replace(",", "."));
  const b = parseFloat(m[2].replace(",", "."));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return { lengthM: null, widthM: null };
  return { lengthM: a, widthM: b };
}

// Internal helper returning {length,width} for backwards compat inside generateOptions
function guessDimsLegacy(desc: string): { length: number; width: number } | null {
  const { lengthM, widthM } = guessDims(desc);
  if (lengthM == null || widthM == null) return null;
  return { length: lengthM, width: widthM };
}

function guessRoomType(desc: string): string | null {
  const rooms: [RegExp, string][] = [
    [/مطبخ/, "مطبخ"],
    [/حمام/, "حمام"],
    [/نوم/, "غرفة نوم"],
    [/صالون|ضيوف|معيشة/, "صالون"],
    [/ممر|رواق/, "ممر"],
  ];
  for (const [re, name] of rooms) if (re.test(desc)) return name;
  return null;
}
