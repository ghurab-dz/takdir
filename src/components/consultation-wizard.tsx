"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { createEstimate, type CreateEstimateState } from "@/actions/estimates";
import { useToast } from "@/components/ui";

const MAX_PHOTOS = 4;

export function ConsultationWizard() {
  const [state, rawFormAction, pending] = useActionState<CreateEstimateState, FormData>(createEstimate, {});
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [previews, setPreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);
  const previewsRef = useRef<string[]>([]);
  useEffect(() => { previewsRef.current = previews; }, [previews]);
  useEffect(() => { return () => { previewsRef.current.forEach((u) => URL.revokeObjectURL(u)); }; }, []);

  function syncGalleryInput(files: File[]) {
    if (!galleryRef.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    galleryRef.current.files = dt.files;
  }
  function setPreviewsFromFiles(files: File[]) {
    setPreviews((prev) => { prev.forEach((u) => URL.revokeObjectURL(u)); return files.map((f) => URL.createObjectURL(f)); });
  }
  function appendFiles(incoming: File[] | FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const arr = Array.from(incoming as File[]).filter((f) => f.size > 0);
    if (arr.length === 0) return;
    const combined = [...filesRef.current, ...arr].slice(0, MAX_PHOTOS);
    if (filesRef.current.length + arr.length > MAX_PHOTOS) showToast(`الحد الأقصى ${MAX_PHOTOS} صور`, "error");
    filesRef.current = combined;
    if (galleryRef.current) galleryRef.current.value = "";
    syncGalleryInput(combined);
    setPreviewsFromFiles(combined);
    if (cameraRef.current) cameraRef.current.value = "";
  }
  function onGalleryChange(e: React.ChangeEvent<HTMLInputElement>) { appendFiles(e.target.files); }
  function onCameraChange(e: React.ChangeEvent<HTMLInputElement>) { appendFiles(e.target.files); }
  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); appendFiles(e.dataTransfer.files); }, []);
  function removePreview(idx: number) {
    const next = filesRef.current.filter((_, i) => i !== idx);
    filesRef.current = next;
    syncGalleryInput(next);
    setPreviews((prev) => { const u = prev[idx]; if (u) URL.revokeObjectURL(u); return prev.filter((_, i) => i !== idx); });
  }

  const [prompt, setPrompt] = useState("");
  const [clientName, setClientName] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // voice
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  function toggleVoice() {
    const SR: any = (typeof window !== "undefined" && ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition));
    if (!SR) { showToast("المتصفح لا يدعم التسجيل الصوتي — اكتب وصفك", "error"); return; }
    if (listening && recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} setListening(false); return; }
    const rec = new SR();
    rec.lang = "ar-DZ";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); showToast("تعذر التسجيل — حاول مجددا", "error"); };
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript ?? "";
      if (t) setPrompt((p) => (p ? p + " " + t : t));
    };
    recognitionRef.current = rec;
    try { rec.start(); } catch { showToast("تعذر بدء التسجيل", "error"); }
  }

  const quickChips = ["دهان أبيض", "بورسلان بيج", "رخام فاخر", "إضاءة مخفية", "ألوان داكنة", "خشبي دافئ"];
  function appendChip(c: string) { setPrompt((p) => (p ? p + "، " + c : c)); promptRef.current?.focus(); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (filesRef.current.length === 0) { showToast("أضف صورة واحدة على الأقل", "error"); return; }
    if (!prompt.trim()) { showToast("اكتب أو سجل وصف ما تريد تجديده", "error"); promptRef.current?.focus(); return; }
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    // ensure prompt is in description field (backend expects description)
    fd.set("description", prompt.trim());
    fd.set("contractorNotes", prompt.trim());
    fd.set("clientName", clientName.trim());
    // _step not needed anymore, but send 1 for compat
    fd.set("_step", "1");
    startTransition(() => rawFormAction(fd));
  }

  useEffect(() => { if (state?.error) showToast(state.error, "error"); }, [state?.error, showToast]);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* hidden file input holds actual files for FormData */}
      <input ref={galleryRef} type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onGalleryChange} />
      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onCameraChange} />

      {/* Photos */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
          <span className="text-xs font-extrabold tracking-wide text-ink-soft">صور الغرفة</span>
          <span className="chip bg-teal-soft text-teal border-teal/10">{previews.length}/{MAX_PHOTOS}</span>
          <span className="ml-auto text-xs text-ink-faint hidden sm:inline">اسحب وأفلت أو اختر من المعرض</span>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-3 grid place-items-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragOver ? "border-teal bg-teal-soft" : "border-line-soft bg-paper/40"}`}
        >
          <div className="space-y-2">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-ink text-white text-lg">＋</div>
            <p className="text-sm font-bold text-ink">أضف 1 إلى 4 صور</p>
            <p className="text-xs text-ink-soft">الذكاء سيقدّر المساحة ونوع الغرفة تلقائياً</p>
            <div className="flex gap-2 justify-center pt-1">
              <button type="button" onClick={() => galleryRef.current?.click()} className="btn btn-ghost text-sm">من المعرض</button>
              <button type="button" onClick={() => cameraRef.current?.click()} className="btn btn-ghost text-sm">التقاط</button>
            </div>
          </div>
        </div>

        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {previews.map((src, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`صورة ${i + 1}`} className="h-28 w-full object-cover" />
                <button type="button" onClick={() => removePreview(i)} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink/80 text-white text-xs">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prompt — voice + text */}
      <div className="card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ochre" aria-hidden />
          <span className="text-xs font-extrabold tracking-wide text-ink-soft">ماذا تريد أن تفعل؟</span>
          <span className="text-xs text-ink-faint">صوت أو كتابة</span>
        </div>

        <div className="relative">
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="مثال: صالون، حاب نبدل الأرضية بورسلان بيج 60×60 وندهن الحيطان أبيض مطفي مع إضاءة مخفية..."
            className="w-full resize-none rounded-2xl border border-line bg-white px-3 py-3 pr-12 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/10"
          />
          <button
            type="button"
            onClick={toggleVoice}
            aria-label="تسجيل صوتي"
            className={`absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-xl border text-sm transition-colors ${listening ? "bg-red-500 text-white border-red-600 animate-pulse" : "bg-ink text-white border-ink"}`}
            title={listening ? "جاري التسجيل..." : "تحدث"}
          >
            {listening ? "●" : "🎤"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickChips.map((c) => (
            <button key={c} type="button" onClick={() => appendChip(c)} className="chip chip-ink hover:bg-ink hover:text-white transition-colors text-xs">
              + {c}
            </button>
          ))}
        </div>

        <div className="pt-1">
          <label className="text-xs font-bold text-ink-soft">اسم الزبون (اختياري)</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="مثال: السيد أحمد" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>

        <p className="text-xs text-ink-faint leading-relaxed">
          سنولّد لك <b className="text-ink">تصميمًا واحدًا + سعره</b> مباشرة من صورك ووصفك وكتالوج شركتك. الأسعار من كتالوجك فقط.
        </p>
      </div>

      {state?.error && <div className="card border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}

      <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full gap-2 text-base shadow-sm disabled:opacity-60">
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            <span>يولّد التصميم والسعر…</span>
          </>
        ) : (
          <>
            <span>ولّد التصميم والسعر</span>
            <span aria-hidden>←</span>
          </>
        )}
      </button>

      <p className="text-center text-xs text-ink-faint">قد يستغرق 15-30 ثانية — لا تغلق الصفحة</p>
    </form>
  );
}
