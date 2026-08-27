"use client";

import { useFormStatus } from "react-dom";

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
