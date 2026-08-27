"use client";

import { useActionState, useRef, useState } from "react";
import { createEstimate, type CreateEstimateState } from "@/actions/estimates";

const MAX_PHOTOS = 4;

export function NewEstimateForm() {
  const [state, formAction, pending] = useActionState<CreateEstimateState, FormData>(
    createEstimate,
    {},
  );
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].slice(0, MAX_PHOTOS);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  return (
    <form action={formAction} className="space-y-5">
      {/* photos */}
      <div className="card p-4">
        <label className="mb-2 block font-display text-sm font-bold text-ink">
          صور الغرفة <span className="font-normal text-ink-soft">(حتى {MAX_PHOTOS} صور)</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          name="photos"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={onPhotosChange}
          className="field cursor-pointer file:ml-3 file:rounded-md file:border-0 file:bg-teal file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white"
        />
        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`صورة ${i + 1}`}
                className="h-24 w-full rounded-md border border-line object-cover"
              />
            ))}
          </div>
        )}
      </div>

      {/* description */}
      <div className="card p-4">
        <label className="mb-2 block font-display text-sm font-bold text-ink">
          وصف العمل المطلوب
        </label>
        <textarea
          name="description"
          rows={4}
          className="field resize-y"
          placeholder="مثال: غرفة نوم 12 متر مربع، دهان كامل للجدران والسقف، تركيب بلاط جديد للأرضية فوق القديم، مع 4 نقاط كهرباء إضافية…"
        />
        <p className="mt-1 text-xs text-ink-soft">
          كلما كان الوصف أدق (المساحة، نوع الأعمال) كان الاستخراج أدق.
        </p>
      </div>

      {/* client */}
      <div className="card p-4">
        <label className="mb-2 block font-display text-sm font-bold text-ink">
          اسم الزبون <span className="font-normal text-ink-soft">(اختياري — يظهر على العرض)</span>
        </label>
        <input name="clientName" className="field" placeholder="مثال: السيد أحمد بن علي" />
      </div>

      {state.error && (
        <div className="rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-bold text-danger">
          {state.error}
        </div>
      )}

      <button type="submit" className="btn btn-primary w-full py-3 text-base" disabled={pending}>
        {pending ? "يحلّل الصور ويستخرج البنود… (قد يستغرق ثواني)" : "استخرج البنود والكميات ←"}
      </button>
    </form>
  );
}
