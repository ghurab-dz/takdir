import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { SectionHeader } from "@/components/section-header";
import { EstimateEditor } from "@/components/estimate-editor";

export const dynamic = "force-dynamic";

export default async function EstimateReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contractor = await ensureDefaultContractor();
  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: { items: { orderBy: { itemName: "asc" } } },
  });
  if (!estimate || estimate.contractorId !== contractor.id) notFound();

  const pricelist = await prisma.priceItem.findMany({
    where: { contractorId: contractor.id, isActive: true },
    orderBy: [{ category: "asc" }, { itemName: "asc" }],
  });

  return (
    <div>
      <SectionHeader
        eyebrow="شاشة المراجعة"
        title="راجع البنود قبل الاعتماد"
        hint="الذكاء الاصطناعي قد يخطئ — عدّل الكميات والأسعار، احذف أو أضف بنودًا، ثم اعتمد العرض."
      />
      <EstimateEditor
        key={estimate.items
          .map((i) => `${i.id}:${i.quantity}:${i.unitPrice}:${i.itemName}:${i.unit}:${i.matched}`)
          .join("|")}
        estimate={{
          id: estimate.id,
          clientName: estimate.clientName ?? "",
          roomType: estimate.roomType ?? "",
          areaM2: estimate.areaM2 ? Number(estimate.areaM2) : null,
          status: estimate.status,
          aiNotes: estimate.aiNotes,
          photoPaths: estimate.photoPaths,
          createdAt: estimate.createdAt.toISOString(),
          items: estimate.items.map((i) => ({
            id: i.id,
            itemName: i.itemName,
            quantity: Number(i.quantity),
            unit: i.unit,
            unitPrice: Number(i.unitPrice),
            lineTotal: Number(i.lineTotal),
            matched: i.matched,
            source: i.source,
          })),
        }}
        pricelist={pricelist.map((p) => ({
          id: p.id,
          itemName: p.itemName,
          unit: p.unit,
          unitPrice: Number(p.unitPrice),
          category: p.category,
        }))}
      />
    </div>
  );
}
