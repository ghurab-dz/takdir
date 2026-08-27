/** Section header with the measuring-tape ruler signature strip. */
export function SectionHeader({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      {eyebrow && (
        <div className="mb-1.5 inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
          <span className="text-[11px] font-extrabold tracking-[0.12em] text-teal uppercase">{eyebrow}</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[1.6rem] font-extrabold leading-tight text-ink sm:text-2xl">{title}</h1>
          {hint && <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">{hint}</p>}
        </div>
        {action && <div className="shrink-0 hidden sm:block">{action}</div>}
      </div>
      <div className="ruler ruler-animated mt-4" />
    </div>
  );
}
