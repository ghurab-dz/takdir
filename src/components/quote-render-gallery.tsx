import { BeforeAfterSlider } from "./before-after-slider";

export interface QuoteRenderRow {
  basePhotoPath: string;
  renderPath: string | null;
  status: string;
  model?: string | null;
}

export function QuoteRenderGallery({
  renders,
  proofHash,
  renderedAt,
}: {
  renders: QuoteRenderRow[];
  proofHash: string | null;
  renderedAt: string | null;
}) {
  const done = renders.filter((r) => r.status === "done" && r.renderPath);
  const hasFallback = done.some((r) => r.model?.includes("mock-fallback"));
  if (done.length === 0) {
    // No renders — don't show empty hero (keep print sheet tight)
    // But if there are pending/failed, show info (no-print not needed)
    if (renders.length === 0) return null;
    return (
      <div className="no-print rounded-xl border border-ochre/20 bg-ochre-soft px-4 py-3 text-xs font-bold text-ochre-deep">
        المعاينة قيد الإنشاء أو فشلت — راجع صفحة المراجعة لإعادة التوليد.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      {hasFallback && (
        <div className="border-b border-ochre/20 bg-ochre-soft px-3 py-2 text-center text-xs font-bold leading-relaxed text-ochre-deep">
          تنبيه: عُرضت الصورة الأصلية كمعاينة مؤقتة — الحصة المجانية لـ OpenRouter انتهت. أعد التوليد لاحقًا للحصول على معاينة مولدة مطابقة للبنود.
        </div>
      )}
      {/* hero slider for first angle */}
      <BeforeAfterSlider beforeSrc={done[0].basePhotoPath} afterSrc={done[0].renderPath!} />

      {/* additional angles */}
      {done.length > 1 && (
        <div className={`render-grid p-2 ${done.length === 2 ? "cols-2" : done.length >= 3 ? "cols-3" : ""}`}>
          {done.slice(1).map((r) => (
            <BeforeAfterSlider key={r.basePhotoPath} beforeSrc={r.basePhotoPath} afterSrc={r.renderPath!} />
          ))}
        </div>
      )}

      {/* proof strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-paper px-3 py-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-bold text-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
          دليل بصري — مقفل على بنود العرض أعلاه فقط
        </span>
        <span className="inline-flex items-center gap-2 font-medium text-ink-faint">
          {renderedAt && <span className="chip bg-white border-line text-ink-soft">تم التوليد {renderedAt.slice(0, 16).replace("T", " ")}</span>}
          {proofHash && <span className="tnum chip bg-white border-line text-ink-faint">#{proofHash.slice(0, 8).toUpperCase()}</span>}
        </span>
      </div>
      <p className="border-t border-line-soft bg-paper/60 px-3 py-2 text-center text-[11px] leading-relaxed text-ink-soft">
        صور توضيحية مولدة بالذكاء الاصطناعي — تُظهر فقط الأعمال المسعّرة في الجدول. ليست مطابقة 100% للألوان/الخامة على الطبيعة.
      </p>
    </div>
  );
}
