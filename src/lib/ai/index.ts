// AI provider factory — OpenRouter only (no mock)
// Estimation: free vision model (Gemma 4) — Image: Seedream 5.0-lite (paid quality)

import { OpenRouterProvider } from "./openrouter";
import type { AiProvider } from "./types";

export function getAiProvider(): AiProvider {
  const oKey = process.env.OPENROUTER_API_KEY;
  if (!oKey || !isValidOpenRouterKey(oKey)) {
    throw new Error(
      "OPENROUTER_API_KEY غير موجود أو غير صالح — أضف مفتاح OpenRouter صالح (sk-or-v1-...) في .env ثم أعد تشغيل الخادم"
    );
  }
  return new OpenRouterProvider(oKey.trim());
}

function isValidOpenRouterKey(key: string): boolean {
  const k = key.trim();
  const lower = k.toLowerCase();
  if (!k || lower.includes("placeholder") || lower.includes("your_") || k.length < 20) return false;
  if (lower.includes("replace_with_real_key")) return false;
  return true;
}

export function getFallbackProvider(): AiProvider | null {
  // No fallback — OpenRouter is the only provider (free estimation + paid image)
  return null;
}

export function getImageProvider(): AiProvider {
  // Same OpenRouter provider but will use image model (Seedream) via OPENROUTER_IMAGE_MODEL
  const oKey = process.env.OPENROUTER_API_KEY;
  if (!oKey || !isValidOpenRouterKey(oKey)) {
    throw new Error(
      "OPENROUTER_API_KEY غير موجود أو غير صالح — الصور تحتاج مفتاح OpenRouter (sk-or-v1-...) في .env"
    );
  }
  return new OpenRouterProvider(oKey.trim());
}

export function isQuotaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("429") ||
    msg.includes("الحصة") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("exceeded") ||
    msg.includes("تجاوزت")
  );
}

/**
 * Helper: try primary provider, propagate quota errors as-is (no mock fallback).
 */
export async function withFallback<T>(primary: AiProvider, fn: (p: AiProvider) => Promise<T>): Promise<T> {
  try {
    return await fn(primary);
  } catch (e) {
    if (!isQuotaError(e)) throw e;
    const fallback = getFallbackProvider();
    if (fallback) {
      return await fn(fallback);
    }
    throw e;
  }
}

export { isValidOpenRouterKey };
export type { AiProvider } from "./types";
