// Render prompt — locked to quote (quote-locked visual proof).
// CRITICAL: image must ONLY change surfaces listed in the quote.

export const RENDER_SYSTEM_INSTRUCTION = `أنت محرر صور جراحي (surgical photo editor) لورشة تشطيب في الجزائر. مهمتك تحرير صورة الغرفة الأصلية لتُظهر النتيجة النهائية *فقط* للبنود المدرجة في عرض السعر.

قواعد صارمة لا تُخرق:

1. غيّر فقط الأسطح المذكورة في "قائمة التعديلات المسموحة". كل سطح غير مذكور يجب أن يبقى مطابقًا للأصل تمامًا (نفس الأثاث، الإضاءة، الزوايا، الأبواب، النوافذ).
2. لكل بند مسموح، طبّق خامة/لون عامّة ومعقولة تناسب اسمه العربي (مثلاً "دهان جدران داخلي" → أعد طلاء الجدران فقط بلون أبيض مطفي نظيف، "تركيب بلاط أرضية" → بلاط أرضية فاتح محايد). لا تخترع ديكورًا إضافيًا.
3. ممنوع إضافة أثاث، نباتات، لوحات، أو تغيير ديكور. ممنوع تغيير هندسة الغرفة (shape) أو زاوية الكاميرا.
4. الإضاءة تبقى طبيعية وواقعية، لا مبالغة.
5. إن كانت القائمة فارغة، أعد الصورة الأصلية دون تغيير.
6. النتيجة صورة واحدة واقعية فقط، بدون نص داخل الصورة.`;

import type { Tier } from "./types";

const TIER_PALETTE: Record<Tier, string> = {
  economy: "سيراميك 30×30 أبيض مطفي — تشطيب اقتصادي عملي",
  mid: "بورسلان 60×60 بيج قابل للغسل — تشطيب متوازن أنيق",
  premium: "رخام 80×80 + دهان فاخر + إضاءة مخفية بسيطة — تشطيب ممتاز راقٍ",
};

export function buildRenderPrompt(
  items: { itemName: string; category: string }[],
  roomType: string | null,
  tier?: Tier | string | null,
  styleTags?: string[] | null,
): string {
  if (items.length === 0) {
    const base = `قائمة التعديلات المسموحة: (فارغة — لا تغيّر أي شيء، أعد الصورة كما هي)\nنوع الغرفة: ${roomType ?? "غير محدد"}`;
    if (!tier) return base;
    const palette = TIER_PALETTE[tier as Tier] ?? "";
    const styleBlock = styleTags && styleTags.length > 0 ? `\nالنمط المطلوب: ${styleTags.join("، ")}` : "";
    return `${base}\nالمستوى المطلوب: ${tier} — ${palette}${styleBlock}`;
  }
  const list = items.map((i) => `- "${i.itemName}" (الصنف: ${i.category})`).join("\n");
  let prompt = `قائمة التعديلات المسموحة (مغلقة — لا تخرج عنها):
${list}

نوع الغرفة: ${roomType ?? "غير محدد"}

المطلوب: عدّل الصورة الأصلية المرفقة لتُظهر الغرفة بعد تنفيذ هذه البنود فقط. كل عنصر غير مذكور في القائمة يبقى كما هو في الأصل تمامًا. لا تضف أي عمل غير مذكور.

تعليمات إضافية:
- حافظ على زاوية الكاميرا وهندسة الجدران والأبواب/النوافذ.
- الخامات تكون عامة ومحايدة وواقعية (لا ألوان صارخة عشوائية).
- لا تضف أثاثًا أو ديكورًا جديدًا.
- أخرج صورة نهائية واقعية واحدة فقط.`;

  if (tier) {
    const palette = TIER_PALETTE[tier as Tier] ?? tier;
    prompt += `\n\nالمستوى المطلوب: ${tier} — ${palette}`;
    if (tier === "economy") prompt += "\nلوحة المستوى: سيراميك 30×30 أبيض";
    else if (tier === "mid") prompt += "\nلوحة المستوى: بورسلان 60×60 بيج";
    else if (tier === "premium") prompt += "\nلوحة المستوى: رخام 80×80 + دهان فاخر";
  }
  if (styleTags && styleTags.length > 0) {
    prompt += `\nالنمط المطلوب: ${styleTags.join("، ")}`;
  }

  return prompt;
}

/** Stable hash for proof/stale detection — hash of sorted item names + roomType + tier */
export function hashRenderInput(
  items: { itemName: string; category: string }[],
  roomType: string | null,
  tier?: Tier | string | null,
): string {
  const normalized = [...items]
    .map((i) => `${i.category}:${i.itemName}`)
    .sort()
    .join("|");
  const raw = tier ? `${normalized}::${roomType ?? ""}::${tier}` : `${normalized}::${roomType ?? ""}`;
  // Simple djb2-like hash to hex (no crypto dep needed for staleness check)
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = (h * 33) ^ raw.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}
