"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectOption } from "@/actions/options";
import { generateOptionRenders } from "@/actions/renders";
import { formatAmount, formatQty } from "@/lib/format";
import { useToast } from "./ui";
import { BeforeAfterSlider } from "./before-after-slider";

export interface OptionItemLite {
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  category: string;
}

export interface EstimateOptionLite {
  id: string;
  tier: string;
  title: string;
  total: number;
  proofHash?: string | null;
  items: OptionItemLite[];
}

export interface RenderLite {
  id: string;
  tier: string | null;
  basePhotoPath: string;
  renderPath: string | null;
  status: string;
  model?: string | null;
  error?: string | null;
  renderedAt?: string | null;
}

function tierChipClass(tier: string) {
  if (tier === "premium") return "chip-ochre";
  if (tier === "economy") return "chip-ink";
  return "chip-teal";
}

export function OptionCompare({
  estimateId,
  options,
  renders,
  selectedOptionId,
  isStalePerTier,
  onRegenerateTier,
}: {
  estimateId: string;
  options: EstimateOptionLite[];
  renders: RenderLite[];
  selectedOptionId?: string | null;
  isStalePerTier?: Record<string, boolean>;
  onRegenerateTier?: (tier: string) => void;
  styleTags?: string[];
  roomType?: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const sorted = useMemo(() => {
    const order: Record<string, number> = { economy: 0, mid: 1, premium: 2 };
    return [...options].sort((a, b) => (order[a.tier] ?? 99) - (order[b.tier] ?? 99));
  }, [options]);

  const minTotal = useMemo(() => {
    if (sorted.length === 0) return 0;
    return Math.min(...sorted.map((o) => Number(o.total)));
  }, [sorted]);

  function handleSelect(tier: string) {
    startTransition(async () => {
      const res = await selectOption(estimateId, tier);
      if (res.ok) {
        showToast("تم اعتماد الخيار — يمكنك التعديل قبل الطباعة", "success");
        router.refresh();
      } else {
        showToast(res.error ?? "تعذّر الاعتماد", "error");
      }
    });
  }

  function handleRegenerate() {
    if (onRegenerateTier) {
      // per-tier hook if provided
      // still need tier param; caller can handle
    }
    startTransition(async () => {
      const res = await generateOptionRenders(estimateId);
      if (res.ok) {
        showToast(`تم تحديث المعاينات (${res.count ?? renders.length})`, "success");
        router.refresh();
        setTimeout(() => router.refresh(), 1200);
        setTimeout(() => router.refresh(), 3500);
      } else {
        showToast(res.error ?? "تعذّر التوليد", "error");
      }
    });
  }

  if (sorted.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-sm font-bold text-ink-soft">لا توجد خيارات مولدة بعد</div>
        <p className="mt-1 text-xs text-ink-faint">سيتم توليد 3 خيارات بعد تحليل الصور والوصف.</p>
      </div>
    );
  }

  const hasNoRenders = renders.length === 0;

  return (
    <div className="space-y-4">
      {hasNoRenders && (
        <div className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-sm font-extrabold text-ink">المعاينة البصرية — 3 مستويات</div>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">لم يتم توليد الصور بعد. اضغط للتوليد — صورة واحدة لكل مستوى (اقتصادي / متوازن / ممتاز) من نفس الزاوية.</p>
          </div>
          <button type="button" onClick={handleRegenerate} disabled={isPending} className="btn btn-primary shrink-0 gap-2 disabled:opacity-60">
            {isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                <span>يُنشئ…</span>
              </>
            ) : (
              <>
                <span>توليد المعاينات الثلاث</span>
                <span aria-hidden>←</span>
              </>
            )}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {sorted.map((opt) => {
          const tier = opt.tier;
          const render = renders.find((r) => r.tier === tier) ?? null;
          const isSelected = selectedOptionId === opt.id;
          const isRecommended = tier === "mid";
          const stale = isStalePerTier?.[tier] ?? false;
          const delta = Number(opt.total) - minTotal;
          const isCheapest = delta === 0;

          const isPendingRender = render?.status === "pending";
          const isDone = render?.status === "done" && !!render?.renderPath;
          const isFailed = render?.status === "failed";
          const isFallback = render?.model?.includes("mock-fallback");

          return (
            <div
              key={opt.id}
              className={`card card-hover relative overflow-hidden flex flex-col transition-colors ${
                isSelected ? "border-teal bg-teal-50/60 shadow-card-hover ring-1 ring-teal" : "border-line"
              } ${isRecommended ? "card-zellige" : ""}`}
              aria-pressed={isSelected}
            >
              {/* header */}
              <div className="flex items-center justify-between gap-2 border-b border-line bg-paper px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`chip ${tierChipClass(tier)}`}>{opt.title}</span>
                  {isRecommended && <span className="chip chip-ochre">موصى به</span>}
                  {isSelected && <span className="chip chip-teal">مُعتمد</span>}
                  {stale && <span className="chip chip-ochre">قديم</span>}
                </div>
                <span className="text-[11px] font-bold text-ink-faint tracking-wide uppercase">{tier}</span>
              </div>

              {stale && (
                <div className="flex items-center gap-2 border-b border-ochre/20 bg-ochre-soft px-3 py-2 text-xs font-bold leading-relaxed text-ochre-deep">
                  <span aria-hidden>⚠</span>
                  <span>المعاينة أقدم من آخر تعديل على البنود</span>
                </div>
              )}

              {/* hero */}
              <div className="relative">
                {isDone && render?.renderPath ? (
                  <BeforeAfterSlider beforeSrc={render.basePhotoPath} afterSrc={render.renderPath} />
                ) : isPendingRender ? (
                  <div className="ba-slider grid place-items-center bg-paper-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={render?.basePhotoPath ?? ""} alt="قبل" className="opacity-40" />
                    <div className="absolute inset-0 grid place-items-center bg-white/55 backdrop-blur-[1px]">
                      <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm border border-line">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-teal/30 border-t-teal" aria-hidden />
                        <span className="text-xs font-extrabold text-teal">يُنشئ معاينة {opt.title}…</span>
                      </div>
                    </div>
                  </div>
                ) : isFailed ? (
                  <div className="grid place-items-center bg-danger-soft p-6 text-center min-h-[180px]">
                    <div>
                      <div className="text-sm font-extrabold text-danger">فشل {opt.title}</div>
                      <div className="mt-1 text-xs leading-relaxed text-ink-soft line-clamp-3">{render?.error ?? "تعذّر التوليد"}</div>
                      <button type="button" onClick={handleRegenerate} disabled={isPending} className="btn btn-ghost btn-sm mt-3 gap-1 text-xs">
                        إعادة التوليد
                      </button>
                    </div>
                  </div>
                ) : hasNoRenders ? (
                  <div className="grid place-items-center bg-paper-100 p-6 text-center min-h-[180px]">
                    <div>
                      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white border border-line text-ink-faint">◈</div>
                      <div className="mt-2 text-xs font-bold text-ink-soft">بانتظار التوليد</div>
                      <div className="mt-1 text-[11px] text-ink-faint">سيتم توليد صورة {opt.title} من نفس الزاوية</div>
                    </div>
                  </div>
                ) : (
                  <div className="ba-slider skeleton min-h-[180px] grid place-items-center bg-paper-100">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
                  </div>
                )}
                {isDone && isFallback && <span className="absolute bottom-2 left-2 rounded-full bg-ochre px-2 py-1 text-[10px] font-extrabold text-white shadow">احتياطي</span>}
              </div>

              {/* proof strip */}
              {isDone && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line bg-paper px-3 py-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 font-bold text-ink-soft">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
                    دليل بصري — مقفل على البنود
                  </span>
                  <span className="inline-flex items-center gap-2 font-medium text-ink-faint">
                    {render?.renderedAt && <span className="chip bg-white border-line text-ink-soft">تم التوليد {String(render.renderedAt).slice(0, 16).replace("T", " ")}</span>}
                    {opt.proofHash && <span className="tnum chip bg-white border-line text-ink-faint">#{opt.proofHash.slice(0, 8).toUpperCase()}</span>}
                  </span>
                </div>
              )}

              {/* mini ledger */}
              <div className="p-3 flex-1 flex flex-col">
                <div className="overflow-hidden rounded-xl border border-line-soft">
                  <table className="ledger text-xs w-full">
                    <thead>
                      <tr>
                        <th className="text-right">البند</th>
                        <th className="text-center">الكمية</th>
                        <th className="text-center">المجموع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opt.items.slice(0, 5).map((it, i) => (
                        <tr key={i}>
                          <td className="align-middle">
                            <div className="truncate font-bold text-ink max-w-[150px]">{it.itemName}</div>
                            <div className="text-[11px] font-medium text-ink-faint">{it.category}</div>
                          </td>
                          <td className="text-center tnum whitespace-nowrap">
                            {formatQty(it.quantity)} {it.unit}
                          </td>
                          <td className="text-center tnum font-bold whitespace-nowrap">
                            {formatAmount(it.lineTotal)} <span className="text-[10px] font-medium">دج</span>
                          </td>
                        </tr>
                      ))}
                      {opt.items.length > 5 && (
                        <tr>
                          <td colSpan={3} className="text-center text-xs font-bold text-ink-faint py-2">
                            +{opt.items.length - 5} بنود أخرى
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* total ochre band */}
                <div className="mt-3 rounded-xl bg-ochre-soft/60 border border-ochre/20 px-3 py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-ink-soft">الإجمالي</div>
                    <div className="whitespace-nowrap font-display text-lg font-extrabold text-ochre">
                      <span dir="ltr" className="tnum">
                        {formatAmount(Number(opt.total))}
                      </span>{" "}
                      دج
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    {isCheapest ? (
                      <span className="chip chip-teal text-[11px]">الأوفر</span>
                    ) : (
                      <span className="chip chip-ink tnum text-[11px]">+{formatAmount(delta)} دج</span>
                    )}
                    <div className="mt-1 text-[11px] font-medium text-ink-faint">{opt.items.length} بنود</div>
                  </div>
                </div>

                <div className="mt-auto pt-3">
                  <button
                    type="button"
                    onClick={() => handleSelect(tier)}
                    disabled={isPending}
                    aria-pressed={isSelected}
                    className={`btn w-full min-h-[44px] gap-2 text-sm font-extrabold focus-visible:ring-2 ${
                      isSelected ? "btn-ghost border-teal text-teal bg-teal-50" : "btn-primary"
                    }`}
                  >
                    {isPending ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                        <span>جارٍ الاعتماد…</span>
                      </>
                    ) : isSelected ? (
                      <>
                        <span>✓ مُعتمد</span>
                      </>
                    ) : (
                      <>
                        <span>اعتماد هذا الخيار</span>
                        <span aria-hidden>←</span>
                      </>
                    )}
                  </button>
                  {isSelected && <p className="mt-2 text-center text-xs font-bold text-teal">تم اختيار هذا الخيار — يمكنك التعديل قبل الطباعة</p>}
                  {!isSelected && isFailed && (
                    <button type="button" onClick={handleRegenerate} disabled={isPending} className="btn btn-ghost w-full mt-2 btn-sm">
                      إعادة توليد الصورة
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length > 0 && renders.length > 0 && renders.some((r) => r.status === "pending") && (
        <p className="text-center text-xs font-medium text-ink-faint">المعاينات تُنشأ تباعًا — قد تستغرق 36-90 ثانية للثلاثة. لا تغلق الصفحة.</p>
      )}
    </div>
  );
}
