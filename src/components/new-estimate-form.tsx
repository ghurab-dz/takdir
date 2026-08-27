"use client";

import { useActionState, useRef, useState, useCallback } from "react";
import { createEstimate, type CreateEstimateState } from "@/actions/estimates";

const MAX_PHOTOS = 4;
const QUICK_CHIPS = ["12 م²", "دهان كامل", "بلاط جديد", "4 نقاط كهرباء", "تفكيك قديم"];

export function NewEstimateForm() {
  const [state, formAction, pending] = useActionState<CreateEstimateState, FormData>(createEstimate, {});
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  function syncFiles(files: FileList | File[] | null) {
    if (!files) return;
    const arr = [...(files as File[])].slice(0, MAX_PHOTOS);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
    // sync to actual input for form submission
    if (fileRef.current) {
      const dt = new DataTransfer();
      arr.forEach((f) => dt.items.add(f));
      fileRef.current.files = dt.files;
    }
  }

  function onPhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    syncFiles(e.target.files);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    syncFiles(e.dataTransfer.files);
  }, []);

  function removePreview(idx: number) {
    setPreviews((p) => p.filter((_, i) => i !== idx));
    if (fileRef.current?.files) {
      const dt = new DataTransfer();
      const files = Array.from(fileRef.current.files);
      files.splice(idx, 1);
      files.forEach((f) => dt.items.add(f));
      fileRef.current.files = dt.files;
    }
  }

  function appendChip(chip: string) {
    setDescription((d) => (d ? `${d}، ${chip}` : chip));
    descRef.current?.focus();
  }

  return (
    <form action={formAction} className="space-y-5">
      {/* stepper */}
      <div className="flex items-center justify-center gap-2 text-xs font-bold">
        <span className="inline-flex items-center gap-1.5">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-teal text-white text-[11px]">1</span> صور
        </span>
        <span className="h-px w-6 bg-line" aria-hidden />
        <span className="inline-flex items-center gap-1.5 text-ink-soft">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-paper-100 border border-line text-[11px]">2</span> وصف
        </span>
        <span className="h-px w-6 bg-line" aria-hidden />
        <span className="inline-flex items-center gap-1.5 text-ink-soft">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-paper-100 border border-line text-[11px]">3</span> استخراج
        </span>
      </div>

      {/* photos — dropzone */}
      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <label className="font-display text-sm font-extrabold text-ink">صور الغرفة</label>
          <span className="chip bg-teal-soft text-teal border-teal/10">حتى {MAX_PHOTOS} صور</span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`dropzone ${dragOver ? "dragover" : ""} group`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          aria-label="اختر صور الغرفة — اسحب وأفلت أو اضغط للاختيار"
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white border border-line text-teal shadow-sm group-hover:scale-105 transition-transform">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
              <path d="M12 16V7M12 7l-4 4M12 7l4 4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" strokeWidth={1.8} strokeLinecap="round" />
              <circle cx={12} cy={11} r={1.2} fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="mt-3 font-display text-sm font-extrabold text-ink">اسحب الصور هنا أو اضغط للاختيار</div>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-soft">
            التقط الغرفة من زوايا مختلفة — إضاءة جيدة تساعد الذكاء الاصطناعي على قياس أدق.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-xs font-extrabold text-white shadow-sm">
            <span>اختر الصور</span>
            <span aria-hidden>↗</span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-ink-faint">JPEG / PNG / WebP — على الهاتف يمكنك التصوير مباشرة</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          name="photos"
          accept="image/jpeg,image/png,image/webp"
          multiple
          capture="environment"
          onChange={onPhotosChange}
          className="hidden"
        />

        {previews.length > 0 ? (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-soft">{previews.length} صور مختارة</span>
              <button
                type="button"
                onClick={() => {
                  setPreviews([]);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-xs font-bold text-danger hover:underline"
              >
                مسح الكل
              </button>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1">
              {previews.map((src, i) => (
                <div key={i} className="relative shrink-0 snap-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`صورة ${i + 1}`} className="h-28 w-28 rounded-xl border border-line object-cover shadow-sm sm:h-24 sm:w-24" />
                  <button
                    type="button"
                    onClick={() => removePreview(i)}
                    className="absolute -left-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink text-white text-xs shadow-md hover:bg-danger transition-colors"
                    aria-label={`حذف الصورة ${i + 1}`}
                  >
                    ✕
                  </button>
                  <span className="absolute bottom-1 right-1 rounded-full bg-ink/75 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-3 hidden items-center gap-2 text-xs text-ink-faint sm:flex">
            <span className="h-px flex-1 bg-line-soft" />
            <span>لا صور بعد</span>
            <span className="h-px flex-1 bg-line-soft" />
          </div>
        )}
      </div>

      {/* description */}
      <div className="card p-4 sm:p-5">
        <label className="mb-2 flex items-center gap-2 font-display text-sm font-extrabold text-ink">
          وصف العمل المطلوب
          <span className="text-xs font-medium text-ink-faint">— كلما كنت أدق كان الاستخراج أدق</span>
        </label>
        <textarea
          ref={descRef}
          name="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="field min-h-[110px] resize-y leading-relaxed"
          placeholder="مثال: غرفة نوم 12 م²، دهان كامل للجدران والسقف بلون أبيض مطفي، تركيب بلاط جديد للأرضية فوق القديم، مع 4 نقاط كهرباء إضافية قرب السرير…"
        />
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {QUICK_CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => appendChip(c)} className="chip bg-white border-line text-ink-soft hover:border-teal hover:text-teal transition-colors">
              + {c}
            </button>
          ))}
        </div>
        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-paper-100 px-3 py-2 text-xs leading-relaxed text-ink-soft border border-line-soft">
          <span aria-hidden className="mt-0.5 text-teal">💡</span>
          <span>اذكر المساحة إن عرفتها، ونوع الدهان أو البلاط، وعدد نقاط الكهرباء. التطبيق سيطابق كلامك مع صور الغرفة.</span>
        </p>
      </div>

      {/* client */}
      <div className="card p-4 sm:p-5">
        <label className="mb-2 block font-display text-sm font-extrabold text-ink">
          اسم الزبون <span className="text-xs font-medium text-ink-faint">(اختياري — يظهر على عرض السعر)</span>
        </label>
        <input name="clientName" className="field" placeholder="مثال: السيد أحمد بن علي — صالون الطابق الأول" />
      </div>

      {state.error && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm font-bold leading-relaxed text-danger">
          <span aria-hidden className="mt-0.5">⚠</span>
          <span>{state.error}</span>
        </div>
      )}

      {/* sticky CTA on mobile */}
      <div className="sticky bottom-[72px] z-20 -mx-4 border-t border-line bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/90 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button
          type="submit"
          className="btn btn-primary btn-lg w-full gap-2 text-base shadow-sm disabled:opacity-60"
          disabled={pending}
        >
          {pending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
              <span>يحلّل الصور ويستخرج البنود…</span>
            </>
          ) : (
            <>
              <span>استخرج البنود والكميات</span>
              <span aria-hidden>←</span>
            </>
          )}
        </button>
        <p className="mt-2 text-center text-xs font-medium text-ink-faint sm:text-ink-soft">
          قد يستغرق التحليل ثوانٍ قليلة — لا تغلق الصفحة
        </p>
      </div>
    </form>
  );
}
