"use client";

import { useRef } from "react";
import {
  addPriceItem,
  deletePriceItem,
  togglePriceItem,
  updateContractorProfile,
  updatePriceItem,
} from "@/actions/prices";
import { SubmitButton } from "./ui";

export interface PriceItemRow {
  id: string;
  category: string;
  itemName: string;
  unit: string;
  unitPrice: number;
  isActive: boolean;
}

const CATEGORY_SUGGESTIONS = ["دهان", "بلاط", "كهرباء", "سباكة", "نجارة", "عام"];
const UNIT_SUGGESTIONS = ["م²", "م.ط", "نقطة", "وحدة", "بالمقطوع"];

export function PriceListEditor({
  contractor,
  items,
}: {
  contractor: { name: string; phone: string };
  items: PriceItemRow[];
}) {
  const addFormRef = useRef<HTMLFormElement>(null);

  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div className="space-y-6">
      {/* ---- contractor profile ---- */}
      <form
        action={async (fd) => {
          await updateContractorProfile(fd);
        }}
        className="card p-4"
      >
        <div className="mb-3 font-display text-sm font-bold text-ink-soft">
          معلوماتك (تظهر على عرض السعر)
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            name="name"
            defaultValue={contractor.name}
            className="field"
            placeholder="اسم المؤسسة / المقاول"
            required
          />
          <input
            name="phone"
            defaultValue={contractor.phone}
            className="field tnum"
            placeholder="الهاتف (مثال: 0555123456)"
            inputMode="tel"
          />
          <SubmitButton>حفظ المعلومات</SubmitButton>
        </div>
      </form>

      {/* ---- add new item ---- */}
      <form
        ref={addFormRef}
        action={async (fd) => {
          const res = await addPriceItem(fd);
          if (res.ok) addFormRef.current?.reset();
          else alert(res.error);
        }}
        className="card border-dashed border-teal/50 p-4"
      >
        <div className="mb-3 font-display text-sm font-bold text-teal">
          + إضافة بند جديد
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1.6fr_0.8fr_0.8fr_auto]">
          <input
            name="category"
            className="field"
            placeholder="الصنف"
            list="cats"
            defaultValue="عام"
          />
          <input name="itemName" className="field" placeholder="اسم البند" required />
          <input name="unit" className="field" placeholder="الوحدة" list="units" />
          <input
            name="unitPrice"
            className="field tnum"
            placeholder="السعر دج"
            inputMode="decimal"
            required
          />
          <SubmitButton>إضافة</SubmitButton>
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

      {/* ---- grouped item list ---- */}
      {categories.map((cat) => (
        <section key={cat} className="card overflow-hidden">
          <div className="border-b border-line bg-paper px-4 py-2 font-display text-sm font-extrabold text-ink">
            {cat}
          </div>
          <ul className="divide-y divide-line">
            {items
              .filter((i) => i.category === cat)
              .map((item) => (
                <li
                  key={item.id}
                  className={`px-4 py-3 ${item.isActive ? "" : "opacity-50"}`}
                >
                  <form
                    action={async (fd) => {
                      const res = await updatePriceItem(item.id, fd);
                      if (!res.ok) alert(res.error);
                    }}
                    className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1.6fr_0.7fr_0.8fr_auto]"
                  >
                    <input type="hidden" name="category" value={item.category} />
                    <input
                      name="itemName"
                      defaultValue={item.itemName}
                      className="field"
                      aria-label="اسم البند"
                    />
                    <input
                      name="unit"
                      defaultValue={item.unit}
                      className="field"
                      list="units"
                      aria-label="الوحدة"
                    />
                    <input
                      name="unitPrice"
                      defaultValue={item.unitPrice}
                      className="field tnum"
                      inputMode="decimal"
                      aria-label="السعر"
                    />
                    <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                      <SubmitButton className="btn btn-ghost text-xs" pendingLabel="…">
                        حفظ
                      </SubmitButton>
                      <button
                        type="button"
                        onClick={() => togglePriceItem(item.id)}
                        className="btn btn-ghost text-xs"
                        title={item.isActive ? "تعطيل البند" : "تفعيل البند"}
                      >
                        {item.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`حذف «${item.itemName}» نهائيًا؟`)) {
                            deletePriceItem(item.id);
                          }
                        }}
                        className="btn btn-danger text-xs"
                      >
                        حذف
                      </button>
                    </div>
                  </form>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <p className="text-xs text-ink-soft">
        البنود المعطّلة لا تُقترح على الذكاء الاصطناعي ولا تدخل في التقديرات الجديدة، لكنها تبقى
        محفوظة. الأسعار الافتراضية الأولى تقريبية — عدّلها بأسعارك الحقيقية.
      </p>
    </div>
  );
}
