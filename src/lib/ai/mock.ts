// Mock provider — lets the whole flow run in dev without a Gemini key.
// Picks plausible items from the contractor's OWN list based on keywords
// in the description, so the matching engine always gets realistic input.

import type { AiProvider, ExtractionInput, ExtractionResult } from "./types";

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
}

function guessArea(desc: string): number | null {
  const m = desc.match(/(\d+(?:[.,]\d+)?)\s*(?:م²|م2|متر مربع|م\b)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
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
