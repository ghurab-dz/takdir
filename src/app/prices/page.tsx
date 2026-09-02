import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { SectionHeader } from "@/components/section-header";
import { PriceListEditor } from "@/components/price-list-editor";
import { CatalogTemplates } from "@/components/catalog-templates";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  const contractor = await ensureDefaultContractor();
  const items = await prisma.priceItem.findMany({
    where: { contractorId: contractor.id },
    orderBy: [{ category: "asc" }, { itemName: "asc" }],
  });

  const activeCount = items.filter((i) => i.isActive).length;

  return (
    <div>
      <SectionHeader
        eyebrow="أساس كل تقدير"
        title="قائمة أسعارك"
        hint="58 بند جاهز بأسعار سوق الجزائر — كل تصميم سعره من هذه القائمة فقط. اختر قالبًا يناسبك ثم عدّل الأسعار."
      />
      <div className="mt-4">
        <CatalogTemplates activeCount={activeCount} totalCount={items.length} />
      </div>
      <div className="mt-5">
        <PriceListEditor
          contractor={{ name: contractor.name, phone: contractor.phone ?? "" }}
          items={items.map((i) => ({
            id: i.id,
            category: i.category,
            itemName: i.itemName,
            unit: i.unit,
            unitPrice: Number(i.unitPrice),
            isActive: i.isActive,
          }))}
        />
      </div>
    </div>
  );
}
