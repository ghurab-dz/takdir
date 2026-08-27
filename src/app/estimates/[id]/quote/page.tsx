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
  const whatsappUrl = buildWhatsAppLink(whatsappText, null);

  return (
    <div>
      <QuoteActions estimateId={estimate.id} whatsappUrl={whatsappUrl} whatsappText={whatsappText} />

      {/* preview wrapper — horizontal scroll hint on mobile */}
      <div className="mx-auto max-w-2xl">
        <div className="mb-3 hidden items-center justify-center gap-2 text-xs font-bold text-ink-faint sm:flex">
          <span className="h-px w-8 bg-line" aria-hidden />
          معاينة عرض السعر — جاهز للطباعة
          <span className="h-px w-8 bg-line" aria-hidden />
        </div>

        <div
          className="card print-sheet overflow-hidden p-0 sm:p-0"
          style={{ boxShadow: "var(--shadow-sheet)" }}
        >
          {/* subtle paper texture header band */}
          <div className="h-1.5 w-full bg-teal" aria-hidden />
          <div className="p-5 sm:p-8">
            {/* header */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-ink pb-5">
              <div className="min-w-0">
                <div className="font-display text-xl font-extrabold leading-tight text-ink sm:text-2xl">{contractor.name}</div>
                {contractor.phone && <div className="tnum mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-paper-100 px-2.5 py-1 text-xs font-bold text-ink-soft border border-line">هاتف: {contractor.phone}</div>}
                <div className="mt-2 hidden text-xs font-medium leading-relaxed text-ink-faint sm:block">
                  تشطيبات عامة — دهان • بلاط • كهرباء
                </div>
              </div>
              <div className="shrink-0 text-left">
                <div className="font-brand text-3xl leading-none text-teal sm:text-4xl">عرض سعر</div>
                <div className="tnum mt-2 inline-flex items-center rounded-full bg-teal-soft px-2.5 py-1 text-xs font-bold text-teal border border-teal/10">{date}</div>
                <div className="mt-1.5 text-left text-[11px] font-bold tracking-wide text-ink-faint">#{estimate.id.slice(0, 8).toUpperCase()}</div>
              </div>
            </div>

            {/* parties */}
            <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-line bg-paper/60 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 text-sm">
              <div className="flex items-baseline gap-2">
                <span className="shrink-0 text-xs font-extrabold tracking-wide text-ink-soft">الزبون</span>
                <span className="min-w-0 flex-1 truncate font-extrabold text-ink">{estimate.clientName || "—"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="shrink-0 text-xs font-extrabold tracking-wide text-ink-soft">المكان</span>
                <span className="min-w-0 flex-1 truncate font-bold text-ink">
                  {estimate.roomType || "—"}
                  {estimate.areaM2 ? <span className="font-medium text-ink-soft"> — {formatQty(Number(estimate.areaM2))} م²</span> : null}
                </span>
              </div>
            </div>

            {/* items — table on desktop, stacked on mobile handled via responsive table */}
            <div className="mt-6 overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
              <table className="ledger min-w-[520px] sm:min-w-0">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th className="w-full">البيان</th>
                    <th className="text-center">الكمية</th>
                    <th className="text-center">الوحدة</th>
                    <th className="whitespace-nowrap text-center">سعر الوحدة</th>
                    <th className="whitespace-nowrap text-center">المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className={i % 2 === 1 ? "bg-paper/40" : ""}>
                      <td className="tnum text-center text-xs font-bold text-ink-faint">{i + 1}</td>
                      <td className="font-bold text-sm text-ink">{l.itemName}</td>
                      <td className="tnum whitespace-nowrap text-center text-sm font-bold">{formatQty(l.quantity)}</td>
                      <td className="text-center text-sm">{l.unit}</td>
                      <td className="whitespace-nowrap text-center text-sm">
                        <span dir="ltr" className="tnum">
                          {formatAmount(l.unitPrice)}
                        </span>{" "}
                        <span className="text-xs">دج</span>
                      </td>
                      <td className="whitespace-nowrap text-center text-sm font-extrabold text-ink">
                        <span dir="ltr" className="tnum">
                          {formatAmount(l.lineTotal)}
                        </span>{" "}
                        <span className="text-xs font-bold">دج</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* total — premium band */}
            <div className="mt-6 rounded-xl border border-ochre/20 bg-ochre-soft/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-display text-base font-extrabold text-ink sm:text-lg">المجموع الكلي</div>
                  <div className="mt-0.5 text-xs font-medium text-ink-soft">{lines.length} بند • صالح 15 يومًا</div>
                </div>
                <div className="text-left">
                  <div className="whitespace-nowrap font-display text-2xl font-extrabold leading-none text-ochre sm:text-3xl">
                    <span dir="ltr" className="tnum">
                      {formatAmount(total)}
                    </span>{" "}
                    <span className="text-base sm:text-lg">دج</span>
                  </div>
                  <div className="mt-1 text-left text-[11px] font-bold tracking-wide text-ochre/70">شامل اليد العاملة فقط</div>
                </div>
              </div>
            </div>

            <div className="ruler mt-6 opacity-25" />
            <p className="mx-auto mt-4 max-w-md text-center text-xs leading-relaxed text-ink-soft">
              هذا العرض صالح لمدة 15 يومًا من تاريخه. الأسعار محسوبة من قائمة أسعار المقاول حصرًا.
              <br />
              <span className="font-bold text-ink-faint">شكرًا لثقتكم — تقدير</span>
            </p>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-ink-faint sm:hidden">اسحب يمين/يسار لعرض الجدول كاملًا</p>
      </div>
    </div>
  );
}
