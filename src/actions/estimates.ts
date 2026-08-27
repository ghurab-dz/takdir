"use server";

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { getAiProvider } from "@/lib/ai";
import type { PhotoInput } from "@/lib/ai/types";
import { matchExtractedItems } from "@/lib/matching";

export type CreateEstimateState = { error?: string };

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB each
const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/**
 * The core flow (PRD §5):
 * photos + description → AI extraction → match against the contractor's own
 * price list → persist a draft estimate → redirect to the review screen.
 */
export async function createEstimate(
  _prev: CreateEstimateState,
  formData: FormData,
): Promise<CreateEstimateState> {
  const description = String(formData.get("description") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim() || null;

  const files = formData
    .getAll("photos")
    .filter((f): f is File => typeof f === "object" && "arrayBuffer" in f && f.size > 0);

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

  // Persist photos so the review screen can show them back
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
  const pricelist = await prisma.priceItem.findMany({
    where: { contractorId: contractor.id, isActive: true },
  });
  if (pricelist.length === 0) {
    return { error: "قائمة أسعارك فارغة — أضف بندًا واحدًا على الأقل من صفحة «قائمة الأسعار»" };
  }

  const provider = getAiProvider();
  let extraction;
  try {
    extraction = await provider.extract({
      description,
      photos: photoInputs,
      allowedItems: pricelist.map((p) => ({
        itemName: p.itemName,
        unit: p.unit,
        category: p.category,
      })),
    });
  } catch (e) {
    console.error("AI extraction failed:", e);
    return {
      error:
        "تعذّر تحليل الصور الآن. تحقق من مفتاح GEMINI_API_KEY أو أعد المحاولة بعد قليل.",
    };
  }

  const lines = matchExtractedItems(
    extraction.items,
    pricelist.map((p) => ({
      id: p.id,
      itemName: p.itemName,
      unit: p.unit,
      unitPrice: Number(p.unitPrice),
    })),
  );

  await prisma.estimate.create({
    data: {
      id: estimateId,
      contractorId: contractor.id,
      clientName,
      roomType: extraction.roomType,
      areaM2: extraction.areaM2,
      rawDescription: description,
      photoPaths,
      aiNotes: extraction.notes,
      items: {
        create: lines.map((l) => ({
          priceItemId: l.priceItemId,
          itemName: l.itemName,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          matched: l.matched,
          source: "ai_extracted" as const,
        })),
      },
    },
  });

  revalidatePath("/");
  redirect(`/estimates/${estimateId}`);
}

// ---------- review-screen edits ----------

function num(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

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
  await prisma.estimate.update({
    where: { id: estimateId },
    data: { clientName, roomType, areaM2 },
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
