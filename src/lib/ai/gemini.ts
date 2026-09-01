// Google Gemini adapter — free tier, multimodal, JSON mode.
// Uses plain REST (no SDK) to keep dependencies minimal.
// Model: gemini-3.6-flash (gemini-2.5-flash is no longer available to new keys).

import { SYSTEM_INSTRUCTION, buildUserPrompt, RESPONSE_SCHEMA } from "./prompt";
import { RENDER_SYSTEM_INSTRUCTION, buildRenderPrompt } from "./render-prompt";
import { OPTIONS_SYSTEM_INSTRUCTION, buildOptionsPrompt, OPTIONS_RESPONSE_SCHEMA } from "./options-prompt";
import type {
  AiProvider,
  ExtractionInput,
  ExtractionResult,
  GenerateOptionsInput,
  GenerateOptionsResult,
  RenderInput,
  RenderResult,
} from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";

  constructor(private apiKey: string) {}

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const parts: unknown[] = input.photos.map((p) => ({
      inline_data: { mime_type: p.mimeType, data: p.data },
    }));
    parts.push({ text: buildUserPrompt(input.description, input.allowedItems) });

    const res = await fetch(`${ENDPOINT}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error(
          `تجاوزت الحصة المجانية لـ Gemini (429). يرجى الانتظار دقائق أو إزالة GEMINI_API_KEY للعمل في وضع المحاكاة. التفاصيل: ${body.slice(0, 200)}`
        );
      }
      if (res.status === 403 || res.status === 401) {
        throw new Error(`مفتاح Gemini غير صالح أو بلا صلاحية (${res.status}). تحقق من GEMINI_API_KEY.`);
      }
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned an empty response");

    let parsed: {
      room_type?: string | null;
      area_m2?: number | null;
      items?: { item_name?: string; quantity?: number; unit?: string }[];
      notes?: string | null;
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini returned invalid JSON");
    }

    return {
      roomType: parsed.room_type ?? null,
      areaM2:
        typeof parsed.area_m2 === "number" && parsed.area_m2 > 0
          ? parsed.area_m2
          : null,
      items: (parsed.items ?? [])
        .filter(
          (i) =>
            typeof i.item_name === "string" &&
            i.item_name.trim() !== "" &&
            typeof i.quantity === "number",
        )
        .map((i) => ({
          itemName: i.item_name!.trim(),
          quantity: i.quantity!,
          unit: (i.unit ?? "").trim() || "وحدة",
        })),
      notes: parsed.notes ?? null,
    };
  }

  async generateOptions(input: GenerateOptionsInput): Promise<GenerateOptionsResult> {
    const parts: unknown[] = input.photos.map((p) => ({
      inline_data: { mime_type: p.mimeType, data: p.data },
    }));
    parts.push({ text: buildOptionsPrompt(input) });

    const res = await fetch(`${ENDPOINT}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: OPTIONS_SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: OPTIONS_RESPONSE_SCHEMA,
          temperature: 0.3,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error(
          `تجاوزت الحصة المجانية لـ Gemini (429). يرجى الانتظار دقائق أو إزالة GEMINI_API_KEY للعمل في وضع المحاكاة. التفاصيل: ${body.slice(0, 200)}`
        );
      }
      if (res.status === 403 || res.status === 401) {
        throw new Error(`مفتاح Gemini غير صالح أو بلا صلاحية (${res.status}). تحقق من GEMINI_API_KEY.`);
      }
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned an empty response");

    let parsed: {
      room_type?: string | null;
      area_m2?: number | null;
      options?: {
        tier?: string;
        title?: string;
        items?: { item_name?: string; quantity?: number; unit?: string; material_id?: string | null; category?: string }[];
        rationale?: string | null;
      }[];
      notes?: string | null;
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini returned invalid JSON");
    }

    const options = (parsed.options ?? []).map((o) => ({
      tier: (o.tier as GenerateOptionsResult["options"][number]["tier"]) ?? "mid",
      title: (o.title ?? "").trim() || (o.tier === "economy" ? "اقتصادي" : o.tier === "premium" ? "ممتاز" : "متوازن"),
      items: (o.items ?? [])
        .filter(
          (i) =>
            typeof i.item_name === "string" &&
            i.item_name.trim() !== "" &&
            typeof i.quantity === "number" &&
            i.quantity > 0,
        )
        .map((i) => ({
          itemName: i.item_name!.trim(),
          quantity: i.quantity!,
          unit: (i.unit ?? "").trim() || "وحدة",
          materialId: (i.material_id ?? null) as string | null,
          category: (i.category ?? "عام").trim() || "عام",
        })),
      rationale: o.rationale ?? null,
    }));

    return {
      roomType: parsed.room_type ?? null,
      areaM2: typeof parsed.area_m2 === "number" && parsed.area_m2 > 0 ? parsed.area_m2 : null,
      options,
      notes: parsed.notes ?? null,
    };
  }

  async render(input: RenderInput): Promise<RenderResult> {
    const imageEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`;
    const prompt = buildRenderPrompt(input.items, input.roomType, input.tier ?? null, input.styleTags ?? []);

    const res = await fetch(`${imageEndpoint}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: RENDER_SYSTEM_INSTRUCTION }] },
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: input.basePhoto.mimeType, data: input.basePhoto.data } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          // Required for image-capable models; harmless for text-only
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          responseModalities: ["IMAGE", "TEXT"] as any,
          temperature: 0.4,
        } as unknown as Record<string, unknown>,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error(
          `تجاوزت الحصة المجانية لـ Gemini (429). سيُعرض الأصل مؤقتًا في وضع المحاكاة — حاول بعد دقائق أو أزل GEMINI_API_KEY للعمل دون AI. التفاصيل: ${body.slice(0, 180)}`
        );
      }
      if (res.status === 403 || res.status === 401) {
        throw new Error(`مفتاح Gemini غير صالح أو بلا صلاحية (${res.status}). تحقق من GEMINI_API_KEY أو اعمل في وضع المحاكاة.`);
      }
      throw new Error(`Gemini render error ${res.status}: ${body.slice(0, 400)}`);
    }

    const data = await res.json();
    // Try to find inline_data image in response parts (multiple possible shapes)
    const parts: unknown[] = data?.candidates?.[0]?.content?.parts ?? [];
    let imagePart: { inline_data?: { data?: string; mime_type?: string }; inlineData?: { data?: string; mimeType?: string } } | undefined;
    for (const p of parts as never[]) {
      const q = p as Record<string, unknown>;
      if (q.inline_data || q.inlineData) {
        imagePart = q as never;
        break;
      }
    }

    const inlineRaw = imagePart?.inline_data ?? (imagePart as unknown as { inlineData?: unknown })?.inlineData;
    const rawNorm = inlineRaw as unknown as { data?: string; mime_type?: string; mimeType?: string } | undefined;
    const b64 = rawNorm?.data;
    const mime = ((rawNorm?.mime_type ?? (rawNorm as unknown as { mimeType?: string })?.mimeType) ?? "image/jpeg") as string;

    if (b64 && typeof b64 === "string" && b64.length > 100) {
      return { imageBase64: b64, mimeType: mime, model: IMAGE_MODEL };
    }

    // Fallback: some models return image as text with base64? Try to extract
    const textPart = (parts as { text?: string }[]).find((p) => typeof p.text === "string" && p.text.length > 200);
    if (textPart?.text) {
      // No image returned — treat as failure with helpful message
      throw new Error(`Gemini render returned no image (model ${IMAGE_MODEL} may need different endpoint). Response text: ${textPart.text.slice(0, 200)}`);
    }

    throw new Error(`Gemini render returned no image (model ${IMAGE_MODEL})`);
  }
}
