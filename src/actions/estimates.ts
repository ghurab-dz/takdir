"use server";

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { getAiProvider } from "@/lib/ai";
import type { PhotoInput, Tier, AllowedMaterial } from "@/lib/ai/types";
import { matchExtractedItems, matchTieredItems } from "@/lib/matching";
import { computeProofHash } from "@/lib/render-hash";

export type CreateEstimateState = { error?: string };

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB each
const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const VALID_TIERS = new Set<string>(["economy", "mid", "premium"]);

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseStringArray(values: FormDataEntryValue[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const s = String(v).trim();
    if (!s) continue;
    // Support comma-separated within a single entry as well
    if (s.includes(",")) {
      for (const part of s.split(",")) {
        const t = part.trim();
        if (t) out.push(t);
      }
    } else {
      out.push(s);
    }
  }
  // Deduplicate preserving order
  return [...new Set(out)];
}

function parseBudgetTier(v: FormDataEntryValue | null): Tier | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (VALID_TIERS.has(s)) return s as Tier;
  return null;
}

/**
 * Phase 3 — Consultation creator:
 * dims + style chips + budgetTier/budgetDZD + contractorNotes + material catalog
 *   → generateOptions(3 tiers) → matchTiered(3×) → 3 hero renders → compare → pick
 */
export async function createEstimate(
  _prev: CreateEstimateState,
  formData: FormData,
): Promise<CreateEstimateState> {
  // Server guard: wizard must be on final step (5 — ملاحظات). Bypass via Enter/requestSubmit still hits server,
  // so enforce here as defense-in-depth. _step is sent as hidden input from the wizard.
  const stepRaw = String(formData.get("_step") ?? "").trim();
  if (stepRaw && stepRaw !== "5") {
    return { error: "أكمل جميع الخطوات حتى ملاحظات المقاول قبل الإرسال" };
  }

  const description = String(formData.get("description") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim() || null;
  const roomTypeRaw = String(formData.get("roomType") ?? "").trim() || null;

  const lengthM = num(formData.get("lengthM"));
  const widthM = num(formData.get("widthM"));
  const heightM = num(formData.get("heightM"));

  const styleTags = parseStringArray(formData.getAll("styleTags"));
  // style field explicit or fallback to first tag
  const styleRaw = String(formData.get("style") ?? "").trim();
  const style: string | null = styleRaw || (styleTags.length > 0 ? styleTags[0] : null);

  const budgetTierRaw = formData.get("budgetTier");
  const budgetTier = parseBudgetTier(budgetTierRaw as FormDataEntryValue | null);
  // Validate budgetTier if provided but invalid → error (strict)
  if (budgetTierRaw !== null && String(budgetTierRaw).trim() !== "" && budgetTier === null) {
    return { error: "مستوى الميزانية غير صالح (economy | mid | premium)" };
  }

  const budgetDZD = num(formData.get("budgetDZD"));
  const contractorNotesRaw = String(formData.get("contractorNotes") ?? "").trim();
  const contractorNotes: string | null = contractorNotesRaw || null;

  const files = formData
    .getAll("photos")
    .filter((f): f is File => typeof f === "object" && "arrayBuffer" in f && (f as File).size > 0);

  if (files.length === 0 && !description) {
    return { error: "أضف صورة واحدة على الأقل أو وصفًا نصيًا للغرفة" };
  }
  if (files.length > MAX_PHOTOS) {
    return { error: `الحد الأقصى ${MAX_PHOTOS} صور` };
  }
  for (const f of files) {
    if (!ALLOWED_MIME.has(f.type)) return { error: "صيغة صورة غير مدعومة (jpg / png / webp فقط)" };
    if (f.size > MAX_PHOTO_BYTES) return { error: "حجم الصورة يتجاوز 4MB" };
  }

  // Validate dims
  for (const [label, val] of [
    ["الطول", lengthM],
    ["العرض", widthM],
    ["الارتفاع", heightM],
  ] as const) {
    if (val !== null) {
      if (!(val > 0 && val < 100)) {
        return { error: `${label} يجب أن يكون بين 0 و 100 متر` };
      }
    }
  }
  if (budgetDZD !== null && budgetDZD < 0) {
    return { error: "الميزانية لا يمكن أن تكون سالبة" };
  }

  // Computed area from dims if not provided via AI later
  let computedArea: number | null = null;
  if (lengthM !== null && widthM !== null) {
    computedArea = Math.round(lengthM * widthM * 100) / 100;
  }

  // Persist photos
  const estimateId = randomUUID();
  const photoPaths: string[] = [];
  const photoInputs: PhotoInput[] = [];
  if (files.length > 0) {
    const dir = path.join(process.cwd(), "public", "uploads", estimateId);
    await fs.mkdir(dir, { recursive: true });
    let i = 0;
    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer());
      const ext = ALLOWED_MIME.get(f.type)!;
      const rel = `/uploads/${estimateId}/${i}.${ext}`;
      await fs.writeFile(path.join(dir, `${i}.${ext}`), buf);
      photoPaths.push(rel);
      photoInputs.push({ data: buf.toString("base64"), mimeType: f.type });
      i++;
    }
  }

  const contractor = await ensureDefaultContractor();

  // Load materials (catalog) — fallback to PriceItem for migration
  let materials: {
    id: string;
    itemName: string;
    unit: string;
    category: string;
    grade: Tier;
    unitPrice: number;
    visualHint: string | null;
  }[] = [];

  try {
    const mats = await (prisma as unknown as {
      material: { findMany: (args: unknown) => Promise<unknown[]> };
    }).material.findMany({
      where: { contractorId: contractor.id, isActive: true },
    });
    materials = (mats as unknown as typeof materials).map((m) => ({
      id: (m as unknown as { id: string }).id,
      itemName: (m as unknown as { itemName: string }).itemName,
      unit: (m as unknown as { unit: string }).unit,
      category: (m as unknown as { category: string }).category,
      grade: (m as unknown as { grade: Tier }).grade,
      unitPrice: Number((m as unknown as { unitPrice: unknown }).unitPrice),
      visualHint: (m as unknown as { visualHint: string | null }).visualHint ?? null,
    }));
  } catch {
    materials = [];
  }

  if (materials.length === 0) {
    // Fallback to PriceItem synthetic grade=mid
    const pricelist = await prisma.priceItem.findMany({
      where: { contractorId: contractor.id, isActive: true },
    });
    if (pricelist.length === 0) {
      return { error: "قائمة أسعارك فارغة — أضف بندًا واحدًا على الأقل من صفحة «قائمة الأسعار» أو «المواد»" };
    }
    materials = pricelist.map((p) => ({
      id: p.id,
      itemName: p.itemName,
      unit: p.unit,
      category: p.category,
      grade: "mid" as Tier,
      unitPrice: Number(p.unitPrice),
      visualHint: null,
    }));
  }

  const allowedMaterials: AllowedMaterial[] = materials.map((m) => ({
    id: m.id,
    itemName: m.itemName,
    unit: m.unit,
    category: m.category,
    grade: m.grade,
    unitPrice: m.unitPrice,
    visualHint: m.visualHint,
  }));

  // Build GenerateOptionsInput
  const dims = {
    lengthM,
    widthM,
    heightM,
    areaM2: computedArea,
  };

  const provider = getAiProvider();
  let result;
  try {
    result = await provider.generateOptions({
      photos: photoInputs,
      dims,
      styleTags,
      budgetTier,
      budgetDZD,
      contractorNotes,
      roomType: roomTypeRaw,
      description,
      allowedMaterials,
    });
  } catch (e) {
    console.error("AI generateOptions failed:", e);
    return {
      error:
        e instanceof Error && (e.message.includes("الحصة") || e.message.includes("429") || e.message.toLowerCase().includes("quota"))
          ? e.message.slice(0, 500)
          : "تعذّر تحليل الصور الآن. تحقق من مفتاح GEMINI_API_KEY أو أعد المحاولة بعد قليل.",
    };
  }

  if (!result || !result.options || result.options.length === 0) {
    return { error: "تعذّر توليد الخيارات — حاول مجددًا بوصف أو صور أوضح" };
  }

  // Normalize to exactly 3 tiers if possible; keep what AI returned (expect 3)
  // For each option, do tier-filtered matching
  // Build fallback all-materials list for cross-grade fallback
  const allMaterialsForFallback = materials.map((m) => ({
    id: m.id,
    itemName: m.itemName,
    unit: m.unit,
    unitPrice: m.unitPrice,
    category: m.category,
  }));

  type OptionWithLines = {
    tier: Tier;
    title: string;
    rationale: string | null;
    lines: ReturnType<typeof matchTieredItems>;
    total: number;
    proofHash: string;
  };

  const optionPayloads: OptionWithLines[] = [];

  // Ensure tiers sorted economy->mid->premium for stable creation
  const tierOrder: Record<Tier, number> = { economy: 0, mid: 1, premium: 2 };
  const sortedOptions = [...result.options].sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99));

  for (const opt of sortedOptions) {
    const tier = (opt.tier as Tier) || "mid";
    if (!VALID_TIERS.has(tier)) continue;
    const matsForTier = materials
      .filter((m) => m.grade === tier)
      .map((m) => ({
        id: m.id,
        itemName: m.itemName,
        unit: m.unit,
        unitPrice: m.unitPrice,
        category: m.category,
      }));
    // If no materials for this tier (should not happen after seed), fallback to all
    const tierPool = matsForTier.length > 0 ? matsForTier : allMaterialsForFallback;

    // Extracted items from AI for this tier
    const extractedForTier = (opt.items ?? []).map((it) => ({
      itemName: it.itemName,
      quantity: it.quantity,
      unit: it.unit,
      category: it.category,
    }));

    const lines = matchTieredItems(extractedForTier, tierPool, allMaterialsForFallback);
    const total = lines.reduce((s, l) => s + l.lineTotal, 0);
    const roomTypeForHash = result.roomType ?? roomTypeRaw ?? null;
    const hashItems = lines.map((l) => ({ itemName: l.itemName, category: l.category }));
    const proofHash = computeProofHash(hashItems, roomTypeForHash, tier);
    const title = opt.title || (tier === "economy" ? "اقتصادي" : tier === "premium" ? "ممتاز" : "متوازن");

    optionPayloads.push({
      tier,
      title,
      rationale: opt.rationale ?? null,
      lines,
      total: Math.round(total * 100) / 100,
      proofHash,
    });
  }

  if (optionPayloads.length === 0) {
    return { error: "لم يتم توليد أي خيار صالح — حاول مجددًا" };
  }

  const finalRoomType = result.roomType ?? roomTypeRaw ?? null;
  const finalArea = result.areaM2 ?? computedArea ?? null;
  const finalStyle = style;

  // Create estimate with nested options + option items
  try {
    await (prisma as unknown as {
      estimate: { create: (args: unknown) => Promise<unknown> };
    }).estimate.create({
      data: {
        id: estimateId,
        contractorId: contractor.id,
        clientName,
        roomType: finalRoomType,
        areaM2: finalArea,
        rawDescription: description,
        photoPaths,
        aiNotes: result.notes,
        lengthM,
        widthM,
        heightM,
        style: finalStyle,
        styleTags,
        budgetTier,
        budgetDZD,
        contractorNotes,
        options: {
          create: optionPayloads.map((o) => ({
            tier: o.tier,
            title: o.title,
            total: o.total,
            proofHash: o.proofHash,
            items: {
              create: o.lines.map((l) => ({
                materialId: l.materialId,
                itemName: l.itemName,
                quantity: l.quantity,
                unit: l.unit,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
                category: l.category || "عام",
              })),
            },
          })),
        },
      },
    });
  } catch (e) {
    console.error("Failed to create estimate with options", e);
    // Cleanup photos on failure
    const dir = path.join(process.cwd(), "public", "uploads", estimateId);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    return { error: "تعذّر حفظ التقدير — حاول مجددًا" };
  }

  revalidatePath("/");
  redirect(`/estimates/${estimateId}`);
}

// ---------- review-screen edits ----------

export async function updateEstimateItem(itemId: string, formData: FormData) {
  const quantity = num(formData.get("quantity"));
  const unitPrice = num(formData.get("unitPrice"));
  const itemName = String(formData.get("itemName") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();

  const item = await prisma.estimateItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  const q = quantity !== null && quantity >= 0 ? quantity : Number(item.quantity);
  const p = unitPrice !== null && unitPrice >= 0 ? unitPrice : Number(item.unitPrice);

  await prisma.estimateItem.update({
    where: { id: itemId },
    data: {
      quantity: q,
      unitPrice: p,
      lineTotal: Math.round(q * p * 100) / 100,
      ...(itemName ? { itemName } : {}),
      ...(unit ? { unit } : {}),
      ...(p > 0 ? { matched: true } : {}),
    },
  });
  revalidatePath(`/estimates/${item.estimateId}`);
}

export async function deleteEstimateItem(itemId: string) {
  const item = await prisma.estimateItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  await prisma.estimateItem.delete({ where: { id: itemId } });
  revalidatePath(`/estimates/${item.estimateId}`);
}

/** Add a manual row: linked to a pricelist item (copies name/unit/price) or free. */
export async function addEstimateItem(estimateId: string, formData: FormData) {
  const priceItemId = String(formData.get("priceItemId") ?? "").trim();
  const quantity = num(formData.get("quantity")) ?? 1;

  if (priceItemId) {
    const p = await prisma.priceItem.findUnique({ where: { id: priceItemId } });
    if (!p) return;
    await prisma.estimateItem.create({
      data: {
        estimateId,
        priceItemId: p.id,
        itemName: p.itemName,
        quantity,
        unit: p.unit,
        unitPrice: p.unitPrice,
        lineTotal: Math.round(quantity * Number(p.unitPrice) * 100) / 100,
        matched: true,
        source: "manual",
      },
    });
  } else {
    const itemName = String(formData.get("itemName") ?? "").trim();
    const unit = String(formData.get("unit") ?? "").trim() || "وحدة";
    const unitPrice = num(formData.get("unitPrice")) ?? 0;
    if (!itemName) return;
    await prisma.estimateItem.create({
      data: {
        estimateId,
        priceItemId: null,
        itemName,
        quantity,
        unit,
        unitPrice,
        lineTotal: Math.round(quantity * unitPrice * 100) / 100,
        matched: true,
        source: "manual",
      },
    });
  }
  revalidatePath(`/estimates/${estimateId}`);
}

export async function updateEstimateMeta(estimateId: string, formData: FormData) {
  const clientName = String(formData.get("clientName") ?? "").trim() || null;
  const roomType = String(formData.get("roomType") ?? "").trim() || null;
  const areaM2 = num(formData.get("areaM2"));

  const lengthM = num(formData.get("lengthM"));
  const widthM = num(formData.get("widthM"));
  const heightM = num(formData.get("heightM"));

  const styleTags = parseStringArray(formData.getAll("styleTags"));
  const styleRaw = String(formData.get("style") ?? "").trim();
  // If style not explicitly provided but styleTags present, use first tag
  let style: string | null = styleRaw || null;
  if (!style && styleTags.length > 0) style = styleTags[0];
  // Allow clearing styleTags explicitly? If form contains styleTags field but empty array, keep existing? We treat empty as no change only if not present.
  // For simplicity, if styleTags array empty and form has no styleTags key, don't overwrite.
  const hasStyleTags = formData.getAll("styleTags").length > 0;

  const budgetTierRaw = formData.get("budgetTier");
  let budgetTier: string | null | undefined = undefined;
  if (budgetTierRaw !== null) {
    const s = String(budgetTierRaw).trim();
    if (s === "") budgetTier = null;
    else if (VALID_TIERS.has(s)) budgetTier = s;
    else budgetTier = null; // invalid -> null (or could error, but meta update is lenient)
  }

  const budgetDZDVal = formData.get("budgetDZD");
  let budgetDZD: number | null | undefined = undefined;
  if (budgetDZDVal !== null) {
    const raw = String(budgetDZDVal).trim();
    if (raw === "") budgetDZD = null;
    else {
      const n = num(budgetDZDVal as FormDataEntryValue);
      if (n !== null && n < 0) return; // silently ignore invalid
      budgetDZD = n;
    }
  }

  const contractorNotesRaw = formData.get("contractorNotes");
  let contractorNotes: string | null | undefined = undefined;
  if (contractorNotesRaw !== null) {
    const s = String(contractorNotesRaw).trim();
    contractorNotes = s || null;
  }

  // Validate dims if provided
  for (const [label, val] of [
    ["الطول", lengthM],
    ["العرض", widthM],
    ["الارتفاع", heightM],
  ] as const) {
    if (val !== null && !(val > 0 && val < 100)) {
      // Silently ignore invalid on meta update? Or throw? We return early without update
      return;
    }
  }

  // Auto-compute area if length+width present but area not explicitly set
  let finalArea = areaM2;
  if (finalArea === null && lengthM !== null && widthM !== null) {
    finalArea = Math.round(lengthM * widthM * 100) / 100;
  }

  const data: Record<string, unknown> = {
    clientName,
    roomType,
  };
  if (areaM2 !== null || finalArea !== null) data.areaM2 = finalArea;
  else if (formData.get("areaM2") !== null) data.areaM2 = null;

  if (lengthM !== null || formData.get("lengthM") !== null) data.lengthM = lengthM;
  if (widthM !== null || formData.get("widthM") !== null) data.widthM = widthM;
  if (heightM !== null || formData.get("heightM") !== null) data.heightM = heightM;
  if (formData.get("style") !== null || hasStyleTags) data.style = style;
  if (hasStyleTags) data.styleTags = styleTags;
  if (budgetTier !== undefined) data.budgetTier = budgetTier;
  if (budgetDZD !== undefined) data.budgetDZD = budgetDZD;
  if (contractorNotes !== undefined) data.contractorNotes = contractorNotes;

  await prisma.estimate.update({
    where: { id: estimateId },
    data: data as never,
  });
  revalidatePath(`/estimates/${estimateId}`);
}

export async function setEstimateStatus(estimateId: string, status: "draft" | "final") {
  await prisma.estimate.update({ where: { id: estimateId }, data: { status } });
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/");
}

export async function deleteEstimate(estimateId: string) {
  await prisma.estimate.delete({ where: { id: estimateId } });
  // best-effort photo cleanup
  const dir = path.join(process.cwd(), "public", "uploads", estimateId);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  revalidatePath("/");
  redirect("/");
}
