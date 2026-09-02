"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ensureDefaultContractor, applyTemplateToContractor } from "@/lib/seed";
import { getTemplateById } from "@/lib/catalog-templates";

export async function applyCatalogTemplate(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "").trim();
  const tpl = getTemplateById(templateId);
  if (!tpl) return { ok: false as const, error: "قالب غير موجود" };
  const contractor = await ensureDefaultContractor();
  await applyTemplateToContractor(contractor.id, tpl.priceItemNames);
  revalidatePath("/prices");
  revalidatePath("/materials");
  revalidatePath("/");
  return { ok: true as const };
}

export async function restoreFullCatalog() {
  const contractor = await ensureDefaultContractor();
  const { DEFAULT_PRICE_ITEMS } = await import("@/lib/seed");
  const allNames = DEFAULT_PRICE_ITEMS.map((i) => i.itemName);
  await applyTemplateToContractor(contractor.id, allNames);
  // reactivate all (applyTemplate does it) + ensure isActive true for all
  await prisma.priceItem.updateMany({ where: { contractorId: contractor.id }, data: { isActive: true } });
  try {
    await (prisma as unknown as { material: { updateMany: (a: unknown) => Promise<unknown> } }).material.updateMany({
      where: { contractorId: contractor.id },
      data: { isActive: true },
    });
  } catch {}
  revalidatePath("/prices");
  revalidatePath("/materials");
  return { ok: true as const };
}
