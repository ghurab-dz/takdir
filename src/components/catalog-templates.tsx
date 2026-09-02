"use client";

import { useState } from "react";
import { applyCatalogTemplate, restoreFullCatalog } from "@/actions/catalog";
import { CATALOG_TEMPLATES } from "@/lib/catalog-templates";
import { useToast } from "./ui";

export function CatalogTemplates({ activeCount, totalCount }: { activeCount: number; totalCount: number }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const isFull = activeCount >= 55;

  async function handleApply(id: string) {
    setLoading(id);
    const fd = new FormData();
    fd.set("templateId", id);
    const res = await applyCatalogTemplate(fd);
    setLoading(null);
    if ((res as { ok: boolean }).ok) showToast("تم تطبيق القالب — عدّل الأسعار حسب سوقك", "success");
    else showToast((res as { error?: string }).error ?? "تعذر تطبيق القالب", "error");
  }
  async function handleRestore() {
    setLoading("full");
    const res = await restoreFullCatalog();
    setLoading(null);
    if ((res as { ok: boolean }).ok) showToast("تمت استعادة الكتالوج الكامل (58 بند)", "success");
    else showToast("تعذر الاستعادة", "error");
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display text-sm font-extrabold text-ink">قوالب جاهزة</div>
          <div className="text-xs text-ink-soft">ابدأ بقالب يناسب تخصصك — كل الأسعار قابلة للتعديل بعد التطبيق.</div>
        </div>
        <span className="chip bg-teal-soft border-teal/20 text-teal font-bold">
          {activeCount} / {totalCount} بند مفعّل
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CATALOG_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleApply(t.id)}
            disabled={loading !== null}
            className="group text-right rounded-2xl border border-line bg-white p-4 hover:border-teal/40 hover:bg-teal-50/40 transition-colors text-right"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xl leading-none">{t.icon}</span>
              <span className="chip bg-paper border-line text-ink-soft text-[11px]">{t.count} بند</span>
            </div>
            <div className="mt-2 font-extrabold text-sm text-ink group-hover:text-teal">{t.title}</div>
            <div className="text-xs text-ink-soft leading-relaxed">{t.subtitle}</div>
            <div className="mt-1 text-[11px] text-ink-faint truncate">{t.categories.join(" · ")}</div>
            {loading === t.id && <div className="mt-2 text-xs font-bold text-teal">جارٍ التطبيق...</div>}
          </button>
        ))}
      </div>

      {!isFull && (
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading !== null}
          className="mt-3 w-full btn btn-ghost text-sm"
        >
          {loading === "full" ? "جارٍ الاستعادة..." : "↩ استعادة الكتالوج الكامل (58 بند)"}
        </button>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
        القالب لا يحذف بنودك — يعطّل فقط البنود خارج القالب. يمكنك إعادة تفعيل أي بند من القائمة أدناه أو استعادة الكامل في أي وقت.
      </p>
    </div>
  );
}
