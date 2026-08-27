// Formatting helpers — pure functions (unit-tested).

/** Format a money amount as grouped digits only: 12400 -> "12 400" */
export function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const [intPart, fracPart] = String(rounded).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped}${fracPart ? "." + fracPart : ""}`;
}

/** Format a money amount in Algerian Dinars: 12400 -> "12 400 دج" */
export function formatDZD(amount: number): string {
  return `${formatAmount(amount)} دج`;
}

/** Format a quantity: 12.50 -> "12.5", 3 -> "3" */
export function formatQty(qty: number): string {
  const rounded = Math.round(qty * 100) / 100;
  return String(rounded);
}

/** Today's date in a formal Arabic-friendly format: 2026-08-27 */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
