// AI provider factory — swap providers here, the rest of the app never changes.

import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import type { AiProvider } from "./types";

export function getAiProvider(): AiProvider {
  const key = process.env.GEMINI_API_KEY;
  if (key && key.trim() !== "") return new GeminiProvider(key.trim());
  return new MockProvider();
}

export type { AiProvider } from "./types";
