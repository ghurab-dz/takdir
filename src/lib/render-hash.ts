// Pure helper for proofHash — shared between actions and UI.
import { hashRenderInput } from "./ai/render-prompt";
import type { Tier } from "./ai/types";

export function computeProofHash(
  items: { itemName: string; category?: string; unit?: string }[],
  roomType: string | null,
  tier?: Tier | string | null,
): string {
  // Category unknown for manual items? Fall back to "عام"
  const normalized = items.map((i) => ({
    itemName: i.itemName,
    category: (i.category as string) ?? "عام",
  }));
  return hashRenderInput(normalized, roomType, tier ?? null);
}

export function isRenderStale(currentHash: string, storedHash: string | null): boolean {
  if (!storedHash) return true;
  return currentHash !== storedHash;
}
