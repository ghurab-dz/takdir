"use client";

import { useCallback, useRef, useState } from "react";

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  altBefore = "قبل",
  altAfter = "بعد (تقريبي)",
}: {
  beforeSrc: string;
  afterSrc: string;
  altBefore?: string;
  altAfter?: string;
}) {
  const [value, setValue] = useState(52);
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setValue(Math.round(pct));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      updateFromClientX(e.clientX);
      e.preventDefault();
    },
    [updateFromClientX]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      updateFromClientX(e.clientX);
    },
    [updateFromClientX]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  return (
    <div
      ref={sliderRef}
      dir="ltr"
      className="ba-slider group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      role="slider"
      aria-label="مقارنة قبل/بعد — اسحب المقبض أو استخدم الأسهم"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          setValue((v) => Math.max(0, v - 3));
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          setValue((v) => Math.min(100, v + 3));
        } else if (e.key === "Home") {
          e.preventDefault();
          setValue(0);
        } else if (e.key === "End") {
          e.preventDefault();
          setValue(100);
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={beforeSrc} alt={altBefore} draggable={false} />
      <div className="ba-after-wrap" style={{ width: `${value}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterSrc} alt={altAfter} draggable={false} style={{ width: `${(100 / (value || 1)) * 100}%` }} />
      </div>
      <span className="ba-badge ba-badge-before">قبل</span>
      <span className="ba-badge ba-badge-after">بعد — تقريبي</span>
      {/* draggable handle — center arrows (explicit LTR, not bidi-sensitive) */}
      <div
        className="ba-handle"
        style={{ left: `${value}%` }}
        aria-hidden
        role="presentation"
        onPointerDown={handlePointerDown}
      >
        <span className="ba-handle-circle" aria-hidden dir="ltr">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className="ba-handle-svg"
          >
            <path d="M10 3l-3 5 3 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 3l3 5-3 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}
