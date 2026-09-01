"use client";

import { BeforeAfterSlider } from "./before-after-slider";

export interface OptionRenderRow {
  id: string;
  tier: string | null;
  basePhotoPath: string;
  renderPath: string | null;
  status: string;
  model?: string | null;
  error?: string | null;
  renderedAt?: string | null;
}

export function OptionRenderCard({
  tier,
  basePhotoPath,
  render,
  onRegenerate,
  pending = false,
}: {
  tier: string;
  basePhotoPath: string;
  render?: OptionRenderRow | null;
  onRegenerate?: () => void;
  pending?: boolean;
}) {
  const r = render ?? null;
  const isPending = pending || r?.status === "pending";
  const isDone = r?.status === "done" && !!r?.renderPath;
  const isFailed = r?.status === "failed";
  const isFallback = r?.model?.includes("mock-fallback");

  if (!r && !pending) {
    return (
      <div className="overflow-hidden rounded-xl border border-dashed border-line bg-paper-100 p-6 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white border border-line text-ink-faint">◈</div>
        <div className="mt-2 text-sm font-bold text-ink-soft">لم يتم توليد المعاينة بعد</div>
        <p className="mt-1 text-xs leading-relaxed text-ink-faint">سيتم توليد معاينة {tier} بعد إنشاء الخيارات</p>
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} className="btn btn-primary btn-sm mt-3">
            توليد المعاينة
          </button>
        )}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="ba-slider grid place-items-center bg-paper-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={basePhotoPath} alt="قبل" className="opacity-40" />
        <div className="absolute inset-0 grid place-items-center bg-white/55 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm border border-line">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-teal/30 border-t-teal" aria-hidden />
            <span className="text-xs font-extrabold text-teal">يُنشئ معاينة {tier}…</span>
          </div>
        </div>
      </div>
    );
  }

  if (isDone && r?.renderPath) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-line">
        <BeforeAfterSlider beforeSrc={r.basePhotoPath} afterSrc={r.renderPath} />
        {isFallback && <span className="absolute bottom-2 left-2 rounded-full bg-ochre px-2 py-1 text-[10px] font-extrabold text-white shadow">احتياطي</span>}
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="rounded-xl border border-danger/25 bg-danger-soft p-4 text-center">
        <div className="text-sm font-extrabold text-danger">فشل توليد {tier}</div>
        <div className="mt-1 text-xs leading-relaxed text-ink-soft line-clamp-3">{r?.error ?? "تعذّر التوليد"}</div>
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} className="btn btn-ghost btn-sm mt-3 gap-1 text-xs">
            إعادة المحاولة
          </button>
        )}
      </div>
    );
  }

  // fallback skeleton
  return (
    <div className="ba-slider skeleton" aria-hidden>
      <div className="absolute inset-0 grid place-items-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
      </div>
    </div>
  );
}
