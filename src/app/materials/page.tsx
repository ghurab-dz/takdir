import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { SectionHeader } from "@/components/section-header";
import { MaterialCatalogEditor } from "@/components/material-catalog-editor";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const contractor = await ensureDefaultContractor();
  let materials: { id: string; category: string; itemName: string; grade: string; unit: string; unitPrice: unknown; visualHint: string | null; isActive: boolean }[] = [];
  try {
    materials = (await (prisma as unknown as { material: { findMany: (a: unknown) => Promise<typeof materials> } }).material.findMany({
      where: { contractorId: contractor.id },
      orderBy: [{ category: "asc" }, { itemName: "asc" }],
    })) as typeof materials;
  } catch {
    materials = [];
  }

  return (
    <div>
      <SectionHeader
        eyebrow="كتالوج الخامات"
        title="موادك بكل مستوى"
        hint="لكل خامة 3 مستويات (اقتصادي / متوازن / ممتاز) بأسعار مختلفة. الذكاء يولّد 3 عروض بنفس الكميات لكن بخامات وأسعار المستوى المختار — لا يخترع سعرًا أبدًا."
      />
      <MaterialCatalogEditor
        contractor={{ name: contractor.name, phone: contractor.phone ?? "" }}
        materials={materials.map((m) => ({
          id: m.id,
          category: m.category,
          itemName: m.itemName,
          grade: String(m.grade),
          unit: m.unit,
          unitPrice: Number(m.unitPrice),
          visualHint: m.visualHint ?? null,
          isActive: m.isActive,
        }))}
      />
    </div>
  );
}
