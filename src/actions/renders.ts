"use server";

import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAiProvider, getFallbackProvider, isQuotaError } from "@/lib/ai";
import type { PhotoInput, RenderItem, Tier } from "@/lib/ai/types";
import { buildRenderPrompt, hashRenderInput } from "@/lib/ai/render-prompt";
import { computeProofHash } from "@/lib/render-hash";

const MAX_RENDERS_PER_ESTIMATE = 4;
const HERO_TIERS: Tier[] = ["economy", "mid", "premium"];
const MAX_HERO_RENDERS = 3;

function extForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function mimeForPath(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Generate hero renders for 3 tiers using photoPaths[heroIndex].
 * MVP: 1 hero angle per option = 3 images total sequential.
 */
export async function generateOptionRenders(
  estimateId: string,
  opts?: { heroIndex?: number },
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const heroIdx = opts?.heroIndex ?? 0;

  // Load estimate with options + items
  let estimate: unknown;
  try {
    estimate = await (prisma as unknown as {
      estimate: { findUnique: (args: unknown) => Promise<unknown> };
    }).estimate.findUnique({
      where: { id: estimateId },
      include: {
        options: { include: { items: true } },
      },
    });
  } catch (e) {
    return { ok: false, error: `فشل تحميل التقدير: ${(e as Error).message?.slice(0, 200) ?? String(e)}` };
  }
  if (!estimate) return { ok: false, error: "التقدير غير موجود" };

  const est = estimate as unknown as {
    id: string;
    photoPaths: string[];
    roomType: string | null;
    styleTags: string[];
    options: {
      id: string;
      tier: string;
      title: string;
      items: { id: string; itemName: string; category: string; quantity: unknown; unit: string }[];
      proofHash?: string | null;
    }[];
  };

  const photoPaths = (est.photoPaths as string[]) ?? [];
  if (photoPaths.length === 0) return { ok: false, error: "لا توجد صور أصلية لإنشاء المعاينة" };

  if (heroIdx < 0 || heroIdx >= photoPaths.length) {
    return { ok: false, error: "فهرس الصورة غير صالح" };
  }
  const heroPath = photoPaths[heroIdx];
  if (!heroPath) return { ok: false, error: "الصورة الأصلية غير موجودة" };

  let options = est.options ?? [];
  if (options.length === 0) {
    return { ok: false, error: "لا توجد خيارات مولدة لهذا التقدير" };
  }

  // Sort by tier order economy -> mid -> premium for sequential determinism
  const tierOrder: Record<string, number> = { economy: 0, mid: 1, premium: 2 };
  options = [...options].sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99));
  // Cap to MAX_HERO_RENDERS
  if (options.length > MAX_HERO_RENDERS) options = options.slice(0, MAX_HERO_RENDERS);

  const roomType = (est as unknown as { roomType: string | null }).roomType ?? null;
  const styleTags: string[] = Array.isArray((est as unknown as { styleTags?: unknown }).styleTags)
    ? ((est as unknown as { styleTags: string[] }).styleTags ?? [])
    : [];

  // Prepare per-tier hashes and prompts
  const tierMeta = new Map<
    string,
    { items: RenderItem[]; promptHash: string; promptSnapshot: string; proofHash: string; optionId: string; tier: Tier }
  >();
  for (const opt of options) {
    const tier = opt.tier as Tier;
    const items: RenderItem[] = (opt.items ?? []).map((it) => ({
      itemName: it.itemName,
      category: it.category ?? "عام",
      unit: (it as unknown as { unit?: string }).unit ?? "وحدة",
    }));
    const proofHash = computeProofHash(items, roomType, tier);
    const promptSnapshot = buildRenderPrompt(items, roomType, tier, styleTags);
    const promptHash = hashRenderInput(items, roomType, tier);
    tierMeta.set(tier, { items, promptHash, promptSnapshot, proofHash, optionId: opt.id, tier });
  }

  // Clean previous tiered renders for this estimate (broader fallback for mock compatibility)
  try {
    // Try tier-filtered delete (real Prisma supports `in`)
    const prAny = prisma as unknown as {
      estimateRender?: { deleteMany: (a: unknown) => Promise<unknown>; findMany?: (a: unknown) => Promise<unknown[]> };
    };
    if (prAny.estimateRender?.deleteMany) {
      try {
        // Real DB: filter by tier in HERO_TIERS
        await prAny.estimateRender.deleteMany({
          where: { estimateId, tier: { in: HERO_TIERS } } as unknown as Record<string, unknown>,
        });
        // Also fallback: ensure mock cleans — if still renders remain with tier, delete all for estimate
        // Check remaining count for mock compatibility
        try {
          const remaining = await (prAny.estimateRender.findMany as unknown as ((a: unknown) => Promise<unknown[]>))?.({ where: { estimateId } } as unknown as Record<string, unknown>);
          // If mock didn't respect `in`, remaining will still have tiered renders -> clean all
          if (Array.isArray(remaining) && (remaining as unknown as { tier: string | null }[]).some((r) => r.tier && HERO_TIERS.includes(r.tier as Tier))) {
            await prAny.estimateRender.deleteMany({ where: { estimateId } });
          }
        } catch {}
      } catch {
        // Fallback to broader delete
        await prAny.estimateRender.deleteMany({ where: { estimateId } });
      }
    }
  } catch {
    // ignore
  }

  // Create pending rows
  const pendingRenders: { id: string; tier: Tier; optionId: string }[] = [];
  for (const opt of options) {
    const tier = opt.tier as Tier;
    const meta = tierMeta.get(tier);
    if (!meta) continue;
    try {
      const r = await (prisma as unknown as {
        estimateRender: { create: (args: unknown) => Promise<{ id: string }> };
      }).estimateRender.create({
        data: {
          estimateId,
          optionId: meta.optionId,
          basePhotoPath: heroPath,
          tier: meta.tier,
          status: "pending",
          promptHash: meta.promptHash,
          promptSnapshot: meta.promptSnapshot,
        },
      });
      pendingRenders.push({ id: (r as unknown as { id: string }).id, tier, optionId: meta.optionId });
    } catch (e) {
      console.error("create pending render failed for tier", tier, e);
    }
  }

  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath(`/estimates/${estimateId}/quote`);

  // Sequential loop with rate-limit respect
  const provider = getAiProvider();
  let doneCount = 0;

  for (let idx = 0; idx < pendingRenders.length; idx++) {
    const pr = pendingRenders[idx];
    const meta = tierMeta.get(pr.tier);
    if (!meta) continue;

    // Sleep between calls to respect free tier RPM (skip first)
    if (idx > 0) await sleep(1200);

    try {
      const rel = heroPath.startsWith("/") ? heroPath.slice(1) : heroPath;
      const abs = path.join(process.cwd(), "public", rel);
      let buf: Buffer;
      try {
        buf = await fs.readFile(abs);
      } catch {
        await (prisma as unknown as { estimateRender: { update: (a: unknown) => Promise<unknown> } }).estimateRender.update({
          where: { id: pr.id },
          data: { status: "failed", error: "تعذّر قراءة الصورة الأصلية", renderedAt: new Date() },
        });
        continue;
      }

      const mime = mimeForPath(heroPath);
      const photoInput: PhotoInput = { data: buf.toString("base64"), mimeType: mime };

      let result: { imageBase64: string; mimeType: string; model: string } | undefined;
      let wasFallback = false;

      try {
        result = await provider.render({
          basePhoto: photoInput,
          items: meta.items,
          roomType,
          tier: pr.tier,
          styleTags,
        });
      } catch (e) {
        if (isQuotaError(e)) {
          // Try OpenRouter fallback first
          const fallback = getFallbackProvider();
          let fallbackSucceeded = false;
          if (fallback) {
            try {
              result = await fallback.render({
                basePhoto: photoInput,
                items: meta.items,
                roomType,
                tier: pr.tier,
                styleTags,
              });
              fallbackSucceeded = true;
            } catch (e2) {
              if (!isQuotaError(e2)) {
                const msg2 = e2 instanceof Error ? e2.message : String(e2);
                await (prisma as unknown as { estimateRender: { update: (a: unknown) => Promise<unknown> } }).estimateRender.update({
                  where: { id: pr.id },
                  data: {
                    status: "failed",
                    error: msg2.slice(0, 500),
                    renderedAt: new Date(),
                    model: (fallback as unknown as { name: string }).name,
                  },
                });
                continue;
              }
              // quota again -> try mock
            }
          }
          if (!fallbackSucceeded) {
            try {
              const { MockProvider } = await import("@/lib/ai/mock");
              const mock = new MockProvider();
              result = await mock.render({
                basePhoto: photoInput,
                items: meta.items,
                roomType,
                tier: pr.tier,
                styleTags,
              });
              (result as unknown as { model: string }).model = `mock-fallback:quota`;
              wasFallback = true;
            } catch (fbErr) {
              const fbMsg = fbErr instanceof Error ? fbErr.message : String(fbErr);
              await (prisma as unknown as { estimateRender: { update: (a: unknown) => Promise<unknown> } }).estimateRender.update({
                where: { id: pr.id },
                data: {
                  status: "failed",
                  error: `تجاوزت الحصة المجانية — فشل حتى الوضع الاحتياطي: ${fbMsg.slice(0, 200)}`,
                  renderedAt: new Date(),
                  model: (provider as unknown as { name: string }).name,
                },
              });
              continue;
            }
          }
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          const friendly =
            msg.includes("Gemini") && msg.includes("error")
              ? `تعذّر التوليد (${msg.slice(0, 220)}) — حاول مجددًا أو اعمل دون AI`
              : msg;
          await (prisma as unknown as { estimateRender: { update: (a: unknown) => Promise<unknown> } }).estimateRender.update({
            where: { id: pr.id },
            data: {
              status: "failed",
              error: friendly.slice(0, 500),
              renderedAt: new Date(),
              model: (provider as unknown as { name: string }).name,
            },
          });
          continue;
        }
      }

      if (!result) {
        await (prisma as unknown as { estimateRender: { update: (a: unknown) => Promise<unknown> } }).estimateRender.update({
          where: { id: pr.id },
          data: { status: "failed", error: "تعذّر التوليد — لا توجد نتيجة", renderedAt: new Date() },
        });
        continue;
      }

      const ext = extForMime(result.mimeType);
      const renderRel = `/uploads/${estimateId}/render-${pr.tier}.${ext}`;
      const renderAbs = path.join(process.cwd(), "public", renderRel.startsWith("/") ? renderRel.slice(1) : renderRel);
      await fs.mkdir(path.dirname(renderAbs), { recursive: true });
      await fs.writeFile(renderAbs, Buffer.from(result.imageBase64, "base64"));

      await (prisma as unknown as { estimateRender: { update: (a: unknown) => Promise<unknown> } }).estimateRender.update({
        where: { id: pr.id },
        data: {
          status: "done",
          renderPath: renderRel,
          model: result.model,
          renderedAt: new Date(),
          error: wasFallback ? "وضع احتياطي: الحصة المجانية انتهت — عُرضت الصورة الأصلية مؤقتًا" : null,
        },
      });
      doneCount++;

      // Update option proofHash after successful render (ensure persisted)
      try {
        await (prisma as unknown as { estimateOption: { update: (a: unknown) => Promise<unknown> } }).estimateOption.update({
          where: { id: pr.optionId },
          data: { proofHash: meta.proofHash },
        });
      } catch {}
    } catch (e) {
      console.error("render loop error", e);
      try {
        await (prisma as unknown as { estimateRender: { update: (a: unknown) => Promise<unknown> } }).estimateRender.update({
          where: { id: pr.id },
          data: { status: "failed", error: e instanceof Error ? e.message.slice(0, 500) : String(e), renderedAt: new Date() },
        });
      } catch {}
    }
    revalidatePath(`/estimates/${estimateId}`);
    revalidatePath(`/estimates/${estimateId}/quote`);
    revalidatePath(`/`);
  }

  // Update estimate lastRenderedAt after all done
  try {
    await prisma.estimate.update({
      where: { id: estimateId },
      data: { lastRenderedAt: new Date() } as unknown as Record<string, unknown>,
    });
  } catch {}

  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath(`/estimates/${estimateId}/quote`);

  const finalDone = await (async () => {
    try {
      const rows = await (prisma as unknown as {
        estimateRender: { findMany: (a: unknown) => Promise<{ status: string }[]> };
      }).estimateRender.findMany({
        where: { estimateId },
      });
      return rows.filter((r) => r.status === "done").length;
    } catch {
      return doneCount;
    }
  })();

  return { ok: true, count: finalDone };
}

/**
 * Legacy alias — kept for compat. Delegates to generateOptionRenders.
 * @deprecated use generateOptionRenders
 */
export async function generateRenders(estimateId: string): Promise<{ ok: boolean; error?: string; count?: number }> {
  return generateOptionRenders(estimateId);
}

export async function regenerateRenders(estimateId: string) {
  return generateOptionRenders(estimateId);
}

export async function deleteRenders(estimateId: string) {
  try {
    await (prisma as unknown as { estimateRender: { deleteMany: (a: unknown) => Promise<unknown> } }).estimateRender.deleteMany({
      where: { estimateId },
    });
    // Clear option proofHashes
    try {
      const prAny = prisma as unknown as {
        estimateOption: { findMany?: (a: unknown) => Promise<{ id: string }[]>; update?: (a: unknown) => Promise<unknown> };
      };
      const opts = await prAny.estimateOption?.findMany?.({ where: { estimateId } });
      if (opts) {
        for (const o of opts as unknown as { id: string }[]) {
          try {
            await prAny.estimateOption?.update?.({ where: { id: o.id }, data: { proofHash: null } });
          } catch {}
        }
      }
    } catch {}
    await prisma.estimate.update({
      where: { id: estimateId },
      data: { proofHash: null, lastRenderedAt: null } as unknown as Record<string, unknown>,
    });
  } catch {}
  // try cleanup files render-*
  const dir = path.join(process.cwd(), "public", "uploads", estimateId);
  try {
    const files = await fs.readdir(dir);
    for (const f of files) if (f.startsWith("render-")) await fs.unlink(path.join(dir, f)).catch(() => {});
  } catch {}
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath(`/estimates/${estimateId}/quote`);
}
