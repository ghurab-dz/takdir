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
import { SubmitButton, ConfirmDialog, useToast } from "./ui";

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

function Stepper({
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper-btn"
        aria-label="إنقاص"
        onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
      >
        −
      </button>
      <input
        value={String(value)}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="stepper-value bg-transparent text-sm focus:outline-none w-[64px]"
        inputMode="decimal"
        aria-label="الكمية"
      />
      <button type="button" className="stepper-btn" aria-label="زيادة" onClick={() => onChange(Math.round((value + step) * 100) / 100)}>
        +
      </button>
    </div>
  );
}

export function EstimateEditor({
  estimate,
  pricelist,
}: {
  estimate: EstimateData;
  pricelist: PricelistLite[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [rows, setRows] = useState<EstimateItemRow[]>(estimate.items);
  const [addMode, setAddMode] = useState<"list" | "free">("list");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteEstimateOpen, setDeleteEstimateOpen] = useState(false);
  const [searchPrice, setSearchPrice] = useState("");

  const total = useMemo(() => rows.reduce((s, r) => s + Math.round(r.quantity * r.unitPrice * 100) / 100, 0), [rows]);
  const unmatched = rows.filter((r) => !r.matched);

  const filteredPricelist = useMemo(() => {
    const q = searchPrice.trim().toLowerCase();
    if (!q) return pricelist;
    return pricelist.filter((p) => `${p.itemName} ${p.category}`.toLowerCase().includes(q));
  }, [pricelist, searchPrice]);

  function patchRow(id: string, patch: Partial<EstimateItemRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-5 pb-2">
      {/* photos */}
      {estimate.photoPaths.length > 0 && (
        <div className="card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-extrabold text-ink-soft">صور الغرفة</span>
            <span className="chip bg-white border-line text-ink-soft">{estimate.photoPaths.length} صور</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
            {estimate.photoPaths.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="صورة الغرفة" className="h-24 w-24 shrink-0 snap-start rounded-xl border border-line object-cover shadow-sm" />
            ))}
          </div>
        </div>
      )}

      {/* AI notes */}
      {estimate.aiNotes && (
        <div className="flex gap-3 rounded-xl border border-teal/20 bg-teal-50 px-4 py-3 text-sm leading-relaxed text-ink">
          <span className="hidden h-7 w-7 shrink-0 place-items-center rounded-full bg-teal text-white sm:grid" aria-hidden>
            ✦
          </span>
          <div>
            <span className="font-extrabold text-teal">ملاحظات التحليل: </span>
            <span>{estimate.aiNotes}</span>
          </div>
        </div>
      )}

      {/* meta */}
      <form action={(fd) => updateEstimateMeta(estimate.id, fd)} className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
          <span className="text-xs font-extrabold tracking-wide text-ink-soft">بيانات العرض</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_0.7fr_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-bold text-ink-soft">اسم الزبون</span>
            <input name="clientName" defaultValue={estimate.clientName} className="field" placeholder="السيد أحمد" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-bold text-ink-soft">نوع الغرفة</span>
            <input name="roomType" defaultValue={estimate.roomType} className="field" placeholder="مطبخ، حمام، صالون…" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-bold text-ink-soft">المساحة م²</span>
            <input name="areaM2" defaultValue={estimate.areaM2 ?? ""} className="field tnum" placeholder="12" inputMode="decimal" />
          </label>
          <SubmitButton className="btn btn-ghost w-full sm:w-auto">حفظ</SubmitButton>
        </div>
      </form>

      {/* unmatched warning — actionable */}
      {unmatched.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-ochre/25 bg-ochre-soft px-4 py-3">
          <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-ochre text-white sm:grid">!</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-ochre-deep">
              {unmatched.length} بند غير مطابق لقائمتك
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink">أدخل سعرًا يدويًا لكل بند مميّز بالبرتقالي، أو احذفه قبل اعتماد العرض. الأسعار غير المطابقة لن تُحسب بدقة.</p>
          </div>
        </div>
      )}

      {/* ===== DESKTOP LEDGER (≥768px) ===== */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[1.35fr_0.5fr_0.55fr_0.7fr_0.75fr_84px] gap-2 border-b border-line bg-paper px-3 py-2.5 text-[11px] font-extrabold tracking-wide text-ink-soft">
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
                action={(fd) => {
                  updateEstimateItem(r.id, fd);
                  showToast("تم حفظ البند", "success");
                }}
                className={`grid grid-cols-[1.35fr_0.5fr_0.55fr_0.7fr_0.75fr_84px] gap-2 border-b border-line-soft px-3 py-3 items-center transition-colors ${
                  r.matched ? "hover:bg-paper/40" : "bg-ochre-soft/55 hover:bg-ochre-soft/75"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{r.itemName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className={r.source === "ai_extracted" ? "chip chip-teal" : "chip chip-ink"}>{r.source === "ai_extracted" ? "مستخرج آليًا" : "يدوي"}</span>
                    {!r.matched && <span className="chip chip-ochre">غير مطابق</span>}
                  </div>
                </div>

                <input
                  name="quantity"
                  value={String(r.quantity)}
                  onChange={(e) => patchRow(r.id, { quantity: parseFloat(e.target.value) || 0 })}
                  className="field tnum min-w-0 px-2 py-1.5 text-center text-sm"
                  inputMode="decimal"
                  aria-label="الكمية"
                />
                <input name="unit" value={r.unit} onChange={(e) => patchRow(r.id, { unit: e.target.value })} className="field min-w-0 px-2 py-1.5 text-center text-sm" aria-label="الوحدة" />
                <input
                  name="unitPrice"
                  value={String(r.unitPrice)}
                  onChange={(e) => patchRow(r.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                  className={`field tnum min-w-0 px-2 py-1.5 text-center text-sm ${r.matched ? "" : "border-ochre"}`}
                  inputMode="decimal"
                  placeholder="0"
                  aria-label="سعر الوحدة"
                />
                <div className="whitespace-nowrap text-center text-sm font-extrabold text-ink">
                  <span dir="ltr" className="tnum">
                    {formatAmount(Math.round(r.quantity * r.unitPrice * 100) / 100)}
                  </span>{" "}
                  <span className="text-xs">دج</span>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <SubmitButton className="btn btn-ghost btn-sm px-2.5" pendingLabel="…">
                    حفظ
                  </SubmitButton>
                  <button type="button" className="btn btn-danger btn-sm px-2.5" onClick={() => setDeleteId(r.id)}>
                    حذف
                  </button>
                </div>
                <input type="hidden" name="itemName" value={r.itemName} />
              </form>
            ))}
          </div>
        </div>

        {/* add item desktop */}
        <div className="border-t border-line bg-paper/60 p-3">
          <div className="mb-2.5 flex gap-2">
            <div className="segmented" role="group" aria-label="نوع الإضافة">
              <button type="button" aria-pressed={addMode === "list"} onClick={() => setAddMode("list")} className="segmented-btn">
                من قائمتك
              </button>
              <button type="button" aria-pressed={addMode === "free"} onClick={() => setAddMode("free")} className="segmented-btn">
                بند حر
              </button>
            </div>
            {addMode === "list" && (
              <input value={searchPrice} onChange={(e) => setSearchPrice(e.target.value)} placeholder="ابحث في قائمتك..." className="field max-w-[220px] text-sm py-1.5" />
            )}
          </div>
          <form
            action={async (fd) => {
              await addEstimateItem(estimate.id, fd);
              showToast("تمت إضافة البند", "success");
              setSearchPrice("");
            }}
          >
            {addMode === "list" ? (
              <div className="grid grid-cols-[1fr_0.4fr_auto] items-center gap-2">
                <select name="priceItemId" className="field text-sm" required>
                  {filteredPricelist.length === 0 ? (
                    <option disabled>لا نتائج</option>
                  ) : (
                    filteredPricelist.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.itemName} — {formatDZD(p.unitPrice)}/{p.unit} ({p.category})
                      </option>
                    ))
                  )}
                </select>
                <input name="quantity" defaultValue="1" className="field tnum min-w-0 text-sm" inputMode="decimal" aria-label="الكمية" />
                <SubmitButton className="btn btn-ghost px-3 py-1.5 text-xs">إضافة</SubmitButton>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_0.5fr_0.6fr_0.4fr_auto]">
                <input type="hidden" name="priceItemId" value="" />
                <input name="itemName" className="field text-sm" placeholder="اسم البند" required />
                <input name="unit" className="field text-sm" placeholder="الوحدة" defaultValue="وحدة" />
                <input name="unitPrice" className="field tnum min-w-0 text-sm" placeholder="السعر" inputMode="decimal" required />
                <input name="quantity" defaultValue="1" className="field tnum min-w-0 text-sm" inputMode="decimal" aria-label="الكمية" />
                <SubmitButton className="btn btn-ghost px-3 py-1.5 text-xs">إضافة</SubmitButton>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* ===== MOBILE CARDS (<768px) ===== */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-extrabold text-ink">بنود التقدير</h3>
          <span className="chip bg-white border-line text-ink-soft">{rows.length} بند</span>
        </div>

        {rows.map((r) => {
          const line = Math.round(r.quantity * r.unitPrice * 100) / 100;
          return (
            <div key={r.id} className={`card p-3 ${r.matched ? "" : "border-ochre/40 bg-ochre-soft/30"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold leading-tight text-ink">{r.itemName}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className={r.source === "ai_extracted" ? "chip chip-teal" : "chip chip-ink"}>{r.source === "ai_extracted" ? "آلي" : "يدوي"}</span>
                    {!r.matched && <span className="chip chip-ochre">غير مطابق — أدخل سعرًا</span>}
                  </div>
                </div>
                <button type="button" onClick={() => setDeleteId(r.id)} className="btn btn-danger btn-sm px-2.5 shrink-0" aria-label="حذف البند">
                  حذف
                </button>
              </div>

              <form
                action={(fd) => {
                  updateEstimateItem(r.id, fd);
                  showToast("تم حفظ البند", "success");
                }}
                className="mt-3 space-y-3"
              >
                <input type="hidden" name="itemName" value={r.itemName} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-[11px] font-bold text-ink-soft">الكمية</span>
                    <Stepper value={r.quantity} onChange={(v) => patchRow(r.id, { quantity: v })} />
                    <input type="hidden" name="quantity" value={String(r.quantity)} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-bold text-ink-soft">الوحدة</span>
                    <input name="unit" value={r.unit} onChange={(e) => patchRow(r.id, { unit: e.target.value })} className="field text-center text-sm" />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-[11px] font-bold text-ink-soft">سعر الوحدة (دج)</span>
                  <input
                    name="unitPrice"
                    value={String(r.unitPrice)}
                    onChange={(e) => patchRow(r.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                    className={`field tnum text-center font-bold ${r.matched ? "" : "border-ochre bg-ochre-soft/40"}`}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </label>

                <div className="flex items-center justify-between rounded-xl bg-paper-100 px-3 py-2.5 border border-line-soft">
                  <span className="text-xs font-bold text-ink-soft">المجموع</span>
                  <span className="whitespace-nowrap font-display text-base font-extrabold text-ink">
                    <span dir="ltr" className="tnum">
                      {formatAmount(line)}
                    </span>{" "}
                    دج
                  </span>
                </div>

                <SubmitButton className="btn btn-ghost w-full">حفظ التغييرات</SubmitButton>
              </form>
            </div>
          );
        })}

        {/* add item mobile */}
        <div className="card p-3">
          <div className="segmented w-full" role="group" aria-label="نوع الإضافة">
            <button type="button" aria-pressed={addMode === "list"} onClick={() => setAddMode("list")} className="segmented-btn flex-1">
              من قائمتك
            </button>
            <button type="button" aria-pressed={addMode === "free"} onClick={() => setAddMode("free")} className="segmented-btn flex-1">
              بند حر
            </button>
          </div>

          {addMode === "list" && (
            <div className="mt-3">
              <input value={searchPrice} onChange={(e) => setSearchPrice(e.target.value)} placeholder="ابحث — دهان، بلاط..." className="field text-sm" />
            </div>
          )}

          <form
            action={async (fd) => {
              await addEstimateItem(estimate.id, fd);
              showToast("تمت إضافة البند", "success");
              setSearchPrice("");
            }}
            className="mt-3"
          >
            {addMode === "list" ? (
              <div className="space-y-3">
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-ink-soft">اختر من قائمتك</span>
                  <select name="priceItemId" className="field text-sm" required size={1}>
                    {filteredPricelist.length === 0 ? (
                      <option disabled>لا نتائج — جرّب بحثًا آخر</option>
                    ) : (
                      filteredPricelist.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.itemName} — {formatDZD(p.unitPrice)}/{p.unit}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-ink-soft">الكمية</span>
                  <input name="quantity" defaultValue="1" className="field tnum text-center" inputMode="decimal" />
                </label>
                <SubmitButton className="btn btn-primary w-full">إضافة البند</SubmitButton>
              </div>
            ) : (
              <div className="space-y-3">
                <input type="hidden" name="priceItemId" value="" />
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-ink-soft">اسم البند</span>
                  <input name="itemName" className="field text-sm" placeholder="مثال: تنظيف ورش" required />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-bold text-ink-soft">الوحدة</span>
                    <input name="unit" className="field text-sm" placeholder="وحدة" defaultValue="وحدة" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-bold text-ink-soft">السعر</span>
                    <input name="unitPrice" className="field tnum text-sm" placeholder="0" inputMode="decimal" required />
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-ink-soft">الكمية</span>
                  <input name="quantity" defaultValue="1" className="field tnum text-center" inputMode="decimal" />
                </label>
                <SubmitButton className="btn btn-primary w-full">إضافة بند حر</SubmitButton>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* total */}
      <div className="card p-4 hidden md:block">
        <div className="ruler mb-3 opacity-30" />
        <div className="flex items-center justify-between gap-4">
          <span className="font-display text-lg font-extrabold text-ink">المجموع الكلي</span>
          <span className="whitespace-nowrap font-display text-2xl font-extrabold text-ochre">
            <span dir="ltr" className="tnum">
              {formatAmount(total)}
            </span>{" "}
            دج
          </span>
        </div>
      </div>

      {/* sticky total mobile */}
      <div className="sticky-total -mx-4 flex items-center justify-between gap-3 sm:mx-0 md:hidden">
        <div>
          <div className="text-xs font-bold text-ink-soft">المجموع الكلي</div>
          <div className="whitespace-nowrap font-display text-xl font-extrabold text-ochre">
            <span dir="ltr" className="tnum">
              {formatAmount(total)}
            </span>{" "}
            دج
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary shrink-0 px-5"
          onClick={async () => {
            await setEstimateStatus(estimate.id, "final");
            showToast("تم اعتماد العرض", "success");
            router.push(`/estimates/${estimate.id}/quote`);
          }}
        >
          اعتماد ←
        </button>
      </div>

      {/* actions desktop */}
      <div className="hidden gap-2 md:flex">
        <button
          type="button"
          className="btn btn-primary flex-1 py-3 text-base"
          onClick={async () => {
            await setEstimateStatus(estimate.id, "final");
            showToast("تم اعتماد العرض — جارٍ فتح صفحة الطباعة", "success");
            router.push(`/estimates/${estimate.id}/quote`);
          }}
        >
          اعتماد وتوليد عرض السعر ←
        </button>
        <button type="button" className="btn btn-danger" onClick={() => setDeleteEstimateOpen(true)}>
          حذف التقدير
        </button>
      </div>
      <div className="md:hidden">
        <button type="button" className="btn btn-ghost w-full text-sm" onClick={() => setDeleteEstimateOpen(true)}>
          حذف هذا التقدير نهائيًا
        </button>
      </div>

      {/* dialogs */}
      <ConfirmDialog
        open={!!deleteId}
        title="حذف هذا البند؟"
        description="سيُحذف البند من التقدير. لا يمكن التراجع."
        confirmLabel="حذف"
        cancelLabel="إبقاء"
        variant="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          await deleteEstimateItem(deleteId);
          showToast("تم حذف البند", "success");
          setDeleteId(null);
          setRows((rs) => rs.filter((r) => r.id !== deleteId));
        }}
      />
      <ConfirmDialog
        open={deleteEstimateOpen}
        title="حذف هذا التقدير نهائيًا؟"
        description="سيُحذف التقدير وكل بنوده. لا يمكن التراجع."
        confirmLabel="حذف نهائي"
        cancelLabel="إلغاء"
        variant="danger"
        onCancel={() => setDeleteEstimateOpen(false)}
        onConfirm={async () => {
          await deleteEstimate(estimate.id);
          showToast("تم حذف التقدير", "success");
        }}
      />
    </div>
  );
}
