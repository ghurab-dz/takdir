// Options prompt — generates 3 tiered options from closed material catalog.
// Pure functions (unit-tested). PRD §5 + PLAN §3: closed allow-lists per tier, never invent prices.

import type { AllowedMaterial, GenerateOptionsInput, Tier } from "./types";

export const OPTIONS_SYSTEM_INSTRUCTION = `أنت "حاسب كميات ومستشار تشطيب" محترف يعمل لدى مقاول تشطيبات في الجزائر.
مهمتك: من صور الغرفة والأبعاد ووصف المقاول، ولّد 3 خيارات تسعير متدرجة (اقتصادي/متوازن/ممتاز) باستخدام نفس الكميات لكن بمواد مختلفة حسب المستوى.

قواعد صارمة لا يمكن خرقها:
1. قائمة مغلقة — استخدم فقط أسماء البنود والمواد الموجودة في "قوائم المواد المسموحة لكل مستوى" المرفقة، وحرفيًا كما وردت. ممنوع اختراع بنود جديدة أو مواد غير موجودة.
2. ممنوع منعًا باتًا إخراج أي أسعار — الأسعار ليست من عملك. أخرج فقط اسم البند، الكمية، والوحدة. التسعير يتم لاحقًا من كتالوج المقاول.
3. حافظ على ثبات الكميات بين المستويات الثلاثة لنفس البند (نفس المساحة/العدد)، الاختلاف فقط في مادة/خامة المستوى (grade).
4. لكل بند اختر المادة التي تطابق المستوى المطلوب (economy/mid/premium) من القائمة المغلقة لذلك المستوى فقط.
5. قدّر مساحة الغرفة (م²) من الصور والأبعاد إن أمكن، وإلا اتركها null.
6. أخرج JSON فقط بالمخطط المطلوب، بلا أي نص إضافي أو شرح خارج JSON.`;

const TIER_LABEL: Record<Tier, string> = {
  economy: "اقتصادي",
  mid: "متوازن",
  premium: "ممتاز",
};

function formatMaterialsForTier(materials: AllowedMaterial[], tier: Tier): string {
  const list = materials.filter((m) => m.grade === tier);
  if (list.length === 0) return "(لا توجد مواد لهذا المستوى)";
  return list
    .map((m) => `- "${m.itemName}" (المعرّف: ${m.id} — الوحدة: ${m.unit} — الصنف: ${m.category}${m.visualHint ? ` — تلميح بصري: ${m.visualHint}` : ""})`)
    .join("\n");
}

function formatDims(dims: GenerateOptionsInput["dims"]): string {
  const parts: string[] = [];
  if (dims.lengthM !== null && dims.lengthM !== undefined) parts.push(`الطول: ${dims.lengthM} م`);
  if (dims.widthM !== null && dims.widthM !== undefined) parts.push(`العرض: ${dims.widthM} م`);
  if (dims.heightM !== null && dims.heightM !== undefined) parts.push(`الارتفاع: ${dims.heightM} م`);
  if (dims.areaM2 !== null && dims.areaM2 !== undefined) parts.push(`المساحة: ${dims.areaM2} م²`);
  if (parts.length === 0) return "غير محددة — قدّر من الصور والوصف (أو اترك null)";
  return parts.join("، ");
}

/**
 * Build user prompt for generateOptions.
 * Accepts either a single GenerateOptionsInput object or legacy positional args.
 */
export function buildOptionsPrompt(input: GenerateOptionsInput): string;
export function buildOptionsPrompt(
  description: string,
  allowedMaterials: AllowedMaterial[],
  dims?: GenerateOptionsInput["dims"],
  styleTags?: string[],
  budgetTier?: Tier | null,
  budgetDZD?: number | null,
  contractorNotes?: string | null,
  roomType?: string | null,
): string;
export function buildOptionsPrompt(
  inputOrDescription: GenerateOptionsInput | string,
  allowedMaterials?: AllowedMaterial[],
  dims?: GenerateOptionsInput["dims"],
  styleTags?: string[],
  budgetTier?: Tier | null,
  budgetDZD?: number | null,
  contractorNotes?: string | null,
  roomType?: string | null,
): string {
  let description: string;
  let materials: AllowedMaterial[];
  let dimsVal: GenerateOptionsInput["dims"];
  let styleTagsVal: string[];
  let budgetTierVal: Tier | null;
  let budgetDZDVal: number | null;
  let contractorNotesVal: string | null;
  let roomTypeVal: string | null;

  if (typeof inputOrDescription === "object" && inputOrDescription !== null && "allowedMaterials" in inputOrDescription) {
    const inp = inputOrDescription as GenerateOptionsInput;
    description = inp.description;
    materials = inp.allowedMaterials;
    dimsVal = inp.dims;
    styleTagsVal = inp.styleTags;
    budgetTierVal = inp.budgetTier;
    budgetDZDVal = inp.budgetDZD;
    contractorNotesVal = inp.contractorNotes;
    roomTypeVal = inp.roomType;
  } else {
    description = inputOrDescription as string;
    materials = allowedMaterials ?? [];
    dimsVal = dims ?? { lengthM: null, widthM: null, heightM: null, areaM2: null };
    styleTagsVal = styleTags ?? [];
    budgetTierVal = budgetTier ?? null;
    budgetDZDVal = budgetDZD ?? null;
    contractorNotesVal = contractorNotes ?? null;
    roomTypeVal = roomType ?? null;
  }

  const economyBlock = formatMaterialsForTier(materials, "economy");
  const midBlock = formatMaterialsForTier(materials, "mid");
  const premiumBlock = formatMaterialsForTier(materials, "premium");

  const dimsStr = formatDims(dimsVal);
  const styleStr = styleTagsVal.length > 0 ? styleTagsVal.join("، ") : "(لم يحدد — اختر محايد)";
  const budgetTierStr = budgetTierVal ? `${budgetTierVal} (${TIER_LABEL[budgetTierVal]})` : "(غير محدد — ولّد الثلاثة للمقارنة)";
  const budgetDZDStr = budgetDZDVal !== null && budgetDZDVal !== undefined ? `${budgetDZDVal} دج` : "(غير محدد)";
  const notesStr = contractorNotesVal && contractorNotesVal.trim() ? contractorNotesVal.trim() : "(لا توجد ملاحظات إضافية)";
  const roomTypeStr = roomTypeVal && roomTypeVal.trim() ? roomTypeVal.trim() : "(غير محدد — استنتج من الصور)";
  const descStr = description && description.trim() ? description.trim() : "(لا يوجد وصف نصي — اعتمد على الصور فقط)";

  return `قوائم المواد المسموحة لكل مستوى (قائمة مغلقة — لا تخرج عنها):

[اقتصادي economy — ${TIER_LABEL.economy}]
${economyBlock}

[متوازن mid — ${TIER_LABEL.mid}]
${midBlock}

[ممتاز premium — ${TIER_LABEL.premium}]
${premiumBlock}

أبعاد الغرفة:
${dimsStr}

النمط/رغبات العميل (styleTags): ${styleStr}
نوع الغرفة الحالي (إن وجد): ${roomTypeStr}

ميزانية العميل:
- المستوى المفضل: ${budgetTierStr}
- الميزانية الرقمية: ${budgetDZDStr}

ملاحظات المقاول:
"""
${notesStr}
"""

وصف المقاول للعمل المطلوب:
"""
${descStr}
"""

المطلوب: حلّل الصور المرفقة مع كل البيانات أعلاه، ولّد 3 خيارات (economy/mid/premium) بنفس الكميات لكل بند لكن بمواد المستوى المناسب فقط من القوائم المغلقة أعلاه. أخرج JSON فقط بالمخطط:
{
  "room_type": string|null,
  "area_m2": number|null,
  "options": [
    { "tier": "economy"|"mid"|"premium", "title": string, "items": [{ "item_name": string, "quantity": number, "unit": string, "material_id": string|null, "category": string }], "rationale": string|null }
  ],
  "notes": string|null
}
تذكير: ممنوع إخراج أسعار، وممنوع اختراع مواد خارج القوائم.`;
}

/** Gemini responseSchema subset — strict JSON shape for generateOptions */
export const OPTIONS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    room_type: { type: "string", nullable: true },
    area_m2: { type: "number", nullable: true },
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tier: { type: "string", enum: ["economy", "mid", "premium"] },
          title: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_name: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string" },
                material_id: { type: "string", nullable: true },
                category: { type: "string" },
              },
              required: ["item_name", "quantity", "unit"],
            },
          },
          rationale: { type: "string", nullable: true },
        },
        required: ["tier", "items"],
      },
    },
    notes: { type: "string", nullable: true },
  },
  required: ["options", "room_type", "area_m2", "notes"],
} as const;

/** Alias for compat — some callers import RESPONSE_SCHEMA */
export const RESPONSE_SCHEMA = OPTIONS_RESPONSE_SCHEMA;
