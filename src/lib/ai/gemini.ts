// Google Gemini adapter — free tier, multimodal, JSON mode.
// Uses plain REST (no SDK) to keep dependencies minimal.
// Model: gemini-3.6-flash (gemini-2.5-flash is no longer available to new keys).

import { SYSTEM_INSTRUCTION, buildUserPrompt, RESPONSE_SCHEMA } from "./prompt";
import type { AiProvider, ExtractionInput, ExtractionResult } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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
}
