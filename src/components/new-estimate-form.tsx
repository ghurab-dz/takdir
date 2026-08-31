"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { createEstimate, type CreateEstimateState } from "@/actions/estimates";
import { useToast } from "@/components/ui";

const MAX_PHOTOS = 4;
const QUICK_CHIPS = ["12 م²", "دهان كامل", "بلاط جديد", "4 نقاط كهرباء", "تفكيك قديم"];

export function NewEstimateForm() {
  const [state, formAction, pending] = useActionState<CreateEstimateState, FormData>(createEstimate, {});
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [description, setDescription] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const filesRef = useRef<File[]>([]);
  const { showToast } = useToast();

  // keep latest previews for unmount revoke
  const previewsRef = useRef<string[]>([]);
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);
  useEffect(() => {
    return () => {
      previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  function syncGalleryInput(files: File[]) {
    if (!galleryRef.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    galleryRef.current.files = dt.files;
  }

  function setPreviewsFromFiles(files: File[]) {
    setPreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return files.map((f) => URL.createObjectURL(f));
    });
  }

  function appendFiles(incoming: File[] | FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const incomingArr = Array.from(incoming as File[]);
    // filter out empty/size0 just in case
    const filtered = incomingArr.filter((f) => f.size > 0);
    if (filtered.length === 0) return;

    const existing = filesRef.current;
    const combined = [...existing, ...filtered];
    const sliced = combined.slice(0, MAX_PHOTOS);

    if (combined.length > MAX_PHOTOS) {
      showToast(`الحد الأقصى ${MAX_PHOTOS} صور — تم الاحتفاظ بأول ${MAX_PHOTOS} فقط`, "error");
    }

    filesRef.current = sliced;
    // clear gallery value before sync so same file can be re-picked later
    // (setting files via DataTransfer keeps value as "" — intentional)
    if (galleryRef.current) galleryRef.current.value = "";
    syncGalleryInput(sliced);
    setPreviewsFromFiles(sliced);

    // clear transient camera input so same file can be re-picked
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function onGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    // browser already set galleryRef.files = newly picked only — we merge via filesRef
    const newFiles = e.target.files;
    // reset the input value immediately so we can re-derive correctly,
    // then our append will overwrite with merged list
    // We must capture newFiles before we overwrite
    appendFiles(newFiles);
    // if user cancelled picker, e.target.files is empty — do nothing
    // After append, galleryRef already contains merged; no need to keep stale value
    // To avoid input holding duplicate after next pick, we rely on filesRef + sync
  }

  function onCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    appendFiles(e.target.files);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    appendFiles(e.dataTransfer.files);
  }, []);

  function removePreview(idx: number) {
    const next = filesRef.current.filter((_, i) => i !== idx);
    filesRef.current = next;
    syncGalleryInput(next);
    setPreviews((prev) => {
      const urlToRevoke = prev[idx];
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      const remaining = prev.filter((_, i) => i !== idx);
      // Re-create is not needed — just filter; but URLs for remaining still valid
      // For consistency, re-derive from files would revoke all, so we handle surgically:
      return remaining;
    });
    // If we removed via filter without re-deriving, we must ensure file order matches
    // Sync already done; previews already filtered
  }

  function clearAll() {
    filesRef.current = [];
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    setPreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return [];
    });
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
          onClick={() => galleryRef.current?.click()}
          className={`dropzone ${dragOver ? "dragover" : ""} group`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              galleryRef.current?.click();
            }
          }}
          aria-label="اختر صور الغرفة من المعرض — اسحب وأفلت أو اضغط للاختيار"
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white border border-line text-teal shadow-sm group-hover:scale-105 transition-transform">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
              <path d="M12 16V7M12 7l-4 4M12 7l4 4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" strokeWidth={1.8} strokeLinecap="round" />
              <circle cx={12} cy={11} r={1.2} fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="mt-3 font-display text-sm font-extrabold text-ink">اسحب الصور هنا أو اختر من المعرض</div>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-soft">
            اختر صورًا محفوظة أو التقط مباشرة — إضاءة جيدة تساعد الذكاء الاصطناعي على قياس أدق.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-xs font-extrabold text-white shadow-sm">
            <span>اختر من المعرض</span>
            <span aria-hidden>↗</span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-ink-faint">JPEG / PNG / WebP — يمكنك اختيار عدة صور دفعة واحدة</p>
        </div>

        {/* explicit dual choice — camera vs gallery (mobile-first) */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="btn btn-primary gap-1.5 text-[13px] sm:text-sm"
            aria-label="التقاط صورة بالكاميرا"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[18px] w-[18px] shrink-0" aria-hidden>
              <path d="M4 7a2 2 0 0 1 2-2h2.5l1.2-1.2A1 1 0 0 1 10.4 3h3.2a1 1 0 0 1 .7.3L15.5 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" strokeWidth={1.7} strokeLinejoin="round" />
              <circle cx={12} cy={12} r={3.4} strokeWidth={1.7} />
              <path d="M18 9h.01" strokeWidth={2} strokeLinecap="round" />
            </svg>
            <span>التقاط بالكاميرا</span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="btn btn-ghost gap-1.5 text-[13px] sm:text-sm"
            aria-label="اختيار صور من المعرض"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[18px] w-[18px] shrink-0" aria-hidden>
              <rect x={3} y={4} width={18} height={14} rx={2.2} strokeWidth={1.7} />
              <path d="M3 14l5.2-4.6a1 1 0 0 1 1.4 0L13 12.6l1.8-1.6a1 1 0 0 1 1.4 0L21 15.5" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={8.3} cy={8.3} r={1.4} strokeWidth={1.6} />
            </svg>
            <span>اختيار من المعرض</span>
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] font-medium text-ink-faint">حتى {MAX_PHOTOS} صور — يمكنك المزج بين الكاميرا والمعرض</p>

        <input
          ref={galleryRef}
          type="file"
          name="photos"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={onGalleryChange}
          className="hidden"
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple
          onChange={onCameraChange}
          className="hidden"
          aria-hidden
          tabIndex={-1}
        />

        {previews.length > 0 ? (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-soft">{previews.length} صور مختارة</span>
              <button type="button" onClick={clearAll} className="text-xs font-bold text-danger hover:underline">
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
        <button type="submit" className="btn btn-primary btn-lg w-full gap-2 text-base shadow-sm disabled:opacity-60" disabled={pending}>
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
        <p className="mt-2 text-center text-xs font-medium text-ink-faint sm:text-ink-soft">قد يستغرق التحليل ثوانٍ قليلة — لا تغلق الصفحة</p>
      </div>
    </form>
  );
}
