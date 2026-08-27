import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { formatAmount, formatQty, formatDate } from "@/lib/format";
import { buildQuoteText, buildWhatsAppLink } from "@/lib/whatsapp";
import { QuoteActions } from "@/components/quote-actions";

export const dynamic = "force-dynamic";

export default async function QuotePage({
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

  const lines = estimate.items.map((i) => ({
    itemName: i.itemName,
    quantity: Number(i.quantity),
    unit: i.unit,
    unitPrice: Number(i.unitPrice),
    lineTotal: Number(i.lineTotal),
  }));
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const date = formatDate(estimate.createdAt);

  const whatsappText = buildQuoteText({
    contractorName: contractor.name,
    contractorPhone: contractor.phone,
    clientName: estimate.clientName,
    roomType: estimate.roomType,
    date,
    lines,
    total,
  });
  // Share into the contractor's own WhatsApp picker (client chosen at send time)
  const whatsappUrl = buildWhatsAppLink(whatsappText, null);

  return (
    <div>
      <QuoteActions estimateId={estimate.id} whatsappUrl={whatsappUrl} whatsappText={whatsappText} />

      <div className="card print-sheet mx-auto max-w-2xl p-6 sm:p-8">
        {/* header */}
        <div className="flex items-start justify-between border-b-2 border-ink pb-4">
          <div>
            <div className="font-display text-2xl font-extrabold text-ink">
              {contractor.name}
            </div>
            {contractor.phone && (
              <div className="tnum mt-1 text-sm text-ink-soft">هاتف: {contractor.phone}</div>
            )}
          </div>
          <div className="text-left">
            <div className="font-brand text-3xl text-teal">عرض سعر</div>
            <div className="tnum mt-1 text-xs text-ink-soft">{date}</div>
          </div>
        </div>

        {/* parties */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-bold text-ink-soft">الزبون: </span>
            <span className="font-bold">{estimate.clientName || "—"}</span>
          </div>
          <div>
            <span className="font-bold text-ink-soft">المكان: </span>
            <span className="font-bold">
              {estimate.roomType || "—"}
              {estimate.areaM2 ? ` (${formatQty(Number(estimate.areaM2))} م²)` : ""}
            </span>
          </div>
        </div>

        {/* items */}
        <table className="ledger mt-6">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="w-full">البيان</th>
              <th>الكمية</th>
              <th>الوحدة</th>
              <th>سعر الوحدة</th>
              <th>المجموع</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="tnum text-ink-soft">{i + 1}</td>
                <td className="font-bold">{l.itemName}</td>
                <td className="tnum whitespace-nowrap">{formatQty(l.quantity)}</td>
                <td>{l.unit}</td>
                <td className="whitespace-nowrap">
                  <span dir="ltr" className="tnum">
                    {formatAmount(l.unitPrice)}
                  </span>{" "}
                  دج
                </td>
                <td className="whitespace-nowrap font-bold">
                  <span dir="ltr" className="tnum">
                    {formatAmount(l.lineTotal)}
                  </span>{" "}
                  دج
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* total */}
        <div className="ruler mt-6" />
        <div className="mt-3 flex items-center justify-between gap-4">
          <span className="font-display text-lg font-extrabold">المجموع الكلي</span>
          <span className="whitespace-nowrap font-display text-2xl font-extrabold text-ochre">
            <span dir="ltr" className="tnum">
              {formatAmount(total)}
            </span>{" "}
            دج
          </span>
        </div>
        <div className="ruler mt-3" />

        <p className="mt-6 text-center text-xs text-ink-soft">
          هذا العرض صالح لمدة 15 يومًا من تاريخه. شكرًا لثقتكم.
        </p>
      </div>
    </div>
  );
}
