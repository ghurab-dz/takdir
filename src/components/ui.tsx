"use client";

import { useFormStatus } from "react-dom";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Submit button that disables itself while its form's server action runs. */
export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingLabel = "جارٍ الحفظ…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/* ---------------- Toast system ---------------- */
type ToastItem = { id: number; message: string; variant?: "default" | "success" | "error" };
type ToastCtx = { showToast: (message: string, variant?: ToastItem["variant"]) => void };

const ToastContext = createContext<ToastCtx>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal mount guard, standard pattern
  useEffect(() => setMounted(true), []);

  const showToast = useCallback((message: string, variant: ToastItem["variant"] = "default") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="toast-viewport" aria-live="polite" aria-atomic="true">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`toast ${t.variant === "success" ? "toast-success" : t.variant === "error" ? "toast-error" : ""}`}
                role="status"
              >
                {t.variant === "success" && <span aria-hidden>✓</span>}
                <span>{t.message}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

/* ---------------- Bottom Sheet ---------------- */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal mount guard, standard pattern
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" aria-hidden />
        {title && (
          <div className="sheet-header">
            <h2 className="font-display text-base font-extrabold text-ink">{title}</h2>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm px-3" aria-label="إغلاق">
              ✕
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  );
}

/* ---------------- Confirm dialog (replaces native confirm) ---------------- */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[55] grid place-items-center p-4">
      <div className="sheet-backdrop" onClick={onCancel} />
      <div className="card relative z-[56] w-full max-w-sm p-5">
        <h3 className="font-display text-base font-extrabold text-ink">{title}</h3>
        {description && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>}
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={variant === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card p-8 text-center">
      <div className="empty-illustration">{icon ?? <span className="text-2xl">◈</span>}</div>
      <div className="font-display text-lg font-extrabold text-ink">{title}</div>
      {description && <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
