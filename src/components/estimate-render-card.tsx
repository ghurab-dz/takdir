"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateRenders, deleteRenders } from "@/actions/renders";
import { useToast } from "./ui";
import { BeforeAfterSlider } from "./before-after-slider";

export interface RenderRow {
  id: string;
  basePhotoPath: string;
  renderPath: string | null;
  status: string;
  error: string | null;
  model?: string | null;
}

export function EstimateRenderCard({
  estimateId,
  status,
  photoPaths,
  renders,
  isStale,
  photoCount,
}: {
  estimateId: string;
  status: string;
  photoPaths: string[];
  renders: RenderRow[];
  isStale: boolean;
  photoCount: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [localPending, setLocalPending] = useState(false);
  const pending = isPending || localPending;

  const hasRenders = renders.length > 0;
  const fallbackCount = renders.filter((r) => r.model?.includes("mock-fallback")).length;
  const doneCount = renders.filter((r) => r.status === "done").length;
  const pendingCount = renders.filter((r) => r.status === "pending").length;
  const failedCount = renders.filter((r) => r.status === "failed").length;

  function handleGenerate() {
    if (photoCount === 0) {
      showToast("لا توجد صور لإنشاء المعاينة — الصور مطلوبة للمعاينة", "error");
      return;
    }
    if (status !== "final") {
      showToast("اعتمد العرض أولاً ثم أنشئ المعاينة", "error");
      return;
    }
    setLocalPending(true);
    startTransition(async () => {
      const res = await generateRenders(estimateId);
      setLocalPending(false);
      if (res.ok) {
        showToast(`تم إنشاء ${res.count ?? photoCount} معاينات نهائية`, "success");
        router.refresh();
        // polling for sequential renders: refresh a couple times
        setTimeout(() => router.refresh(), 1200);
        setTimeout(() => router.refresh(), 3500);
      } else {
        showToast(res.error ?? "تعذّر إنشاء المعاينة", "error");
      }
    });
  }

  function handleRegenerate() {
    setLocalPending(true);
    startTransition(async () => {
      const res = await generateRenders(estimateId);
      setLocalPending(false);
      if (res.ok) {
        showToast("تمت إعادة التوليد", "success");
        router.refresh();
        setTimeout(() => router.refresh(), 1200);
        setTimeout(() => router.refresh(), 3500);
      } else showToast(res.error ?? "تعذّر", "error");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteRenders(estimateId);
      showToast("تم حذف المعاينات", "success");
      router.refresh();
    });
  }

  if (status !== "final") {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-soft text-teal text-xs font-extrabold">◈</span>
          <div className="font-display text-sm font-extrabold text-ink">المعاينة النهائية (صورة الغرفة بعد التشطيب)</div>
          <span className="chip chip-ink">بعد الاعتماد</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          بعد اعتمادك للعرض، نُنشئ معاينة نهائية لكل زاوية مصورة — صورة واحدة لكل صورة أصلية، مطابقة للبنود في العرض فقط (مقفلة على التسعير). لا تُضاف أي أعمال غير مسعّرة.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" /> {photoCount} صور أصلية — سيُنشأ {photoCount} معاينات
        </div>
      </div>
    );
  }

  if (!hasRenders) {
    return (
      <div className="card overflow-hidden">
        <div className="h-1 w-full bg-teal" aria-hidden />
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal text-white">✦</span>
                <div>
                  <div className="font-display text-sm font-extrabold text-ink">المعاينة النهائية — جاهزة للتوليد</div>
                  <div className="text-xs font-medium text-ink-faint">صورة لكل زاوية • مقفلة على عرض السعر • مع ختم زمني</div>
                </div>
              </div>
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink-soft">
                سيُستخدم نفس صور الغرفة لإنشاء معاينة تُظهر فقط ما هو مسعّر في الجدول أعلاه. إن لم يكن البلاط في العرض، يبقى البلاط في الصورة كما هو.
                <span className="font-bold text-ink"> الصورة توضيحية وليست مطابقة 100% للألوان على الطبيعة.</span>
              </p>
            </div>
            <span className="hidden sm:inline-flex chip bg-paper-100 border-line text-ink-soft">{photoCount} صور → {photoCount} معاينات</span>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={pending}
            className="btn btn-primary btn-lg mt-4 w-full gap-2 shadow-sm disabled:opacity-60"
          >
            {pending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                <span>يُنشئ المعاينات — قد تستغرق {photoCount * 12}- {photoCount * 30} ثانية…</span>
              </>
            ) : (
              <>
                <span>توليد المعاينة النهائية</span>
                <span className="chip bg-white/15 text-white border-white/20 text-[11px]"> {photoCount} صور</span>
                <span aria-hidden>←</span>
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[11px] font-medium text-ink-faint">يستخدم Gemini الطبقة المجانية — قد تتأخر أول صورة ثوانٍ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isStale && (
        <div className="flex gap-3 rounded-xl border border-ochre/25 bg-ochre-soft px-4 py-3">
          <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-ochre text-white sm:grid">!</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-ochre-deep">المعاينة أقدم من آخر تعديل على البنود</div>
            <p className="mt-1 text-xs leading-relaxed text-ink">عدّلت البنود بعد التوليد — أعد التوليد ليبقى الدليل (الصورة + الجدول) متطابقًا ومختومًا.</p>
          </div>
          <button type="button" onClick={handleRegenerate} disabled={pending} className="btn btn-primary btn-sm shrink-0 self-start">
            إعادة التوليد
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line bg-paper px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal text-white text-xs">◈</span>
            <span className="font-display text-sm font-extrabold text-ink">المعاينات النهائية</span>
            <span className="chip chip-teal">{doneCount}/{renders.length} جاهزة</span>
            {fallbackCount > 0 && <span className="chip chip-ochre">{fallbackCount} احتياطي</span>}
            {pendingCount > 0 && <span className="chip chip-ochre">{pendingCount} قيد الإنشاء…</span>}
            {failedCount > 0 && <span className="chip bg-danger-soft text-danger border-danger/15">{failedCount} فشل</span>}
            {isStale && <span className="chip chip-ochre">قديمة</span>}
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <button type="button" onClick={handleRegenerate} disabled={pending} className="btn btn-ghost btn-sm">
              إعادة التوليد
            </button>
            <button type="button" onClick={handleDelete} disabled={pending} className="btn btn-ghost btn-sm">
              حذف
            </button>
          </div>
        </div>

        {fallbackCount > 0 && (
          <div className="mb-3 flex gap-2 rounded-xl border border-ochre/20 bg-ochre-soft px-3 py-2.5 text-xs leading-relaxed text-ochre-deep">
            <span aria-hidden className="mt-0.5">⚠</span>
            <span>
              وضع احتياطي: تجاوزت الحصة المجانية لـ Gemini — عُرضت الصورة الأصلية مؤقتًا بدل المعاينة المولدة. احذف <code className="rounded bg-white px-1 py-0.5 text-[11px]">GEMINI_API_KEY</code> من <code>.env</code> للعمل دون AI، أو حاول بعد دقائق.
            </span>
          </div>
        )}

        <div className="p-3 sm:p-4">
          <div className={`render-grid ${renders.length === 2 ? "cols-2" : renders.length >= 3 ? "cols-3" : ""}`}>
            {renders.map((r, i) => {
              const isFallback = r.model?.includes("mock-fallback");
              return (
                <div key={r.id} className={`overflow-hidden rounded-xl border bg-white ${isFallback ? "border-ochre/30" : "border-line"}`}>
                  {r.status === "done" && r.renderPath ? (
                    <div className="relative">
                      <BeforeAfterSlider beforeSrc={r.basePhotoPath} afterSrc={r.renderPath} />
                      {isFallback && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-ochre px-2 py-1 text-[10px] font-extrabold text-white shadow">احتياطي</span>
                      )}
                    </div>
                  ) : r.status === "pending" ? (
                    <div className="ba-slider grid place-items-center bg-paper-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.basePhotoPath} alt="قبل" className="opacity-40" />
                      <div className="absolute inset-0 grid place-items-center bg-white/55 backdrop-blur-[1px]">
                        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm border border-line">
                          <span className="h-6 w-6 animate-spin rounded-full border-2 border-teal/30 border-t-teal" aria-hidden />
                          <span className="text-xs font-extrabold text-teal">يُنشئ… زاوية {i + 1}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="ba-slider grid place-items-center bg-danger-soft p-4 text-center">
                      <div>
                        <div className="text-sm font-extrabold text-danger">فشل زاوية {i + 1}</div>
                        <div className="mt-1 text-xs leading-relaxed text-ink-soft line-clamp-3">{r.error ?? "تعذّر التوليد"}</div>
                        <button
                          type="button"
                          onClick={handleRegenerate}
                          className="btn btn-ghost btn-sm mt-2 gap-1 text-xs"
                        >
                          إعادة المحاولة
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-xs font-bold text-ink-soft">زاوية {i + 1}</span>
                    <span
                      className={`chip ${isFallback ? "chip-ochre" : r.status === "done" ? "chip-teal" : r.status === "pending" ? "chip-ochre" : "chip-ink"}`}
                    >
                      {isFallback ? "احتياطي — الأصل" : r.status === "done" ? "جاهزة" : r.status === "pending" ? "قيد الإنشاء" : "فشل"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-3 rounded-lg border border-line-soft bg-paper/60 px-3 py-2 text-center text-[11px] leading-relaxed text-ink-soft">
            <span className="font-bold text-ink">تنبيه:</span> الصور توضيحية مولدة بالذكاء الاصطناعي — مقفلة على بنود عرض السعر فقط. ليست بديلاً عن عيّنة خامة على الطبيعة. اسحب المقبض للمقارنة قبل/بعد.
          </p>

          <div className="mt-3 flex gap-2 sm:hidden">
            <button type="button" onClick={handleRegenerate} disabled={pending} className="btn btn-primary flex-1 btn-sm">
              إعادة التوليد
            </button>
            <button type="button" onClick={handleDelete} disabled={pending} className="btn btn-ghost flex-1 btn-sm">
              حذف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
