"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "./ui";

export function QuoteActions({
  estimateId,
  whatsappUrl,
  whatsappText,
}: {
  estimateId: string;
  whatsappUrl: string;
  whatsappText: string;
}) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      showToast("تم نسخ نص العرض", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("تعذر النسخ — انسخ يدويًا من المعاينة", "error");
    }
  }

  return (
    <div className="no-print mb-5 space-y-3">
      {/* primary */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-lg w-full gap-2 text-base shadow-sm"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
          <path d="M19.05 4.94A9.82 9.82 0 0 0 12.04 2C6.58 2 2.14 6.45 2.14 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.26-1.38a9.86 9.86 0 0 0 4.78 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7zM12.05 20.1h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.12.82.83-3.04-.2-.31A8.26 8.26 0 0 1 3.8 11.91c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.42 5.83c0 4.55-3.7 8.24-8.24 8.24zm6.72-6.18c-.37-.19-2.2-1.09-2.54-1.21-.34-.13-.59-.19-.84.19s-.97 1.21-1.19 1.46-.43.28-.8.09c-.37-.19-1.56-.58-2.97-1.84-1.1-.98-1.84-2.19-2.06-2.56-.22-.37-.02-.57.16-.76.16-.16.37-.43.56-.64.18-.22.25-.37.37-.62.12-.25.06-.46-.03-.64-.09-.19-.84-2.02-1.15-2.77-.3-.72-.61-.62-.84-.63l-.72-.01c-.25 0-.64.09-.98.46-.34.37-1.29 1.26-1.29 3.08s1.32 3.57 1.5 3.82c.19.25 2.6 3.97 6.29 5.57.88.38 1.57.61 2.1.78.88.28 1.68.24 2.31.15.71-.11 2.2-.9 2.51-1.77.31-.87.31-1.61.22-1.77-.09-.16-.34-.25-.71-.43z" />
        </svg>
        إرسال عبر واتساب
        <span aria-hidden>←</span>
      </a>

      {/* secondary row — 3 up on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-row">
        <button type="button" className="btn btn-ghost gap-1.5 sm:flex-1" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" strokeWidth={1.7} strokeLinejoin="round" />
            <path d="M6 14h12v6H6z" strokeWidth={1.7} />
          </svg>
          <span className="hidden sm:inline">طباعة / حفظ PDF</span>
          <span className="sm:hidden">طباعة</span>
        </button>

        <button type="button" className="btn btn-ghost gap-1.5 sm:flex-1" onClick={handleCopy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <rect x={9} y={9} width={11} height={11} rx={2} strokeWidth={1.7} />
            <path d="M15 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" strokeWidth={1.7} strokeLinejoin="round" />
          </svg>
          <span>{copied ? "نُسخ ✓" : "نسخ"}</span>
        </button>

        <Link href={`/estimates/${estimateId}`} className="btn btn-ghost gap-1.5">
          <span aria-hidden>→</span>
          <span className="hidden sm:inline">رجوع للتعديل</span>
          <span className="sm:hidden">تعديل</span>
        </Link>
      </div>

      <p className="text-center text-xs font-medium text-ink-faint">يُفتح واتساب مع نص العرض جاهزًا — اختر الزبون ثم أرسل.</p>
    </div>
  );
}
