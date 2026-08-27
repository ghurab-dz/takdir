/** Section header with the measuring-tape ruler signature strip. */
export function SectionHeader({
  eyebrow,
  title,
  hint,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4">
      {eyebrow && (
        <div className="mb-1 text-xs font-bold tracking-wide text-teal">{eyebrow}</div>
      )}
      <h1 className="font-display text-2xl font-extrabold text-ink">{title}</h1>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      <div className="ruler mt-3" />
    </div>
  );
}
