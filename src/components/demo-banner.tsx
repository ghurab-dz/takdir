import { prisma } from "@/lib/db";

export async function DemoBanner() {
  // Never show in production — MVP is price-list only + empty CTA
  if (process.env.NODE_ENV === "production") return null;
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "";
  if (!isMock) return null;

  // Count demo data to show
  let estimateCount = 0;
  try {
    const contractor = await prisma.contractor.findFirst({ orderBy: { createdAt: "asc" } });
    if (contractor) {
      const estimates = await prisma.estimate.findMany({ where: { contractorId: contractor.id } });
      estimateCount = estimates.length;
    }
  } catch {}

  return (
    <div className="mx-auto max-w-3xl px-4 pt-3">
      <div className="flex flex-col gap-2 rounded-xl border border-teal/20 bg-teal-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="hidden h-7 w-7 shrink-0 place-items-center rounded-full bg-teal text-white sm:grid text-sm" aria-hidden>
            ✦
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal sm:hidden" aria-hidden />
              <span className="text-sm font-extrabold text-teal">وضع التجربة — بيانات وهمية</span>
              <span className="chip chip-teal hidden sm:inline-flex">demo</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              قائمة أسعار ابتدائية (<span className="font-bold text-ink">58</span> بند) جاهزة كقالب — 9 أصناف (دهان/بلاط/جبس/كهرباء/سباكة/نجارة/أرضيات/ديكور/عام) مع 174 خامة ×3 درجات — عدّل الأسعار لأسعارك الحقيقية ثم أنشئ أول تقدير. اللوحة فارغة حتى الإنشاء.
              {" "}بدون قاعدة بيانات — محفوظة في <span className="font-mono text-[11px] bg-white border border-line px-1 py-0.5 rounded">data/mock-db.json</span>
              {estimateCount > 0 && (
                <> — يوجد <span className="font-bold text-ink">{estimateCount}</span> تقدير حاليًا.</>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip bg-white border-line text-ink-soft">✓ 58 بند مسعّر (قالب قابل للتعديل)</span>
              <span className="chip bg-white border-line text-ink-soft">✓ واتساب/طباعة جاهز</span>
              <span className="chip bg-white border-line text-ink-soft">✓ ابدأ فارغًا — CTA أول تقدير</span>
            </div>
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            const { resetMockStore } = await import("@/lib/mock-db");
            resetMockStore();
            const { ensureDefaultContractor } = await import("@/lib/seed");
            await ensureDefaultContractor();
            const { revalidatePath } = await import("next/cache");
            revalidatePath("/");
            revalidatePath("/prices");
          }}
          className="shrink-0"
        >
          <button type="submit" className="btn btn-ghost btn-sm w-full sm:w-auto">
            إعادة تعيين البيانات
          </button>
        </form>
      </div>
      <div className="mt-3 rounded-lg border border-ochre/20 bg-ochre-soft px-3 py-2 text-xs leading-relaxed text-ink">
        <span className="font-bold text-ochre-deep">كيف تجرب كأنك مقاول حقيقي:</span> 1) اذهب لـ <span className="font-bold">قائمة الأسعار</span> وعدّل سعرًا → 2) أنشئ <span className="font-bold">تقدير جديد</span> بوصف مثل: &quot;غرفة 12م² دهان + بلاط + 4 نقاط كهرباء&quot; → 3) راجع البنود → 4) اعتمد وشاهد العرض القابل للطباعة.
      </div>
    </div>
  );
}
