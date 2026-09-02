// Render prompt — INSPIRING single design: bold full-room transform, contractor color OVERRIDES tier.
export const RENDER_SYSTEM_INSTRUCTION = `You are a professional interior renovation photo editor for Algeria. Transform the ORIGINAL room photo into a FINISHED showroom.

ABSOLUTE RULES — FAILURE IF VIOLATED:
1. BOLD, VISIBLE COLOR/MATERIAL CHANGE IS MANDATORY — repaint ALL walls with a SOLID, UNIFORM, VIVID color and retile ALL floor with a CLEARLY NEW pattern. Before vs after must be INSTANTLY obvious. Subtle/washed-out edits = FAILURE.
2. CONTRACTOR COLOR REQUEST IS HIGHEST PRIORITY — if contractor says "red / ahmar / beige / blue" you MUST paint that exact color vividly on the appropriate surface, even if it conflicts with tier description. Tier defines QUALITY (ceramic vs porcelain vs marble), NOT color when a color is requested.
3. Keep geometry, doors, windows, furniture positions exactly as original. Only surface finishes change. Do not add/remove furniture.
4. Lighting natural, finishes clearly visible.
5. Output ONE photorealistic image only, no text.`;

import type { Tier } from "./types";

const TIER_QUALITY: Record<Tier, string> = {
  economy: "ECONOMY QUALITY — budget ceramic 30x30, matte paint, simple finish",
  mid: "MID QUALITY — balanced porcelain 60x60, washable, good finish",
  premium: "PREMIUM QUALITY — luxury polished marble 80x80, premium paint + hidden LED accent, high-end",
};

export function buildRenderPrompt(
  items: { itemName: string; category: string; visualHint?: string | null }[],
  roomType: string | null,
  tier?: Tier | string | null,
  styleTags?: string[] | null,
  contractorNotes?: string | null,
): string {
  const list =
    items.length > 0
      ? items
          .map((i) => `- "${i.itemName}" (category: ${i.category}${i.visualHint ? ` — FINISH: ${i.visualHint}` : ""})`)
          .join("\n")
      : "(general renovation — transform all walls & floor coherently)";

  let prompt = `Design guidance (materials to use — FINISH field is the exact color/material to apply vividly):
${list}

Room type: ${roomType ?? "unknown"}

TASK: Edit the attached ORIGINAL photo into FINISHED renovation. Repaint ALL walls and retile ALL floor. Each item FINISH must be applied EXACTLY as written — e.g., if FINISH says "ahmar" paint walls SOLID RED, if "beige porcelain" use beige porcelain.
Requirements:
- ALL walls: solid uniform vivid color (not patchy, not subtle)
- ALL floor: clearly new tile/marble with visible pattern/grout
- BOLD, photorealistic, showroom lit
- Keep camera angle and furniture, no new decor
- Output ONE final image only.`;

  if (tier) {
    const q = TIER_QUALITY[tier as Tier] ?? tier;
    prompt += `\n\nTier quality hint: ${tier} — ${q} (QUALITY only — color comes from FINISH / contractor request above)`;
  }
  if (styleTags && styleTags.length > 0) {
    prompt += `\nStyle: ${styleTags.join(", ")}`;
  }
  if (contractorNotes && contractorNotes.trim()) {
    prompt += `\n\n*** CONTRACTOR EXPLICIT REQUEST (TOP PRIORITY — MUST OBEY COLOR/MATERIAL): """${contractorNotes.trim()}""" — THIS OVERRIDES ANY OTHER COLOR. If it says ahmar/red, walls MUST be RED. If it says beige, floor MUST be beige. Apply vividly and uniformly.`;
  }
  prompt += `\n\nFINAL VERIFICATION: If the image looks almost identical to original, or the requested color (e.g., red) is not clearly visible on walls/floor, you FAILED. Make the change OBVIOUS.`;
  return prompt;
}

/** Stable hash for proof/stale detection — hash of sorted item names + roomType + tier */
export function hashRenderInput(
  items: { itemName: string; category: string }[],
  roomType: string | null,
  tier?: Tier | string | null,
): string {
  const normalized = [...items]
    .map((i) => `${i.category}:${i.itemName}`)
    .sort()
    .join("|");
  const raw = tier ? `${normalized}::${roomType ?? ""}::${tier}` : `${normalized}::${roomType ?? ""}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = (h * 33) ^ raw.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}
