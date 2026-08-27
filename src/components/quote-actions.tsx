"use client";

import { useState } from "react";
import Link from "next/link";

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

  return (
    <div className="no-print mb-5 flex flex-col gap-2 sm:flex-row">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary flex-1 py-3"
      >
        إرسال عبر واتساب ←
      </a>
      <button type="button" className="btn btn-ghost flex-1 py-3" onClick={() => window.print()}>
        طباعة / حفظ PDF
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(whatsappText);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "نُسخ ✓" : "نسخ النص"}
      </button>
      <Link href={`/estimates/${estimateId}`} className="btn btn-ghost">
        → رجوع للتعديل
      </Link>
    </div>
  );
}
