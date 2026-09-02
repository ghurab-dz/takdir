"use client";

import { useMemo, useRef, useState } from "react";
import {
  addPriceItem,
  deletePriceItem,
  togglePriceItem,
  updateContractorProfile,
  updatePriceItem,
} from "@/actions/prices";
import { SubmitButton, BottomSheet, ConfirmDialog, useToast } from "./ui";

export interface PriceItemRow {
  id: string;
  category: string;
  itemName: string;
  unit: string;
  unitPrice: number;
  isActive: boolean;
}

const CATEGORY_SUGGESTIONS = ["دهان", "بلاط", "جبس", "كهرباء", "سباكة", "نجارة", "أرضيات", "ديكور", "عام"];
const UNIT_SUGGESTIONS = ["م²", "م.ط", "نقطة", "وحدة", "بالمقطوع"];

function IconUser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M16 17a4 4 0 0 0-8 0" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={12} cy={9} r={3.2} strokeWidth={1.8} />
    </svg>
  );
}

export function PriceListEditor({
  contractor,
  items,
}: {
  contractor: { name: string; phone: string };
  items: PriceItemRow[];
}) {
  const addFormRef = useRef<HTMLFormElement>(null);
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [editing, setEditing] = useState<PriceItemRow | null>(null);
  const [editDraft, setEditDraft] = useState({ itemName: "", unit: "", unitPrice: "" });
  const [confirmDelete, setConfirmDelete] = useState<PriceItemRow | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("الكل");

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const allCats = useMemo(() => ["الكل", ...categories], [categories]);

  const filteredBySearch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.itemName} ${i.category} ${i.unit}`.toLowerCase().includes(q));
  }, [items, query]);

  const filteredItems = useMemo(() => {
    if (activeCategory === "الكل") return filteredBySearch;
    return filteredBySearch.filter((i) => i.category === activeCategory);
  }, [filteredBySearch, activeCategory]);

  const visibleCategories = useMemo(() => {
    if (activeCategory !== "الكل") return [activeCategory];
    return [...new Set(filteredItems.map((i) => i.category))];
  }, [filteredItems, activeCategory]);

  function openEdit(item: PriceItemRow) {
    setEditing(item);
    setEditDraft({ itemName: item.itemName, unit: item.unit, unitPrice: String(item.unitPrice) });
  }

  return (
    <div className="space-y-5">
      {/* contractor profile */}
      <form
        action={async (fd) => {
          await updateContractorProfile(fd);
          showToast("تم حفظ معلوماتك", "success");
        }}
        className="card p-4 sm:p-5"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-soft text-teal">
            <IconUser className="h-4 w-4" />
          </span>
          <div className="font-display text-sm font-extrabold text-ink">معلوماتك</div>
          <span className="text-xs font-medium text-ink-faint">— تظهر على عرض السعر</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-ink-soft">اسم المؤسسة / المقاول</span>
            <input name="name" defaultValue={contractor.name} className="field" placeholder="مثال: مؤسسة نور للتشطيب" required />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-ink-soft">الهاتف</span>
            <input name="phone" defaultValue={contractor.phone} className="field tnum" placeholder="0555 12 34 56" inputMode="tel" />
          </label>
          <SubmitButton className="btn btn-primary w-full sm:w-auto">حفظ المعلومات</SubmitButton>
        </div>
      </form>

      {/* search + category filter */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-ink-faint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                <circle cx={11} cy={11} r={7} strokeWidth={1.8} />
                <path d="M16 16l4 4" strokeWidth={1.8} strokeLinecap="round" />
              </svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="field pr-9"
              placeholder="ابحث في البنود — مثال: دهان، بلاط، نقطة..."
            />
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {allCats.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCategory(c)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-extrabold border transition-colors ${
                  activeCategory === c ? "bg-teal text-white border-teal shadow-sm" : "bg-white text-ink-soft border-line hover:bg-paper-100"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-ink-faint">{filteredItems.length} بند</span>
            <span className="text-ink-faint hidden sm:inline">اضغط على البند للتعديل — اسحب للتفعيل/التعطيل</span>
          </div>
        </div>
      </div>

      {/* add new item */}
      <form
        ref={addFormRef}
        action={async (fd) => {
          const res = await addPriceItem(fd);
          if (res.ok) {
            addFormRef.current?.reset();
            showToast("تمت إضافة البند", "success");
          } else {
            showToast(res.error ?? "تعذر الإضافة", "error");
          }
        }}
        className="card border-dashed border-teal/40 bg-teal-50/60 p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-teal text-white text-sm leading-none">+</span>
          <span className="font-display text-sm font-extrabold text-teal">إضافة بند جديد</span>
          <span className="hidden text-xs font-medium text-teal/70 sm:inline">— سيُقترح على الذكاء الاصطناعي مباشرة</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.6fr_0.8fr_0.9fr_auto]">
          <label className="grid gap-1">
            <span className="text-[11px] font-bold text-ink-soft">الصنف</span>
            <input name="category" className="field" placeholder="الصنف" list="cats" defaultValue="عام" />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-bold text-ink-soft">اسم البند</span>
            <input name="itemName" className="field" placeholder="مثال: دهان جدران داخلي" required />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-bold text-ink-soft">الوحدة</span>
            <input name="unit" className="field" placeholder="م²" list="units" defaultValue="م²" />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-bold text-ink-soft">السعر (دج)</span>
            <input name="unitPrice" className="field tnum" placeholder="400" inputMode="decimal" required />
          </label>
          <div className="flex items-end">
            <SubmitButton className="btn btn-primary w-full sm:w-auto">إضافة</SubmitButton>
          </div>
        </div>
        <datalist id="cats">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <datalist id="units">
          {UNIT_SUGGESTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </form>

      {/* grouped item list */}
      {visibleCategories.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-sm font-bold text-ink-soft">لا توجد بنود مطابقة</div>
          <p className="mt-1 text-xs text-ink-faint">جرّب كلمة بحث أخرى أو غيّر فلتر الصنف.</p>
        </div>
      ) : (
        visibleCategories.map((cat) => {
          const catItems = filteredItems.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;
          const isOpen = openCat === null ? true : openCat === cat;
          return (
            <section key={cat} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenCat((c) => (c === cat ? "__closed" : cat))}
                className="flex w-full items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3 text-right hover:bg-paper-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-white border border-line text-[11px] font-extrabold text-teal">
                    {cat.slice(0, 2)}
                  </span>
                  <span className="font-display text-sm font-extrabold text-ink">{cat}</span>
                  <span className="chip bg-white border-line text-ink-soft">{catItems.length}</span>
                </div>
                <span className={`grid h-7 w-7 place-items-center rounded-full border bg-white text-ink-soft transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                    <path d="M6 9l6 6 6-6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>

              {isOpen && (
                <ul className="divide-y divide-line-soft">
                  {catItems.map((item) => (
                    <li
                      key={item.id}
                      className={`group relative flex items-center gap-3 px-3 py-3 sm:px-4 transition-colors hover:bg-paper/60 ${item.isActive ? "" : "opacity-55 bg-paper-100/60"}`}
                    >
                      {/* card-like row — tap to edit */}
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="min-w-0 flex-1 text-right"
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-ink group-hover:text-teal transition-colors">{item.itemName}</span>
                          {!item.isActive && <span className="chip chip-ink shrink-0">معطّل</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="chip bg-white border-line text-ink-soft">{item.unit}</span>
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-extrabold text-teal">
                            <span dir="ltr" className="tnum">
                              {new Intl.NumberFormat("en-DZ").format(item.unitPrice)}
                            </span>
                            <span className="text-xs font-bold">دج</span>
                          </span>
                          <span className="text-xs text-ink-faint">/ {item.unit}</span>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="btn btn-ghost btn-sm hidden sm:inline-flex"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await togglePriceItem(item.id);
                            showToast(item.isActive ? "تم تعطيل البند" : "تم تفعيل البند", "success");
                          }}
                          className={`btn btn-sm ${item.isActive ? "btn-ghost" : "btn-primary"}`}
                          title={item.isActive ? "تعطيل" : "تفعيل"}
                        >
                          {item.isActive ? "تعطيل" : "تفعيل"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(item)}
                          className="btn btn-danger btn-sm px-2.5"
                          aria-label="حذف"
                        >
                          حذف
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}

      {/* edit bottom sheet */}
      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title={editing ? `تعديل: ${editing.category}` : ""}>
        {editing && (
          <form
            action={async (fd) => {
              const res = await updatePriceItem(editing.id, fd);
              if (res.ok) {
                showToast("تم حفظ التعديل", "success");
                setEditing(null);
              } else {
                showToast(res.error ?? "تعذر الحفظ", "error");
              }
            }}
            className="space-y-4"
          >
            <input type="hidden" name="category" value={editing.category} />
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-ink-soft">اسم البند</span>
              <input
                name="itemName"
                value={editDraft.itemName}
                onChange={(e) => setEditDraft((d) => ({ ...d, itemName: e.target.value }))}
                className="field"
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-ink-soft">الوحدة</span>
                <input
                  name="unit"
                  value={editDraft.unit}
                  onChange={(e) => setEditDraft((d) => ({ ...d, unit: e.target.value }))}
                  className="field"
                  list="units-sheet"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-ink-soft">السعر (دج)</span>
                <input
                  name="unitPrice"
                  value={editDraft.unitPrice}
                  onChange={(e) => setEditDraft((d) => ({ ...d, unitPrice: e.target.value }))}
                  className="field tnum"
                  inputMode="decimal"
                  required
                />
              </label>
            </div>
            <datalist id="units-sheet">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <div className="flex gap-2 pt-2">
              <SubmitButton className="btn btn-primary flex-1">حفظ التغييرات</SubmitButton>
              <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost flex-1">
                إلغاء
              </button>
            </div>
            <p className="text-center text-xs text-ink-faint">التعديل لا يغيّر عروضًا نهائية سابقة — الأسعار تُنسخ وقت الإنشاء.</p>
          </form>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={!!confirmDelete}
        title={`حذف «${confirmDelete?.itemName ?? ""}» نهائيًا؟`}
        description="سيُحذف البند من قائمتك. العروض المحفوظة ستبقى كما هي."
        confirmLabel="حذف"
        cancelLabel="إبقاء"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          await deletePriceItem(confirmDelete.id);
          showToast("تم حذف البند", "success");
          setConfirmDelete(null);
        }}
      />

      <p className="rounded-xl border border-line bg-card px-4 py-3 text-xs leading-relaxed text-ink-soft shadow-sm">
        <span className="font-bold text-ink">ملاحظة:</span> البنود المعطّلة لا تُقترح على الذكاء الاصطناعي ولا تدخل في التقديرات الجديدة، لكنها تبقى محفوظة. الأسعار الافتراضية تقريبية — عدّلها بأسعارك الحقيقية.
      </p>
    </div>
  );
}
