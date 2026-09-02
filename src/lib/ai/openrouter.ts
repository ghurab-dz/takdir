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
const OPENROUTER_IMAGE_ENDPOINT = "https://openrouter.ai/api/v1/images";
// Estimation: free vision+JSON for Arabic (minimax-m3:free — currently not rate-limited, good Arabic + JSON). Image: Gemini 2.5 Flash Image (Nano Banana — cheap, reliable for renovation)
const DEFAULT_MODEL = "minimax/minimax-m3:free";
const DEFAULT_IMAGE_MODEL = "google/gemini-2.5-flash-image";

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
      // Content may be JSON string or already object? Handle both + strip ```json fences (minimax wraps)
      let textToParse = typeof rawContent === "string" ? rawContent.trim() : JSON.stringify(rawContent);
      if (textToParse.startsWith("```")) {
        textToParse = textToParse.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      }
      parsed = JSON.parse(textToParse);
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
      let textToParse = text.trim();
      if (textToParse.startsWith("```")) {
        textToParse = textToParse.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      }
      parsed = JSON.parse(textToParse);
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
    const prompt = buildRenderPrompt(input.items, input.roomType, input.tier ?? null, input.styleTags ?? [], input.contractorNotes ?? null);
    const model = getImageModel();

    // Seedream uses dedicated Image API (/api/v1/images); Gemini image uses chat completions (not /images)
    const isSeedream = model.includes("seedream");
    if (isSeedream) {
      const body: Record<string, unknown> = {
        model,
        prompt,
        n: 1,
      };
      // Seedream supports image-to-image via input_references
      body["input_references"] = [
        { type: "image_url", image_url: { url: toImageUrl(input.basePhoto) } },
      ];
      const res = await fetch(OPENROUTER_IMAGE_ENDPOINT, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        if (res.status === 429 || isQuotaMessage(bodyText)) {
          throw new Error(`تجاوزت الحصة لـ OpenRouter Image (429). التفاصيل: ${bodyText.slice(0, 180)}`);
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error(`مفتاح OpenRouter غير صالح (${res.status}). تحقق من OPENROUTER_API_KEY.`);
        }
        throw new Error(`OpenRouter image error ${res.status}: ${bodyText.slice(0, 400)}`);
      }

      const data = await res.json();
      // Image API returns { data: [{ b64_json, media_type }], usage: { cost } }
      const first = (data as { data?: { b64_json?: string; media_type?: string }[] })?.data?.[0];
      const b64 = first?.b64_json;
      const media = first?.media_type || "image/png";
      const mime = media.includes("png") ? "image/png" : media.includes("webp") ? "image/webp" : "image/jpeg";
      if (b64 && typeof b64 === "string" && b64.length > 100) {
        return { imageBase64: b64, mimeType: mime, model };
      }
      throw new Error(`OpenRouter image returned no data (model ${model})`);
    }

    // Fallback: chat-completions image path (for models that support image output via chat)
    const content: unknown[] = [
      { type: "image_url", image_url: { url: toImageUrl(input.basePhoto) } },
      { type: "text", text: prompt },
    ];
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: RENDER_SYSTEM_INSTRUCTION },
          { role: "user", content },
        ],
        temperature: 0.9,
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
    const choice = (data as { choices?: { message?: unknown }[] })?.choices?.[0]?.message as unknown as { images?: unknown; content?: unknown } | undefined;
    if (!choice) throw new Error(`OpenRouter render returned no image (model ${model})`);

    let b64: string | undefined;
    let mime = "image/jpeg";
    const images = (choice as { images?: unknown }).images as unknown;
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
    if (!b64) {
      const contentVal = (choice as { content?: unknown }).content;
      if (typeof contentVal === "string" && contentVal.length > 100) {
        const dataUriMatch = contentVal.match(/data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]{100,})/i);
        if (dataUriMatch) {
          mime = dataUriMatch[1];
          b64 = dataUriMatch[2];
        } else if (BASE64_RE.test(contentVal.trim()) && contentVal.trim().length > 500) {
          b64 = contentVal.trim();
        }
      } else if (Array.isArray(contentVal)) {
        for (const part of contentVal as { type?: string; text?: string; image_url?: { url?: string } }[]) {
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
    const textPart = typeof (choice as { content?: unknown }).content === "string" ? (choice as { content: string }).content : Array.isArray((choice as { content?: unknown }).content) ? ((choice as { content: unknown[] }).content as { text?: string }[]).find((p) => typeof p.text === "string")?.text : undefined;
    if (textPart && textPart.length > 0) {
      throw new Error(`OpenRouter render returned no image (model ${model}). Response text: ${textPart.slice(0, 200)}`);
    }
    throw new Error(`OpenRouter render returned no image (model ${model})`);
  }
}
