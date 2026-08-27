// WhatsApp quote sharing — pure functions (unit-tested).

export interface QuoteLine {
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface QuoteTextInput {
  contractorName: string;
  contractorPhone?: string | null;
  clientName?: string | null;
  roomType?: string | null;
  date: string;
  lines: QuoteLine[];
  total: number;
}

function fmtMoney(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [intPart, fracPart] = (Math.abs(rounded % 1) > 1e-9
    ? rounded.toFixed(2)
    : rounded.toFixed(0)
  ).split(".");
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (fracPart ? "." + fracPart : "");
}

/** Build the plain-text quote that gets sent over WhatsApp. */
export function buildQuoteText(q: QuoteTextInput): string {
  const out: string[] = [];
  out.push(`عرض سعر — ${q.contractorName}`);
  if (q.contractorPhone) out.push(`الهاتف: ${q.contractorPhone}`);
  out.push(`التاريخ: ${q.date}`);
  if (q.clientName) out.push(`الزبون: ${q.clientName}`);
  if (q.roomType) out.push(`المكان: ${q.roomType}`);
  out.push("———————————————");
  q.lines.forEach((l, i) => {
    out.push(
      `${i + 1}. ${l.itemName} — ${l.quantity} ${l.unit} × ${fmtMoney(l.unitPrice)} = ${fmtMoney(l.lineTotal)} دج`,
    );
  });
  out.push("———————————————");
  out.push(`المجموع الكلي: ${fmtMoney(q.total)} دج`);
  out.push("— أُعدّ هذا العرض عبر تطبيق تقدير");
  return out.join("\n");
}

/** wa.me link. With a phone: opens that chat. Without: lets the user pick a contact. */
export function buildWhatsAppLink(text: string, phone?: string | null): string {
  const encoded = encodeURIComponent(text);
  const digits = phone ? phone.replace(/[^\d]/g, "") : "";
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
