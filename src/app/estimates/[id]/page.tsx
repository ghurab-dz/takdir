import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { SectionHeader } from "@/components/section-header";
import { EstimateEditor } from "@/components/estimate-editor";
import { EstimateRenderCard } from "@/components/estimate-render-card";
import { OptionCompare } from "@/components/option-compare";
import { computeProofHash, isRenderStale } from "@/lib/render-hash";
import { formatAmount } from "@/lib/format";

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

  // Try to load new consultation data: options + tiered renders
  let options: { id: string; tier: string; title: string; total: unknown; proofHash: string | null; items: { id: string; itemName: string; quantity: unknown; unit: string; unitPrice: unknown; lineTotal: unknown; category: string }[] }[] = [];
  let tieredRenders: { id: string; basePhotoPath: string; renderPath: string | null; status: string; error: string | null; model: string | null; tier: string | null; optionId: string | null; renderedAt: Date | null }[] = [];
  let legacyRenders: { id: string; basePhotoPath: string; renderPath: string | null; status: string; error: string | null; model: string | null }[] = [];
  let proofHash: string | null = null;
  try {
    const estAny = estimate as unknown as Record<string, unknown>;
    proofHash = (estAny.proofHash as string | null) ?? null;
    // options via prisma.estimateOption
    const optRows = await (prisma as unknown as { estimateOption: { findMany: (a: unknown) => Promise<never[]> } }).estimateOption.findMany({
      where: { estimateId: id },
      include: { items: true },
      orderBy: { tier: "asc" },
    });
    options = (optRows as unknown as typeof options) ?? [];
  } catch {
    options = [];
  }
  try {
    const r = await (prisma as unknown as { estimateRender: { findMany: (a: unknown) => Promise<never[]> } }).estimateRender.findMany({
      where: { estimateId: id },
      orderBy: { createdAt: "asc" },
    });
    const all = r as unknown as typeof tieredRenders;
    // split tiered vs legacy (tier field)
    tieredRenders = all.filter((x) => (x as unknown as { tier?: string | null }).tier != null);
    legacyRenders = all.filter((x) => (x as unknown as { tier?: string | null }).tier == null) as unknown as typeof legacyRenders;
    // fallback: if no tiered but options exist, treat legacy as tiered for hero compat
    if (tieredRenders.length === 0 && options.length > 0 && legacyRenders.length > 0) {
      tieredRenders = legacyRenders.map((lr, idx) => ({
        ...lr,
        tier: ["economy", "mid", "premium"][idx] ?? null,
        optionId: options[idx]?.id ?? null,
        renderedAt: null,
      })) as unknown as typeof tieredRenders;
    }
    if (legacyRenders.length === 0 && tieredRenders.length > 0) legacyRenders = [];
  } catch {
    tieredRenders = [];
    legacyRenders = [];
  }

  const hasOptions = options.length > 0;
  const estAny2 = estimate as unknown as {
    lengthM?: unknown;
    widthM?: unknown;
    heightM?: unknown;
    style?: string | null;
    styleTags?: string[];
    budgetTier?: string | null;
    budgetDZD?: unknown;
    contractorNotes?: string | null;
    selectedOptionId?: string | null;
    photoPaths: unknown;
  };
  const photoPaths = (estimate.photoPaths as unknown as string[]) ?? [];
  const styleTags = (estAny2.styleTags as string[]) ?? [];
  const budgetTier = estAny2.budgetTier ?? null;
  const budgetDZD = estAny2.budgetDZD != null ? Number(estAny2.budgetDZD) : null;
  const selectedOptionId = (estAny2.selectedOptionId as string | null) ?? null;

  // legacy stale check
  const currentHash = computeProofHash(
    estimate.items.map((it) => {
      const p = pricelist.find((x) => x.id === (it as unknown as { priceItemId: string | null }).priceItemId);
      return { itemName: it.itemName, category: p?.category ?? "عام" };
    }),
    estimate.roomType ?? null,
  );
  const legacyStale = isRenderStale(currentHash, proofHash) && legacyRenders.some((x) => x.status === "done");

  // per-tier stale for new consultation
  const isStalePerTier: Record<string, boolean> = {};
  if (hasOptions) {
    for (const opt of options) {
      const hash = computeProofHash(
        opt.items.map((it) => ({ itemName: it.itemName, category: it.category ?? "عام" })),
        estimate.roomType ?? null,
        opt.tier as unknown as "economy" | "mid" | "premium",
      );
      const stored = opt.proofHash ?? null;
      isStalePerTier[opt.tier] = isRenderStale(hash, stored) && tieredRenders.some((r) => r.tier === opt.tier && r.status === "done");
    }
  }

  const totalFinal = estimate.items.reduce((s, i) => s + Number(i.lineTotal), 0);

  return (
    <div>
      {hasOptions ? (
        <>
          <SectionHeader
            eyebrow={options.length === 1 ? "تصميمك جاهز" : "استشارة — خيارات"}
            title={options.length === 1 ? `${estimate.clientName || estimate.roomType || "غرفة"} — تصميم وسعر` : `${estimate.clientName || estimate.roomType || "غرفة"} — اختر المستوى`}
            hint={options.length === 1 ? "تصميم واحد واقعي + سعره من كتالوجك — راجع الصورة والجدول، اعتمد واطبع." : "اعرض الخيارات على الزبون — كل خيار بصورته النهائية وسعره من كتالوجك فقط. اعتمد خيارًا ثم راجع واطبع."}
          />

          {/* consultation summary */}
          <div className="card p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
              <span className="text-xs font-extrabold tracking-wide text-ink-soft">ملخص الاستشارة</span>
              <span className="chip bg-teal-soft text-teal border-teal/10">{photoPaths.length} صور</span>
              {budgetTier && <span className="chip chip-ink">{budgetTier === "economy" ? "اقتصادي" : budgetTier === "mid" ? "متوازن" : "ممتاز"}</span>}
              {estimate.roomType && <span className="chip bg-white border-line text-ink-soft">{estimate.roomType}</span>}
            </div>
            {photoPaths.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                {photoPaths.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="صورة الغرفة" className="h-20 w-20 shrink-0 snap-start rounded-xl border border-line object-cover shadow-sm" />
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="rounded-xl border border-line-soft bg-paper/60 px-3 py-2">
                <div className="font-bold text-ink-soft">الأبعاد</div>
                <div className="mt-1 font-extrabold text-ink">
                  {estAny2.lengthM != null && estAny2.widthM != null ? (
                    <>
                      <span dir="ltr" className="tnum">
                        {Number(estAny2.lengthM)} × {Number(estAny2.widthM)}
                      </span>{" "}
                      م{estAny2.heightM != null ? ` × ${Number(estAny2.heightM)}م` : ""} {estimate.areaM2 != null ? `— ${formatAmount(Number(estimate.areaM2))} م²` : ""}
                    </>
                  ) : estimate.areaM2 != null ? (
                    <span>
                      {formatAmount(Number(estimate.areaM2))} م²
                    </span>
                  ) : (
                    <span className="text-ink-faint">سيُقدَّر تلقائياً</span>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-line-soft bg-paper/60 px-3 py-2">
                <div className="font-bold text-ink-soft">النمط</div>
                <div className="mt-1 font-extrabold text-ink">{styleTags.length > 0 ? styleTags.join("، ") : estAny2.style ?? "—"}</div>
              </div>
              <div className="rounded-xl border border-line-soft bg-paper/60 px-3 py-2">
                <div className="font-bold text-ink-soft">الميزانية</div>
                <div className="mt-1 font-extrabold text-ink">
                  {budgetTier ? (budgetTier === "economy" ? "اقتصادي" : budgetTier === "mid" ? "متوازن" : "ممتاز") : "—"}
                  {budgetDZD != null ? <span className="font-medium text-ink-soft"> — {formatAmount(budgetDZD)} دج</span> : null}
                </div>
              </div>
              <div className="rounded-xl border border-line-soft bg-paper/60 px-3 py-2">
                <div className="font-bold text-ink-soft">الزبون</div>
                <div className="mt-1 font-extrabold text-ink truncate">{estimate.clientName || "—"}</div>
              </div>
            </div>
            {estAny2.contractorNotes && (
              <div className="rounded-xl border border-teal/20 bg-teal-50 px-3 py-2 text-xs leading-relaxed text-ink">
                <span className="font-bold text-teal">ملاحظاتك: </span>
                {String(estAny2.contractorNotes)}
              </div>
            )}
            {estimate.aiNotes && (
              <div className="rounded-xl border border-line-soft bg-paper-100 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                <span className="font-bold text-ink">ملاحظات الذكاء: </span>
                {estimate.aiNotes}
              </div>
            )}
          </div>

          <div className="mt-5" />
          <OptionCompare
            estimateId={estimate.id}
            options={options.map((o) => ({
              id: o.id,
              tier: o.tier,
              title: o.title,
              total: Number(o.total),
              proofHash: o.proofHash,
              items: o.items.map((it) => ({
                itemName: it.itemName,
                quantity: Number(it.quantity),
                unit: it.unit,
                unitPrice: Number(it.unitPrice),
                lineTotal: Number(it.lineTotal),
                category: it.category,
              })),
            }))}
            renders={tieredRenders.map((r) => ({
              id: r.id,
              tier: r.tier,
              basePhotoPath: r.basePhotoPath,
              renderPath: r.renderPath,
              status: r.status,
              model: r.model,
              error: r.error,
              renderedAt: r.renderedAt ? (r.renderedAt as unknown as string) : null,
            }))}
            selectedOptionId={selectedOptionId}
            isStalePerTier={isStalePerTier}
          />

          <div className="mt-6 rounded-xl border border-line bg-card px-4 py-3 text-center">
            <div className="text-xs font-bold text-ink-faint">
              بعد اعتماد خيار، سيُنسخ إلى الجدول النهائي بالأسفل لتعديله وطباعته. الإجمالي النهائي الحالي:{" "}
              <span dir="ltr" className="tnum font-extrabold text-teal">
                {formatAmount(totalFinal)}
              </span>{" "}
              دج
            </div>
            {selectedOptionId && (
              <Link href={`/estimates/${estimate.id}/quote`} className="btn btn-primary btn-sm mt-3">
                فتح عرض السعر المختار للطباعة ←
              </Link>
            )}
          </div>

          <div className="mt-6" />
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
            <span className="text-xs font-extrabold tracking-wide text-ink-soft">الجدول النهائي — قابل للتعديل بعد الاختيار</span>
          </div>
          <div className="mt-3" />
        </>
      ) : (
        <>
          <SectionHeader
            eyebrow="شاشة المراجعة"
            title="راجع البنود قبل الاعتماد"
            hint="الذكاء الاصطناعي قد يخطئ — عدّل الكميات والأسعار، احذف أو أضف بنودًا، ثم اعتمد العرض. (استشارة قديمة بدون 3 خيارات — سيتم التحديث في الاستشارات الجديدة)"
          />
          <EstimateRenderCard
            estimateId={estimate.id}
            status={estimate.status}
            photoPaths={photoPaths}
            renders={legacyRenders}
            isStale={legacyStale}
            photoCount={photoPaths.length}
          />
          <div className="mt-5" />
        </>
      )}

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
