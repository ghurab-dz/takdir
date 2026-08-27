// Prompt construction — pure functions (unit-tested).
// CRITICAL DESIGN RULE (PRD §5): the model must ONLY use item names from the
// contractor's own price list, never invent items, and never output prices.

import type { AllowedItem } from "./types";

export const SYSTEM_INSTRUCTION = `أنت "حاسب كميات" (مقايس) محترف يعمل لدى مقاول تشطيبات في الجزائر.
مهمتك: من صور الغرفة ووصف المقاول، استخرج بنود العمل المطلوبة وكمياتها التقريبية.

قواعد صارمة لا يمكن خرقها:
1. استخدم فقط أسماء البنود الموجودة في "قائمة البنود المسموحة" المرفقة، وحرفيًا كما وردت. ممنوع اختراع بنود جديدة.
2. ممنوع منعًا باتًا إخراج أي أسعار — الأسعار ليست من عملك.
3. الكمية رقم موجب فقط، بوحدة البند نفسها من القائمة.
4. قدّر مساحة الغرفة (م²) من الصور والوصف إن أمكن، وإلا اتركها null.
5. إن لم يكن العمل المطلوب مغطى بأي بند من القائمة، اذكر ذلك في "notes" بدل اختراع بند.
6. أخرج JSON فقط بالمخطط المطلوب، بلا أي نص إضافي.`;

export function buildUserPrompt(
  description: string,
  allowedItems: AllowedItem[],
): string {
  const list = allowedItems
    .map((i) => `- "${i.itemName}" (الوحدة: ${i.unit} — الصنف: ${i.category})`)
    .join("\n");

  return `قائمة البنود المسموحة (قائمة مغلقة — لا تخرج عنها):
${list}

وصف المقاول للعمل المطلوب:
"""
${description.trim() || "(لا يوجد وصف نصي — اعتمد على الصور فقط)"}
"""

حلّل الصور المرفقة مع الوصف، واستخرج:
- room_type: نوع الغرفة (مطبخ/حمام/غرفة نوم/صالون/ممر...) أو null
- area_m2: المساحة التقريبية بالمتر المربع، أو null إن تعذّر التقدير
- items: البنود المطلوبة فعلًا من القائمة المسموحة فقط، مع الكمية والوحدة
- notes: ملاحظات موجزة للمقاول (مثلاً أعمال تراها لازمة لكنها غير موجودة في قائمته)، أو null`;
}

/** Gemini responseSchema subset — strict JSON shape from PRD §5. */
export const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    room_type: { type: "string", nullable: true },
    area_m2: { type: "number", nullable: true },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item_name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
        },
        required: ["item_name", "quantity", "unit"],
      },
    },
    notes: { type: "string", nullable: true },
  },
  required: ["room_type", "area_m2", "items", "notes"],
} as const;
