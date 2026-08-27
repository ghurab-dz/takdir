"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addEstimateItem,
  deleteEstimate,
  deleteEstimateItem,
  setEstimateStatus,
  updateEstimateItem,
  updateEstimateMeta,
} from "@/actions/estimates";
import { formatAmount, formatDZD } from "@/lib/format";
import { SubmitButton } from "./ui";

interface EstimateItemRow {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  matched: boolean;
  source: string;
}

interface EstimateData {
  id: string;
  clientName: string;
  roomType: string;
  areaM2: number | null;
  status: string;
  aiNotes: string | null;
  photoPaths: string[];
  createdAt: string;
  items: EstimateItemRow[];
}

interface PricelistLite {
  id: string;
  itemName: string;
  unit: string;
  unitPrice: number;
  category: string;
}

export function EstimateEditor({
  estimate,
  pricelist,
}: {
  estimate: EstimateData;
  pricelist: PricelistLite[];
}) {
  const router = useRouter();
  // The server page passes a key derived from the items, so this component
  // remounts with fresh state whenever revalidation brings new data.
  const [rows, setRows] = useState<EstimateItemRow[]>(estimate.items);
  const [addMode, setAddMode] = useState<"list" | "free">("list");

  const total = useMemo(
    () => rows.reduce((s, r) => s + Math.round(r.quantity * r.unitPrice * 100) / 100, 0),
    [rows],
  );
  const unmatched = rows.filter((r) => !r.matched);

  function patchRow(id: string, patch: Partial<EstimateItemRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-5">
      {/* photos */}
      {estimate.photoPaths.length > 0 && (
        <div className="card p-3">
          <div className="flex gap-2 overflow-x-auto">
            {estimate.photoPaths.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt="صورة الغرفة"
                className="h-20 rounded-md border border-line object-cover"
              />
            ))}
          </div>
        </div>
      )}

      {/* AI notes */}
      {estimate.aiNotes && (
        <div className="rounded-md border border-teal/30 bg-teal/5 px-4 py-3 text-sm text-ink">
          <span className="font-bold text-teal">ملاحظات التحليل: </span>
          {estimate.aiNotes}
        </div>
      )}

      {/* meta */}
      <form
        action={(fd) => updateEstimateMeta(estimate.id, fd)}
        className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_1fr_0.6fr_auto]"
      >
        <input
          name="clientName"
          defaultValue={estimate.clientName}
          className="field"
          placeholder="اسم الزبون"
        />
        <input
          name="roomType"
          defaultValue={estimate.roomType}
          className="field"
          placeholder="نوع الغرفة (مطبخ، حمام…)"
        />
        <input
          name="areaM2"
          defaultValue={estimate.areaM2 ?? ""}
          className="field tnum"
          placeholder="المساحة م²"
          inputMode="decimal"
        />
        <SubmitButton className="btn btn-ghost">حفظ</SubmitButton>
      </form>

      {/* unmatched warning */}
      {unmatched.length > 0 && (
        <div className="rounded-md border border-ochre/50 bg-ochre-soft px-4 py-3 text-sm">
          <span className="font-bold text-ochre">
            {unmatched.length} بند غير مطابق لقائمتك
          </span>{" "}
          — أدخل له سعرًا يدويًا أو احذفه قبل اعتماد العرض.
        </div>
      )}

      {/* items ledger — div grid so every column aligns with its header */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            {/* header — same grid as rows */}
            <div className="grid grid-cols-[1.35fr_0.5fr_0.55fr_0.7fr_0.75fr_84px] gap-2 border-b border-line bg-paper px-3 py-2 text-[11px] font-bold tracking-wide text-ink-soft">
              <div className="text-right">البند</div>
              <div className="text-center">الكمية</div>
              <div className="text-center">الوحدة</div>
              <div className="text-center">سعر الوحدة</div>
              <div className="text-center">المجموع</div>
              <div />
            </div>

            {rows.map((r) => (
              <form
                key={r.id}
                action={(fd) => updateEstimateItem(r.id, fd)}
                className={`grid grid-cols-[1.35fr_0.5fr_0.55fr_0.7fr_0.75fr_84px] gap-2 border-b border-line px-3 py-3 items-center ${
                  r.matched ? "" : "bg-ochre-soft/60"
                }`}
              >
                {/* البند */}
                <div className="min-w-0">
                  <div className="truncate font-bold">{r.itemName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span
                      className={
                        r.source === "ai_extracted"
                          ? "chip bg-teal/10 text-teal"
                          : "chip bg-ink/10 text-ink-soft"
                      }
                    >
                      {r.source === "ai_extracted" ? "مستخرج آليًا" : "يدوي"}
                    </span>
                    {!r.matched && (
                      <span className="chip bg-ochre/15 text-ochre">غير مطابق</span>
                    )}
                  </div>
                </div>

                {/* الكمية */}
                <input
                  name="quantity"
                  value={String(r.quantity)}
                  onChange={(e) =>
                    patchRow(r.id, { quantity: parseFloat(e.target.value) || 0 })
                  }
                  className="field tnum min-w-0 px-2 py-1.5 text-center text-sm"
                  inputMode="decimal"
                  aria-label="الكمية"
                />
                {/* الوحدة */}
                <input
                  name="unit"
                  value={r.unit}
                  onChange={(e) => patchRow(r.id, { unit: e.target.value })}
                  className="field min-w-0 px-2 py-1.5 text-center text-sm"
                  aria-label="الوحدة"
                />
                {/* سعر الوحدة */}
                <input
                  name="unitPrice"
                  value={String(r.unitPrice)}
                  onChange={(e) =>
                    patchRow(r.id, { unitPrice: parseFloat(e.target.value) || 0 })
                  }
                  className={`field tnum min-w-0 px-2 py-1.5 text-center text-sm ${
                    r.matched ? "" : "border-ochre"
                  }`}
                  inputMode="decimal"
                  placeholder="0"
                  aria-label="سعر الوحدة"
                />
                {/* المجموع — number LTR then دج after (left side in RTL) */}
                <div className="whitespace-nowrap text-center text-sm font-bold">
                  <span dir="ltr" className="tnum">
                    {formatAmount(Math.round(r.quantity * r.unitPrice * 100) / 100)}
                  </span>{" "}
                  <span>دج</span>
                </div>
                {/* actions */}
                <div className="flex items-center justify-center gap-1">
                  <SubmitButton className="btn btn-ghost px-2 py-1 text-xs" pendingLabel="…">
                    حفظ
                  </SubmitButton>
                  <button
                    type="button"
                    className="btn btn-danger px-2 py-1 text-xs"
                    onClick={() => deleteEstimateItem(r.id)}
                  >
                    حذف
                  </button>
                </div>
                <input type="hidden" name="itemName" value={r.itemName} />
              </form>
            ))}
          </div>
        </div>

        {/* add item */}
        <div className="border-t border-line bg-paper/60 p-3">
          <div className="mb-2 flex gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setAddMode("list")}
              className={`rounded-md px-3 py-1 ${addMode === "list" ? "bg-teal text-white" : "bg-card border border-line"}`}
            >
              من قائمتك
            </button>
            <button
              type="button"
              onClick={() => setAddMode("free")}
              className={`rounded-md px-3 py-1 ${addMode === "free" ? "bg-teal text-white" : "bg-card border border-line"}`}
            >
              بند حر
            </button>
          </div>
          <form action={(fd) => addEstimateItem(estimate.id, fd)}>
            {addMode === "list" ? (
              <div className="grid grid-cols-[1fr_0.4fr_auto] items-center gap-2">
                <select name="priceItemId" className="field text-sm">
                  {pricelist.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.itemName} — {formatDZD(p.unitPrice)}/{p.unit}
                    </option>
                  ))}
                </select>
                <input
                  name="quantity"
                  defaultValue="1"
                  className="field tnum min-w-0 text-sm"
                  inputMode="decimal"
                  aria-label="الكمية"
                />
                <SubmitButton className="btn btn-ghost px-3 py-1.5 text-xs">إضافة</SubmitButton>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_0.5fr_0.6fr_0.4fr_auto]">
                <input type="hidden" name="priceItemId" value="" />
                <input name="itemName" className="field text-sm" placeholder="اسم البند" required />
                <input name="unit" className="field text-sm" placeholder="الوحدة" defaultValue="وحدة" />
                <input
                  name="unitPrice"
                  className="field tnum min-w-0 text-sm"
                  placeholder="السعر"
                  inputMode="decimal"
                  required
                />
                <input
                  name="quantity"
                  defaultValue="1"
                  className="field tnum min-w-0 text-sm"
                  inputMode="decimal"
                  aria-label="الكمية"
                />
                <SubmitButton className="btn btn-ghost px-3 py-1.5 text-xs">إضافة</SubmitButton>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* total — دج after the number */}
      <div className="card p-4">
        <div className="ruler mb-3" />
        <div className="flex items-center justify-between gap-4">
          <span className="font-display text-lg font-extrabold">المجموع الكلي</span>
          <span className="whitespace-nowrap font-display text-2xl font-extrabold text-ochre">
            <span dir="ltr" className="tnum">
              {formatAmount(total)}
            </span>{" "}
            دج
          </span>
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn btn-primary flex-1 py-3"
          onClick={async () => {
            await setEstimateStatus(estimate.id, "final");
            router.push(`/estimates/${estimate.id}/quote`);
          }}
        >
          اعتماد وتوليد عرض السعر ←
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (confirm("حذف هذا التقدير نهائيًا؟")) deleteEstimate(estimate.id);
          }}
        >
          حذف التقدير
        </button>
      </div>
    </div>
  );
}
