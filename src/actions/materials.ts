"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";

export type ActionResult = { ok: true } | { ok: false; error: string };

const VALID_GRADES = new Set<string>(["economy", "mid", "premium"]);

function toNumber(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function addMaterial(formData: FormData): Promise<ActionResult> {
  const contractor = await ensureDefaultContractor();
  const category = String(formData.get("category") ?? "").trim() || "عام";
  const itemName = String(formData.get("itemName") ?? "").trim();
  const gradeRaw = String(formData.get("grade") ?? "").trim().toLowerCase();
  const grade = gradeRaw ? gradeRaw : "mid";
  const unit = String(formData.get("unit") ?? "").trim() || "وحدة";
  const unitPrice = toNumber(formData.get("unitPrice"));
  const visualHintRaw = String(formData.get("visualHint") ?? "").trim();
  const visualHint = visualHintRaw || null;

  if (!itemName) return { ok: false, error: "اسم البند مطلوب" };
  if (!VALID_GRADES.has(grade)) return { ok: false, error: "المستوى غير صالح (economy | mid | premium)" };
  if (unitPrice === null || unitPrice < 0) return { ok: false, error: "سعر غير صالح" };

  await (prisma as unknown as { material: { create: (a: unknown) => Promise<unknown> } }).material.create({
    data: { contractorId: contractor.id, category, itemName, grade, unit, unitPrice, visualHint, isActive: true },
  });
  revalidatePath("/materials");
  revalidatePath("/prices");
  return { ok: true };
}

export async function updateMaterial(id: string, formData: FormData): Promise<ActionResult> {
  const category = String(formData.get("category") ?? "").trim();
  const itemName = String(formData.get("itemName") ?? "").trim();
  const gradeRaw = String(formData.get("grade") ?? "").trim().toLowerCase();
  const unit = String(formData.get("unit") ?? "").trim();
  const unitPrice = toNumber(formData.get("unitPrice"));
  const visualHintRaw = formData.get("visualHint");
  const visualHint = visualHintRaw !== null ? String(visualHintRaw).trim() || null : undefined;

  if (!itemName) return { ok: false, error: "اسم البند مطلوب" };
  if (gradeRaw && !VALID_GRADES.has(gradeRaw)) return { ok: false, error: "المستوى غير صالح" };
  if (unitPrice === null || unitPrice < 0) return { ok: false, error: "سعر غير صالح" };

  await (prisma as unknown as { material: { update: (a: unknown) => Promise<unknown> } }).material.update({
    where: { id },
    data: {
      ...(category ? { category } : {}),
      itemName,
      ...(gradeRaw ? { grade: gradeRaw } : {}),
      unit: unit || "وحدة",
      unitPrice,
      ...(visualHint !== undefined ? { visualHint } : {}),
    },
  });
  revalidatePath("/materials");
  revalidatePath("/prices");
  return { ok: true };
}

export async function toggleMaterial(id: string): Promise<ActionResult> {
  const item = await (prisma as unknown as { material: { findUnique: (a: unknown) => Promise<{ isActive: boolean } | null> } }).material.findUnique({
    where: { id },
  });
  if (!item) return { ok: false, error: "البند غير موجود" };
  await (prisma as unknown as { material: { update: (a: unknown) => Promise<unknown> } }).material.update({
    where: { id },
    data: { isActive: !item.isActive },
  });
  revalidatePath("/materials");
  revalidatePath("/prices");
  return { ok: true };
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  await (prisma as unknown as { material: { delete: (a: unknown) => Promise<unknown> } }).material.delete({ where: { id } });
  revalidatePath("/materials");
  revalidatePath("/prices");
  return { ok: true };
}
