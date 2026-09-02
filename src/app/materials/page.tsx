import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { SectionHeader } from "@/components/section-header";
import { MaterialCatalogEditor } from "@/components/material-catalog-editor";
import { CatalogTemplates } from "@/components/catalog-templates";

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

  const activeMats = materials.filter((m) => m.isActive).length;
  // derive active price count approximation: materials /3
  const activePriceApprox = Math.round(activeMats / 3);

  return (
    <div>
      <SectionHeader
        eyebrow="كتالوج الخامات"
        title="موادك — تُستخدم للتسعير التلقائي"
        hint="58 بند × 3 مستويات = 174 خامة جاهزة — الذكاء يختار من كتالوجك فقط. عدّل الأسعار لاحقًا، غير مطلوب قبل أول تصميم."
      />
      <div className="mt-4">
        <CatalogTemplates activeCount={activePriceApprox} totalCount={Math.round(materials.length / 3) || 58} />
      </div>
      <div className="mt-5">
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
    </div>
  );
}
