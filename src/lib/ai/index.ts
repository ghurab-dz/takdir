// AI provider factory — swap providers here, the rest of the app never changes.

import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { OpenRouterProvider } from "./openrouter";
import type { AiProvider } from "./types";

function isValidGeminiKey(key: string): boolean {
  const k = key.trim();
  // Gemini Studio keys are AIza... and >=35 chars; "placeholder"/"YOUR_" etc are invalid
  if (!k || k.includes("placeholder") || k.includes("YOUR_") || k.length < 20) return false;
  // Real keys start with AIza — the AQ... key in .env is not Gemini (H2)
  // Accept any 30+ char key but warn if not AIza, still allow — fallback will handle 429
  // For MVP: treat clearly invalid short/AQ key as mock to avoid 429 storm
  if (k.startsWith("AQ.")) return false;
  return true;
}

export function getAiProvider(): AiProvider {
  const key = process.env.GEMINI_API_KEY;
  if (key && isValidGeminiKey(key)) return new GeminiProvider(key.trim());
  if (key && key.trim() !== "" && !isValidGeminiKey(key)) {
    console.warn("[ai] GEMINI_API_KEY looks invalid (not AIza…), falling back to mock — check .env");
  }
  return new MockProvider();
}

function isValidOpenRouterKey(key: string): boolean {
  const k = key.trim();
  if (!k || k.includes("placeholder") || k.includes("YOUR_") || k.length < 20) return false;
  return true;
}

export function getFallbackProvider(): AiProvider | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (key && isValidOpenRouterKey(key)) return new OpenRouterProvider(key.trim());
  return null;
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
 * Helper: try primary provider, on quota (429) fallback to OpenRouter, then mock.
 * Keeps existing getAiProvider() semantics for callers that handle fallback themselves.
 */
export async function withFallback<T>(primary: AiProvider, fn: (p: AiProvider) => Promise<T>): Promise<T> {
  try {
    return await fn(primary);
  } catch (e) {
    if (!isQuotaError(e)) throw e;
    const fallback = getFallbackProvider();
    if (fallback) {
      try {
        return await fn(fallback);
      } catch (e2) {
        if (!isQuotaError(e2)) throw e2;
        // fall through to mock
      }
    }
    const mock = new MockProvider();
    return await fn(mock);
  }
}

export { isValidGeminiKey, isValidOpenRouterKey };
export type { AiProvider } from "./types";
