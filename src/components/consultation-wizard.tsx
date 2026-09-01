"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { createEstimate, type CreateEstimateState } from "@/actions/estimates";
import { useToast } from "@/components/ui";
import { formatAmount } from "@/lib/format";

const MAX_PHOTOS = 4;
const QUICK_CHIPS = ["12 م²", "دهان كامل", "بلاط جديد", "4 نقاط كهرباء", "تفكيك قديم"];
const STYLE_TAGS = ["عصري", "كلاسيك", "هادئ", "ريفي", "فاخر"] as const;

const BUDGET_TIERS = [
  {
    id: "economy" as const,
    title: "اقتصادي",
    desc: "سيراميك 30×30 أبيض مطفي — حل متين بتكلفة مضبوطة",
  },
  {
    id: "mid" as const,
    title: "متوازن",
    desc: "بورسلان 60×60 بيج قابل للغسل — التوازن المثالي",
  },
  {
    id: "premium" as const,
    title: "ممتاز",
    desc: "رخام 80×80 + دهان فاخر + إضاءة مخفية — لمسة راقية",
  },
] as const;

const STEP_TITLES = ["الصور", "القياسات", "الأمنيات", "الميزانية", "ملاحظات"] as const;

export function ConsultationWizard() {
  const [state, rawFormAction, pending] = useActionState<CreateEstimateState, FormData>(createEstimate, {});
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  // wizard step
  const [step, setStep] = useState(1);

  // photos (reuse logic exactly from new-estimate-form.tsx)
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);
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
    const filtered = incomingArr.filter((f) => f.size > 0);
    if (filtered.length === 0) return;
    const existing = filesRef.current;
    const combined = [...existing, ...filtered];
    const sliced = combined.slice(0, MAX_PHOTOS);
    if (combined.length > MAX_PHOTOS) {
      showToast(`الحد الأقصى ${MAX_PHOTOS} صور — تم الاحتفاظ بأول ${MAX_PHOTOS} فقط`, "error");
    }
    filesRef.current = sliced;
    if (galleryRef.current) galleryRef.current.value = "";
    syncGalleryInput(sliced);
    setPreviewsFromFiles(sliced);
    if (cameraRef.current) cameraRef.current.value = "";
  }
  function onGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    appendFiles(e.target.files);
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
      return prev.filter((_, i) => i !== idx);
    });
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

  // measurements
  const [lengthM, setLengthM] = useState("");
  const [widthM, setWidthM] = useState("");
  const [heightM, setHeightM] = useState("");
  const [unknownDims, setUnknownDims] = useState(false);

  // wishes
  const [styleSelected, setStyleSelected] = useState<string[]>([]);
  const [roomType, setRoomType] = useState("");

  // budget
  const [budgetTier, setBudgetTier] = useState<"" | "economy" | "mid" | "premium">("");
  const [budgetDZD, setBudgetDZD] = useState("");

  // contractor notes step
  const [contractorNotes, setContractorNotes] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const descRef = useRef<HTMLTextAreaElement>(null);

  function toggleStyle(tag: string) {
    setStyleSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }
  function appendChip(chip: string) {
    setDescription((d) => (d ? `${d}، ${chip}` : chip));
    descRef.current?.focus();
  }

  const computedArea: number | null = (() => {
    if (unknownDims) return null;
    const l = parseFloat(lengthM.replace(",", "."));
    const w = parseFloat(widthM.replace(",", "."));
    if (!Number.isFinite(l) || !Number.isFinite(w) || l <= 0 || w <= 0) return null;
    return Math.round(l * w * 100) / 100;
  })();

  const budgetNum = (() => {
    const n = parseFloat(budgetDZD.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  })();

  // Prevent implicit Enter submission before final step (common wizard bug: Enter in an input triggers form submit and skips remaining steps)
  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Enter" && step !== 5) {
      const target = e.target as HTMLElement;
      // Allow newline in textarea, but block Enter in inputs/selects that would submit the form early
      if (target.tagName !== "TEXTAREA") {
        e.preventDefault();
      }
    }
  }
  // Submission is fully manual (via the final button onClick), so ALWAYS suppress native submit —
  // otherwise Enter/autofill/requestSubmit would trigger a plain page navigation.
  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  function handleFinalSubmit() {
    if (step !== 5) {
      showToast("أكمل جميع الخطوات حتى ملاحظات المقاول قبل الإرسال", "error");
      return;
    }
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("_step", "5");
    startTransition(() => {
      rawFormAction(fd);
    });
  }

  return (
    <form ref={formRef} onKeyDown={handleFormKeyDown} onSubmit={handleFormSubmit} className="space-y-5" noValidate>
      {/* step guard for server — also sent via guarded formAction */}
      <input type="hidden" name="_step" value={String(step)} />
      {/* hidden submit helpers for non-visible inputs (ensure FormData completeness when step hidden via CSS) */}
      {styleSelected.map((tag) => (
        <input key={tag} type="hidden" name="styleTags" value={tag} />
      ))}
      {styleSelected.length > 0 && <input type="hidden" name="style" value={styleSelected[0]} />}
      {budgetTier && <input type="hidden" name="budgetTier" value={budgetTier} />}

      {/* top stepper */}
      <div className="card p-3 sm:p-4">
        <div className="flex items-center justify-between gap-1 text-xs font-bold sm:gap-2">
          {STEP_TITLES.map((label, idx) => {
            const n = idx + 1;
            const isActive = step === n;
            const isDone = step > n;
            return (
              <div key={label} className="flex flex-1 items-center gap-1 sm:gap-1.5">
                <span className="flex items-center gap-1">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] font-extrabold transition-colors sm:h-7 sm:w-7 ${
                      isActive
                        ? "bg-teal border-teal text-white shadow-sm"
                        : isDone
                          ? "bg-teal-soft border-teal/20 text-teal"
                          : "bg-paper-100 border-line text-ink-soft"
                    }`}
                  >
                    {n}
                  </span>
                  <span className={`hidden sm:inline ${isActive ? "text-teal" : isDone ? "text-teal" : "text-ink-soft"}`}>{label}</span>
                </span>
                {n < 5 && <span className={`hidden h-px flex-1 sm:block ${step > n ? "bg-teal" : "bg-line"}`} aria-hidden />}
              </div>
            );
          })}
        </div>
        {/* progress ruler */}
        <div className="ruler ruler-animated mt-3 opacity-35" aria-hidden />
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-paper-100">
          <div
            className="h-full rounded-full bg-teal transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-2 text-center text-[11px] font-bold text-ink-faint">
          الخطوة {step} من 5 — {STEP_TITLES[step - 1]}
        </div>
      </div>

      {/* STEP 1 — Photos */}
      <div className={step === 1 ? "block" : "hidden"}>
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
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-soft">اختر صورًا محفوظة أو التقط مباشرة — إضاءة جيدة تساعد الذكاء على قياس أدق.</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-xs font-extrabold text-white shadow-sm">
              <span>اختر من المعرض</span>
              <span aria-hidden>↗</span>
            </div>
            <p className="mt-2 text-[11px] font-medium text-ink-faint">JPEG / PNG / WebP — يمكنك اختيار عدة صور دفعة واحدة</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="btn btn-primary gap-1.5 text-[13px] sm:text-sm"
              aria-label="التقاط صورة بالكاميرا"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[18px] w-[18px] shrink-0" aria-hidden>
                <path
                  d="M4 7a2 2 0 0 1 2-2h2.5l1.2-1.2A1 1 0 0 1 10.4 3h3.2a1 1 0 0 1 .7.3L15.5 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
                  strokeWidth={1.7}
                  strokeLinejoin="round"
                />
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
      </div>

      {/* STEP 2 — Measurements */}
      <div className={step === 2 ? "block" : "hidden"}>
        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
            <span className="font-display text-sm font-extrabold text-ink">أبعاد الغرفة</span>
            <span className="text-xs font-medium text-ink-faint">— اختياري، بالمتر</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-ink-soft">الطول (م)</span>
              <input
                name="lengthM"
                type="number"
                step="0.5"
                min="0"
                inputMode="decimal"
                value={lengthM}
                onChange={(e) => setLengthM(e.target.value)}
                disabled={unknownDims}
                placeholder="5.2"
                className="field tnum text-center ltr"
                aria-label="الطول بالمتر"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-ink-soft">العرض (م)</span>
              <input
                name="widthM"
                type="number"
                step="0.5"
                min="0"
                inputMode="decimal"
                value={widthM}
                onChange={(e) => setWidthM(e.target.value)}
                disabled={unknownDims}
                placeholder="4"
                className="field tnum text-center ltr"
                aria-label="العرض بالمتر"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-ink-soft">الارتفاع (م)</span>
              <input
                name="heightM"
                type="number"
                step="0.5"
                min="0"
                inputMode="decimal"
                value={heightM}
                onChange={(e) => setHeightM(e.target.value)}
                disabled={unknownDims}
                placeholder="2.8"
                className="field tnum text-center ltr"
                aria-label="الارتفاع بالمتر"
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-line-soft bg-paper-100 px-3 py-2.5 cursor-pointer hover:bg-paper transition-colors">
            <input
              type="checkbox"
              checked={unknownDims}
              onChange={(e) => setUnknownDims(e.target.checked)}
              className="h-4 w-4 rounded border-line text-teal focus:ring-teal"
            />
            <span className="text-sm font-bold text-ink">لا أعرف — سيقدّرها الذكاء</span>
            <span className="text-xs text-ink-faint">— اتركها فارغة، سنستنتج المساحة من الصور/الوصف</span>
          </label>
          {computedArea !== null ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-soft px-3 py-1.5 text-sm font-extrabold text-teal border border-teal/10">
              <span>≈</span>
              <span dir="ltr" className="tnum">
                {formatAmount(computedArea)}
              </span>
              <span>م²</span>
            </div>
          ) : unknownDims ? (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-paper-100 px-3 py-1.5 text-xs font-bold text-ink-soft border border-line-soft">
              <span>سيتم تقدير المساحة تلقائياً</span>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">أدخل الطول والعرض لحساب المساحة فورًا — أو فعّل “لا أعرف”.</p>
          )}
          <p className="mt-2 rounded-lg bg-paper-100 px-3 py-2 text-xs leading-relaxed text-ink-soft border border-line-soft">
            <span className="font-bold text-ink">تلميح:</span> القياس بالمتر — مثال 5×4 = 20 م². الارتفاع للدهان/الجبس فقط.
          </p>
        </div>
      </div>

      {/* STEP 3 — Wishes */}
      <div className={step === 3 ? "block" : "hidden"}>
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
            <span className="font-display text-sm font-extrabold text-ink">الأمنيات والنمط</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-ink-soft">اختر النمط (يمكنك اختيار أكثر من واحد)</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STYLE_TAGS.map((tag) => {
                const selected = styleSelected.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleStyle(tag)}
                    aria-pressed={selected}
                    className={`chip border text-sm font-bold px-3.5 py-1.5 transition-colors ${
                      selected ? "chip-teal border-teal bg-teal-soft" : "bg-white border-line text-ink-soft hover:border-teal hover:text-teal"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            {styleSelected.length > 0 && (
              <p className="mt-2 text-xs font-medium text-teal">الأساسي: {styleSelected[0]} — سيُستخدم للمعاينة البصرية</p>
            )}
          </div>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-bold text-ink-soft">نوع الغرفة (اختياري)</span>
            <input
              name="roomType"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="field"
              placeholder="مثال: مطبخ، حمام، صالون، غرفة نوم"
            />
          </label>
          <p className="rounded-lg bg-paper-100 px-3 py-2 text-xs leading-relaxed text-ink-soft border border-line-soft">
            النمط يوجّه ألوان وخامات المعاينة — “عصري” ألوان فاتحة وخطوط نظيفة، “كلاسيك” تفاصيل دافئة.
          </p>
        </div>
      </div>

      {/* STEP 4 — Budget */}
      <div className={step === 4 ? "block" : "hidden"}>
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
            <span className="font-display text-sm font-extrabold text-ink">الميزانية — الشعور</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-ink-soft">اختر الفئة التي تناسب الزبون</span>
            <div className="segmented mt-2 w-full grid grid-cols-3 p-1 sm:inline-flex sm:w-auto" role="group" aria-label="فئة الميزانية">
              {BUDGET_TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={budgetTier === t.id}
                  onClick={() => setBudgetTier(t.id)}
                  className="segmented-btn flex flex-col items-center gap-0.5 px-2 py-2 sm:py-1.5"
                >
                  <span className="text-sm font-extrabold leading-none">{t.title}</span>
                  <span className="hidden text-[10px] font-medium opacity-80 sm:inline">{t.id === "economy" ? "اقتصادي" : t.id === "mid" ? "متوازن" : "ممتاز"}</span>
                </button>
              ))}
            </div>
            {budgetTier && (
              <div className="mt-2 rounded-xl border border-teal/20 bg-teal-50 px-3 py-2 text-xs leading-relaxed text-ink">
                <span className="font-bold text-teal">{BUDGET_TIERS.find((b) => b.id === budgetTier)?.title}: </span>
                {BUDGET_TIERS.find((b) => b.id === budgetTier)?.desc}
              </div>
            )}
            {/* hidden budgetTier already rendered at top */}
          </div>
          <div className="ruler opacity-25" aria-hidden />
          <label className="grid gap-1.5">
            <span className="text-[11px] font-bold text-ink-soft">ميزانية دقيقة (اختياري — دج)</span>
            <input
              name="budgetDZD"
              value={budgetDZD}
              onChange={(e) => setBudgetDZD(e.target.value)}
              className="field tnum"
              placeholder="مثال: 240000"
              inputMode="decimal"
              type="number"
              min="0"
            />
          </label>
          {budgetNum !== null && (
            <div className="inline-flex items-center gap-2 rounded-full bg-ochre-soft px-3 py-1.5 text-sm font-extrabold text-ochre border border-ochre/15">
              <span>≈</span>
              <span dir="ltr" className="tnum">
                {formatAmount(budgetNum)}
              </span>
              <span>دج</span>
            </div>
          )}
          <input type="range" min="50000" max="1000000" step="10000" value={budgetNum ?? 200000} onChange={(e) => setBudgetDZD(e.target.value)} className="w-full accent-teal" aria-label="ميزانية" />
          <p className="text-xs leading-relaxed text-ink-faint">الفئة تُوجّه اختيار الخامات — “اقتصادي” أرخص، “ممتاز” أرقى خامة وسعر.</p>
        </div>
      </div>

      {/* STEP 5 — Contractor notes + final */}
      <div className={step === 5 ? "block" : "hidden"}>
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
            <span className="font-display text-sm font-extrabold text-ink">ملاحظات المقاول</span>
            <span className="text-xs font-medium text-ink-faint">— لا تظهر للزبون</span>
          </div>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-bold text-ink-soft">ملاحظات داخلية (حالة الجدران، طلبات خاصة...)</span>
            <textarea
              name="contractorNotes"
              value={contractorNotes}
              onChange={(e) => setContractorNotes(e.target.value)}
              className="field min-h-[110px] resize-y leading-relaxed"
              placeholder="مثال: الجدار فيه رطوبة قرب النافذة — يحتاج معجون إضافي. الزبون يفضل الألوان الفاتحة..."
              rows={4}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-ink-soft">اسم الزبون (اختياري — يظهر على عرض السعر)</span>
              <input
                name="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="field"
                placeholder="مثال: السيد أحمد — صالون الطابق الأول"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-ink-soft">نوع الغرفة (إعادة تأكيد)</span>
              <input
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="field"
                placeholder="مطبخ / حمام..."
                aria-label="نوع الغرفة مكرر"
              />
              <span className="text-[10px] text-ink-faint">هذا الحقل مكرر للتأكيد — سيُرسل كـ roomType</span>
            </label>
          </div>
          <div>
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
                <button
                  key={c}
                  type="button"
                  onClick={() => appendChip(c)}
                  className="chip bg-white border-line text-ink-soft hover:border-teal hover:text-teal transition-colors"
                >
                  + {c}
                </button>
              ))}
            </div>
            <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-paper-100 px-3 py-2 text-xs leading-relaxed text-ink-soft border border-line-soft">
              <span aria-hidden className="mt-0.5 text-teal">
                💡
              </span>
              <span>اذكر المساحة إن عرفتها، ونوع الدهان أو البلاط، وعدد نقاط الكهرباء. التطبيق سيطابق كلامك مع صور الغرفة.</span>
            </p>
          </div>
        </div>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm font-bold leading-relaxed text-danger">
          <span aria-hidden className="mt-0.5">
            ⚠
          </span>
          <span>{state.error}</span>
        </div>
      )}

      {/* sticky CTA */}
      <div className="sticky bottom-[72px] z-20 -mx-4 border-t border-line bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/90 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} className="btn btn-ghost flex-1 sm:flex-initial sm:px-6" disabled={pending}>
              السابق
            </button>
          )}
          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(5, s + 1))}
              className="btn btn-primary flex-1 gap-1.5 text-sm font-extrabold sm:w-auto sm:px-8"
            >
              <span>التالي</span>
              <span aria-hidden>←</span>
            </button>
          ) : (
            <button type="button" onClick={handleFinalSubmit} className="btn btn-primary btn-lg flex-1 gap-2 text-base shadow-sm disabled:opacity-60 sm:w-auto sm:px-8" disabled={pending}>
              {pending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                  <span>يحلّل ويولّد 3 خيارات…</span>
                </>
              ) : (
                <>
                  <span>استخرج وولّد 3 خيارات</span>
                  <span aria-hidden>←</span>
                </>
              )}
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-medium">
          <span className="text-ink-faint">
            الخطوة {step} / 5
          </span>
          <span className="text-ink-soft hidden sm:inline">{pending ? "قد يستغرق التحليل ثوانٍ — لا تغلق الصفحة" : "يمكنك الرجوع لتعديل أي خطوة"}</span>
        </div>
        <p className="mt-1 text-center text-xs font-medium text-ink-faint sm:hidden">
          {pending ? "يحلّل الصور ويولّد 3 خيارات..." : "اسحب للأعلى لتكملة النموذج"}
        </p>
      </div>
    </form>
  );
}
