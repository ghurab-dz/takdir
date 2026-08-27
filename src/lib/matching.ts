// Matching engine — pure functions (unit-tested).
// Maps AI-extracted item names onto the contractor's own price list.
// The AI is already constrained to the list (see lib/ai/prompt.ts);
// this layer is the safety net: exact match, then fuzzy, then "unmatched".

export interface PricelistEntry {
  id: string;
  itemName: string;
  unit: string;
  unitPrice: number;
}

export interface MatchedLine {
  priceItemId: string | null;
  itemName: string; // the contractor-list name when matched, AI name otherwise
  quantity: number;
  unit: string; // the contractor-list unit when matched, AI unit otherwise
  unitPrice: number; // 0 when unmatched — the contractor must fill it in
  lineTotal: number;
  matched: boolean;
}

/** Normalize Arabic text for comparison only (never for storage/display). */
export function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, "") // diacritics
    .replace(/[أإآٱ]/g, "ا") // alef variants
    .replace(/ى/g, "ي") // alef maqsura -> ya
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه") // ta marbuta
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeArabic(s).split(" ").filter(Boolean));
}

/** Jaccard-style token overlap score in [0,1]. */
export function tokenOverlap(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

const FUZZY_THRESHOLD = 0.6;

export function findBestMatch(
  aiName: string,
  pricelist: PricelistEntry[],
): PricelistEntry | null {
  const normAi = normalizeArabic(aiName);
  if (!normAi) return null;

  // 1) exact normalized match
  const exact = pricelist.find((p) => normalizeArabic(p.itemName) === normAi);
  if (exact) return exact;

  // 2) best fuzzy candidate above threshold
  let best: PricelistEntry | null = null;
  let bestScore = 0;
  for (const p of pricelist) {
    const score = tokenOverlap(aiName, p.itemName);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= FUZZY_THRESHOLD ? best : null;
}

/** Match a batch of AI-extracted items against the contractor's price list. */
export function matchExtractedItems(
  extracted: { itemName: string; quantity: number; unit: string }[],
  pricelist: PricelistEntry[],
): MatchedLine[] {
  const seen = new Map<string, MatchedLine>();

  for (const item of extracted) {
    const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 0;
    if (qty === 0) continue; // ignore nonsense rows from the model

    const hit = findBestMatch(item.itemName, pricelist);
    const line: MatchedLine = hit
      ? {
          priceItemId: hit.id,
          itemName: hit.itemName,
          quantity: qty,
          unit: hit.unit,
          unitPrice: hit.unitPrice,
          lineTotal: Math.round(qty * hit.unitPrice * 100) / 100,
          matched: true,
        }
      : {
          priceItemId: null,
          itemName: item.itemName,
          quantity: qty,
          unit: item.unit || "وحدة",
          unitPrice: 0,
          lineTotal: 0,
          matched: false,
        };

    // Merge duplicates of the same price item (sum quantities)
    const key = line.priceItemId ?? `unmatched:${normalizeArabic(line.itemName)}`;
    const prev = seen.get(key);
    if (prev) {
      prev.quantity = Math.round((prev.quantity + line.quantity) * 100) / 100;
      prev.lineTotal = Math.round(prev.quantity * prev.unitPrice * 100) / 100;
    } else {
      seen.set(key, line);
    }
  }

  return [...seen.values()];
}
