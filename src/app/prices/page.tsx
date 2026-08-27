import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { SectionHeader } from "@/components/section-header";
import { PriceListEditor } from "@/components/price-list-editor";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  const contractor = await ensureDefaultContractor();
  const items = await prisma.priceItem.findMany({
    where: { contractorId: contractor.id },
    orderBy: [{ category: "asc" }, { itemName: "asc" }],
  });

  return (
    <div>
      <SectionHeader
        eyebrow="أساس كل تقدير"
        title="قائمة أسعارك"
        hint="التطبيق لا يخترع أسعارًا أبدًا — كل تقدير يُحسب من هذه القائمة حصرًا. عدّلها لتطابق أسعارك الحقيقية."
      />
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
  );
}
