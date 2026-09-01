"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { findBestMatch, normalizeArabic } from "@/lib/matching";

const VALID_TIERS = new Set(["economy", "mid", "premium"]);

export type SelectOptionResult = { ok: true } | { ok: false; error: string };

/**
 * Pick one of the 3 generated options as the final estimate.
 * Clones EstimateOptionItem → EstimateItem (final editable snapshot),
 * sets selectedOptionId and status=draft (still editable before print).
 */
export async function selectOption(estimateId: string, tier: string): Promise<SelectOptionResult> {
  const normalizedTier = String(tier ?? "").trim().toLowerCase();
  if (!VALID_TIERS.has(normalizedTier)) {
    return { ok: false, error: "المستوى غير صالح — اختر economy أو mid أو premium" };
  }

  // Load estimate with options including items
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
    contractorId: string;
    options: {
      id: string;
      tier: string;
      title: string;
      total: unknown;
      items: {
        id: string;
        optionId: string;
        materialId: string | null;
        itemName: string;
        quantity: unknown;
        unit: string;
        unitPrice: unknown;
        lineTotal: unknown;
        category: string;
      }[];
    }[];
  };

  const option = est.options.find((o) => o.tier === normalizedTier);
  if (!option) return { ok: false, error: "الخيار المطلوب غير موجود" };
  if (!option.items || option.items.length === 0) {
    return { ok: false, error: "هذا الخيار لا يحتوي على بنود" };
  }

  // For legacy priceItemId linking, try to map by name via PriceItem catalog (best-effort)
  let priceItemMap = new Map<string, string>(); // normalized name -> priceItemId
  try {
    const priceItems = await prisma.priceItem.findMany({
      where: { contractorId: est.contractorId },
    });
    const entries = (priceItems as unknown as { id: string; itemName: string }[]).map((p) => ({
      id: p.id,
      norm: normalizeArabic(p.itemName),
      raw: p,
    }));
    // Build quick exact map
    for (const e of entries) priceItemMap.set(e.norm, e.id);
  } catch {}

  // Delete existing final items for this estimate
  try {
    await prisma.estimateItem.deleteMany({ where: { estimateId } });
  } catch (e) {
    console.warn("[selectOption] deleteMany failed", e);
    // continue — maybe table empty
  }

  // Bulk create EstimateItem from option items
  const itemsToCreate = option.items.map((it) => {
    const itemName = it.itemName;
    const quantity = Number(it.quantity);
    const unit = it.unit || "وحدة";
    const unitPrice = Number(it.unitPrice);
    const lineTotal = Number(it.lineTotal) || Math.round(quantity * unitPrice * 100) / 100;
    // Try to find priceItemId via exact normalized match, else fallback to null
    let priceItemId: string | null = null;
    const norm = normalizeArabic(itemName);
    if (priceItemMap.has(norm)) {
      priceItemId = priceItemMap.get(norm)!;
    } else if (priceItemMap.size > 0) {
      // fuzzy: try token overlap via findBestMatch over priceItems
      try {
        const pool = [...priceItemMap.entries()].map(([n, id]) => ({ id, itemName: n, unit, unitPrice }));
        // We don't have original itemNames, but we have norm as name; use norm as proxy
        // Better fetch real list again for fuzzy
      } catch {}
    }
    return {
      estimateId,
      priceItemId,
      itemName,
      quantity,
      unit,
      unitPrice,
      lineTotal,
      matched: true,
      source: "ai_extracted" as const,
    };
  });

  try {
    if (itemsToCreate.length > 0) {
      const api = prisma.estimateItem as unknown as {
        createMany?: (args: unknown) => Promise<unknown>;
        create: (args: unknown) => Promise<unknown>;
      };
      if (api.createMany) {
        await api.createMany({ data: itemsToCreate });
      } else {
        for (const d of itemsToCreate) {
          await api.create({ data: d });
        }
      }
    }
  } catch (e) {
    console.error("[selectOption] bulk create failed", e);
    return { ok: false, error: "تعذّر حفظ الخيار المحدد — حاول مجددًا" };
  }

  // Set selectedOptionId and status draft
  try {
    await prisma.estimate.update({
      where: { id: estimateId },
      data: {
        selectedOptionId: option.id,
        status: "draft",
      } as unknown as Record<string, unknown>,
    });
  } catch (e) {
    console.error("[selectOption] update estimate failed", e);
    return { ok: false, error: "تعذّر تحديث التقدير" };
  }

  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath(`/estimates/${estimateId}/quote`);
  revalidatePath(`/`);
  return { ok: true };
}

/** Minimal stub for future editing of option items before selection (not used in MVP) */
export async function updateOptionItem(optionItemId: string, formData: FormData): Promise<SelectOptionResult> {
  const quantityRaw = formData.get("quantity");
  const unitPriceRaw = formData.get("unitPrice");
  const itemNameRaw = formData.get("itemName");
  const unitRaw = formData.get("unit");

  let quantity: number | null = null;
  let unitPrice: number | null = null;
  if (quantityRaw !== null) {
    const n = parseFloat(String(quantityRaw).replace(",", "."));
    if (Number.isFinite(n)) quantity = n;
  }
  if (unitPriceRaw !== null) {
    const n = parseFloat(String(unitPriceRaw).replace(",", "."));
    if (Number.isFinite(n)) unitPrice = n;
  }
  const itemName = itemNameRaw ? String(itemNameRaw).trim() : undefined;
  const unit = unitRaw ? String(unitRaw).trim() : undefined;

  try {
    const existing = await (prisma as unknown as {
      estimateOptionItem: { findUnique: (a: unknown) => Promise<unknown> };
    }).estimateOptionItem.findUnique({ where: { id: optionItemId } });
    if (!existing) return { ok: false, error: "البند غير موجود" };

    const ex = existing as unknown as {
      id: string;
      optionId: string;
      quantity: unknown;
      unitPrice: unknown;
      lineTotal: unknown;
    };
    const q = quantity !== null && quantity >= 0 ? quantity : Number(ex.quantity);
    const p = unitPrice !== null && unitPrice >= 0 ? unitPrice : Number(ex.unitPrice);

    await (prisma as unknown as {
      estimateOptionItem: { update: (a: unknown) => Promise<unknown> };
    }).estimateOptionItem.update({
      where: { id: optionItemId },
      data: {
        quantity: q,
        unitPrice: p,
        lineTotal: Math.round(q * p * 100) / 100,
        ...(itemName ? { itemName } : {}),
        ...(unit ? { unit } : {}),
      },
    });

    // Need to update parent option total and estimate revalidation
    // Fetch optionId to revalidate
    try {
      const opt = await (prisma as unknown as {
        estimateOption: { findUnique: (a: unknown) => Promise<unknown> };
      }).estimateOption.findUnique({ where: { id: ex.optionId } });
      if (opt) {
        const o = opt as unknown as { estimateId: string };
        revalidatePath(`/estimates/${o.estimateId}`);
      }
    } catch {}
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message?.slice(0, 300) ?? String(e) };
  }
}
