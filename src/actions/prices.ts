"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toNumber(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function updateContractorProfile(formData: FormData): Promise<ActionResult> {
  const contractor = await ensureDefaultContractor();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { ok: false, error: "الاسم مطلوب" };
  await prisma.contractor.update({
    where: { id: contractor.id },
    data: { name, phone: phone || null },
  });
  revalidatePath("/prices");
  revalidatePath("/");
  return { ok: true };
}

export async function addPriceItem(formData: FormData): Promise<ActionResult> {
  const contractor = await ensureDefaultContractor();
  const category = String(formData.get("category") ?? "").trim() || "عام";
  const itemName = String(formData.get("itemName") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || "وحدة";
  const unitPrice = toNumber(formData.get("unitPrice"));

  if (!itemName) return { ok: false, error: "اسم البند مطلوب" };
  if (unitPrice === null || unitPrice < 0) return { ok: false, error: "سعر غير صالح" };

  await prisma.priceItem.create({
    data: { contractorId: contractor.id, category, itemName, unit, unitPrice },
  });
  revalidatePath("/prices");
  return { ok: true };
}

export async function updatePriceItem(id: string, formData: FormData): Promise<ActionResult> {
  const category = String(formData.get("category") ?? "").trim();
  const itemName = String(formData.get("itemName") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const unitPrice = toNumber(formData.get("unitPrice"));

  if (!itemName) return { ok: false, error: "اسم البند مطلوب" };
  if (unitPrice === null || unitPrice < 0) return { ok: false, error: "سعر غير صالح" };

  await prisma.priceItem.update({
    where: { id },
    data: {
      ...(category ? { category } : {}),
      itemName,
      unit: unit || "وحدة",
      unitPrice,
    },
  });
  revalidatePath("/prices");
  return { ok: true };
}

export async function togglePriceItem(id: string): Promise<ActionResult> {
  const item = await prisma.priceItem.findUnique({ where: { id } });
  if (!item) return { ok: false, error: "البند غير موجود" };
  await prisma.priceItem.update({
    where: { id },
    data: { isActive: !item.isActive },
  });
  revalidatePath("/prices");
  return { ok: true };
}

export async function deletePriceItem(id: string): Promise<ActionResult> {
  await prisma.priceItem.delete({ where: { id } });
  revalidatePath("/prices");
  return { ok: true };
}
