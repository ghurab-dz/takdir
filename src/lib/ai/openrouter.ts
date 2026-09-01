// OpenRouter adapter — OpenAI-compat, free tier, multimodal.
// POST https://openrouter.ai/api/v1/chat/completions
// Maps PhotoInput base64 to image_url data URI, handles OpenAI-compat response.

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

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen2.5-vl-7b-instruct:free";
const DEFAULT_IMAGE_MODEL = "google/gemini-2.5-flash-image:free";

// Hoisted regex for data URI extraction in render response
const DATA_URI_RE = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;
const BASE64_RE = /^[A-Za-z0-9+/=]{100,}$/;

function getModel(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

function getImageModel(): string {
  return process.env.OPENROUTER_IMAGE_MODEL || process.env.OPENROUTER_MODEL || DEFAULT_IMAGE_MODEL;
}

function toImageUrl(p: { data: string; mimeType: string }): string {
  return `data:${p.mimeType};base64,${p.data}`;
}

function isQuotaMessage(msg: string): boolean {
  return msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("تجاوزت");
}

export class OpenRouterProvider implements AiProvider {
  readonly name = "openrouter";

  constructor(private apiKey: string) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
    // Optional headers for OpenRouter ranking — harmless if absent
    if (process.env.OPENROUTER_REFERER) h["HTTP-Referer"] = process.env.OPENROUTER_REFERER;
    if (process.env.OPENROUTER_TITLE) h["X-Title"] = process.env.OPENROUTER_TITLE;
    return h;
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const userText = buildUserPrompt(input.description, input.allowedItems);
    const content: unknown[] = input.photos.map((p) => ({
      type: "image_url",
      image_url: { url: toImageUrl(p) },
    }));
    content.push({ type: "text", text: userText });

    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: getModel(),
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429 || isQuotaMessage(body)) {
        throw new Error(`تجاوزت الحصة المجانية لـ OpenRouter (429). يرجى الانتظار دقائق أو المحاولة لاحقًا. التفاصيل: ${body.slice(0, 200)}`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`مفتاح OpenRouter غير صالح أو بلا صلاحية (${res.status}). تحقق من OPENROUTER_API_KEY.`);
      }
      throw new Error(`OpenRouter API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const rawContent: string | undefined = data?.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== "string") throw new Error("OpenRouter returned an empty response");

    let parsed: {
      room_type?: string | null;
      area_m2?: number | null;
      items?: { item_name?: string; quantity?: number; unit?: string }[];
      notes?: string | null;
    };
    try {
      // Content may be JSON string or already object? Handle both
      parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    } catch {
      throw new Error("OpenRouter returned invalid JSON");
    }

    return {
      roomType: parsed.room_type ?? null,
      areaM2: typeof parsed.area_m2 === "number" && parsed.area_m2 > 0 ? parsed.area_m2 : null,
      items: (parsed.items ?? [])
        .filter((i) => typeof i.item_name === "string" && i.item_name.trim() !== "" && typeof i.quantity === "number")
        .map((i) => ({
          itemName: i.item_name!.trim(),
          quantity: i.quantity!,
          unit: (i.unit ?? "").trim() || "وحدة",
        })),
      notes: parsed.notes ?? null,
    };
  }

  async generateOptions(input: GenerateOptionsInput): Promise<GenerateOptionsResult> {
    const userText = buildOptionsPrompt(input);
    const content: unknown[] = input.photos.map((p) => ({
      type: "image_url",
      image_url: { url: toImageUrl(p) },
    }));
    content.push({ type: "text", text: userText });

    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: getModel(),
        messages: [
          { role: "system", content: OPTIONS_SYSTEM_INSTRUCTION },
          { role: "user", content },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429 || isQuotaMessage(body)) {
        throw new Error(`تجاوزت الحصة المجانية لـ OpenRouter (429). يرجى الانتظار دقائق أو المحاولة لاحقًا. التفاصيل: ${body.slice(0, 200)}`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`مفتاح OpenRouter غير صالح أو بلا صلاحية (${res.status}). تحقق من OPENROUTER_API_KEY.`);
      }
      throw new Error(`OpenRouter API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const rawContent: unknown = data?.choices?.[0]?.message?.content;
    let text: string | undefined;
    if (typeof rawContent === "string") text = rawContent;
    else if (Array.isArray(rawContent)) {
      // Some models return content as array of parts
      const t = (rawContent as { text?: string; type?: string }[]).find((p) => typeof p.text === "string");
      text = t?.text;
    }
    if (!text) throw new Error("OpenRouter returned an empty response");

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
      throw new Error("OpenRouter returned invalid JSON");
    }

    const options = (parsed.options ?? []).map((o) => ({
      tier: (o.tier as GenerateOptionsResult["options"][number]["tier"]) ?? "mid",
      title: (o.title ?? "").trim() || (o.tier === "economy" ? "اقتصادي" : o.tier === "premium" ? "ممتاز" : "متوازن"),
      items: (o.items ?? [])
        .filter((i) => typeof i.item_name === "string" && i.item_name.trim() !== "" && typeof i.quantity === "number" && i.quantity > 0)
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
    const prompt = buildRenderPrompt(input.items, input.roomType, input.tier ?? null, input.styleTags ?? []);
    const content: unknown[] = [
      { type: "image_url", image_url: { url: toImageUrl(input.basePhoto) } },
      { type: "text", text: prompt },
    ];

    const model = getImageModel();

    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: RENDER_SYSTEM_INSTRUCTION },
          { role: "user", content },
        ],
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429 || isQuotaMessage(body)) {
        throw new Error(`تجاوزت الحصة المجانية لـ OpenRouter (429). سيُعرض الأصل مؤقتًا — حاول بعد دقائق. التفاصيل: ${body.slice(0, 180)}`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`مفتاح OpenRouter غير صالح أو بلا صلاحية (${res.status}). تحقق من OPENROUTER_API_KEY.`);
      }
      throw new Error(`OpenRouter render error ${res.status}: ${body.slice(0, 400)}`);
    }

    const data = await res.json();
    // OpenAI-compat may return choices[0].message.content as string, or images array, or tool-like
    const choice = data?.choices?.[0]?.message;
    if (!choice) throw new Error(`OpenRouter render returned no image (model ${model})`);

    // Try multiple shapes: images array, content string with data URI, content array
    let b64: string | undefined;
    let mime = "image/jpeg";

    // Shape 1: choice.images: [{image_url:{url:"data:..."} }]
    const images = choice.images as unknown;
    if (Array.isArray(images) && images.length > 0) {
      const first = images[0] as { image_url?: { url?: string }; url?: string; b64_json?: string };
      const url = first?.image_url?.url ?? (first as { url?: string }).url;
      if (typeof url === "string") {
        const m = url.match(DATA_URI_RE);
        if (m) {
          mime = m[1];
          b64 = m[2];
        } else if (BASE64_RE.test(url)) {
          b64 = url;
        }
      } else if (typeof (first as { b64_json?: string }).b64_json === "string") {
        b64 = (first as { b64_json: string }).b64_json;
      }
    }

    // Shape 2: content is string containing data URI or base64
    if (!b64) {
      const content = choice.content;
      if (typeof content === "string" && content.length > 100) {
        // Try to find data URI inside
        const dataUriMatch = content.match(/data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]{100,})/i);
        if (dataUriMatch) {
          mime = dataUriMatch[1];
          b64 = dataUriMatch[2];
        } else if (BASE64_RE.test(content.trim()) && content.trim().length > 500) {
          b64 = content.trim();
        }
      } else if (Array.isArray(content)) {
        for (const part of content as { type?: string; text?: string; image_url?: { url?: string } }[]) {
          if (part.type === "image_url" && part.image_url?.url) {
            const url = part.image_url.url;
            const m = url.match(DATA_URI_RE);
            if (m) {
              mime = m[1];
              b64 = m[2];
              break;
            }
          }
          if (part.type === "text" && typeof part.text === "string") {
            const m = part.text.match(/data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]{100,})/i);
            if (m) {
              mime = m[1];
              b64 = m[2];
              break;
            }
          }
        }
      }
    }

    if (b64 && typeof b64 === "string" && b64.length > 100) {
      return { imageBase64: b64, mimeType: mime, model };
    }

    // If model returned text instead of image, surface it
    const textPart = typeof choice.content === "string" ? choice.content : Array.isArray(choice.content) ? (choice.content as { text?: string }[]).find((p) => typeof p.text === "string")?.text : undefined;
    if (textPart && textPart.length > 0) {
      throw new Error(`OpenRouter render returned no image (model ${model}). Response text: ${textPart.slice(0, 200)}`);
    }

    throw new Error(`OpenRouter render returned no image (model ${model})`);
  }
}
