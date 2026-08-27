import Link from "next/link";
import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { formatAmount, formatDate } from "@/lib/format";
import { SectionHeader } from "@/components/section-header";

export const dynamic = "force-dynamic";

function IconFileStack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M14 2H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M14 2v6h6M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  );
}
function IconLayers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M12 3L3 8.5 12 14l9-5.5L12 3z" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M3 12l9 5.5L21 12" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M3 16l9 5.5L21 16" strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}

export default async function DashboardPage() {
  const contractor = await ensureDefaultContractor();
  const [estimates, activeItems] = await Promise.all([
    prisma.estimate.findMany({
      where: { contractorId: contractor.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.priceItem.count({
      where: { contractorId: contractor.id, isActive: true },
    }),
  ]);

  const needsSetup = contractor.name.startsWith("مقاولي");

  return (
    <div>
      <SectionHeader
        eyebrow="لوحة العمل"
        title={`أهلًا، ${contractor.name}`}
        hint="كل تقديراتك الأخيرة في مكان واحد. أنشئ تقديرًا جديدًا بصور الغرفة — يصل العرض خلال دقائق."
      />

      {needsSetup && (
        <div className="card mb-5 overflow-hidden border-ochre/30 bg-ochre-soft p-0">
          <div className="flex gap-3 p-4">
            <div className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-ochre text-white sm:grid">!</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-ochre sm:hidden" />
                <div className="font-display text-sm font-extrabold text-ochre-deep">خطوة أولى قبل الانطلاق</div>
                <span className="chip chip-ochre hidden sm:inline-flex">إعداد 1/2</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">
                عدّل اسم مؤسستك ورقم هاتفك، وراجع قائمة الأسعار الافتراضية وبدّلها بأسعارك الحقيقية — كل التقديرات تُحسب منها حصرًا.
              </p>
              <Link href="/prices" className="btn btn-primary btn-sm mt-3 w-full sm:w-auto">
                ضبط قائمة الأسعار ←
              </Link>
            </div>
          </div>
          <div className="h-1 w-full bg-ochre/20">
            <div className="h-full w-1/2 bg-ochre" />
          </div>
        </div>
      )}

      {/* Metrics — 2 cols on mobile, 3 on desktop */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card card-zellige p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-extrabold tracking-wide text-ink-soft">إجمالي التقديرات</div>
              <div className="tnum mt-1 font-display text-3xl font-extrabold leading-none text-teal sm:text-[1.9rem]">
                {estimates.length}
              </div>
              <div className="mt-1 text-xs font-bold text-ink-faint">آخر 30 عرض</div>
            </div>
            <span className="hidden h-9 w-9 place-items-center rounded-xl bg-teal-soft text-teal sm:grid">
              <IconFileStack className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-extrabold tracking-wide text-ink-soft">بنود في قائمتك</div>
              <div className="tnum mt-1 font-display text-3xl font-extrabold leading-none text-ink sm:text-[1.9rem]">
                {activeItems}
              </div>
              <div className="mt-1 text-xs font-bold text-ink-faint">نشطة وجاهزة</div>
            </div>
            <span className="hidden h-9 w-9 place-items-center rounded-xl bg-paper-100 text-ink-soft sm:grid">
              <IconLayers className="h-5 w-5" />
            </span>
          </div>
        </div>

        <Link
          href="/estimates/new"
          className="card card-hover col-span-2 flex flex-col items-center justify-center gap-2 border-dashed border-teal/45 bg-teal-50 p-4 text-teal sm:col-span-1"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-teal text-white shadow-sm sm:h-11 sm:w-11">
            <span className="text-xl font-extrabold leading-none">+</span>
          </span>
          <div className="text-center">
            <div className="text-sm font-extrabold">تقدير جديد</div>
            <div className="mt-0.5 hidden text-xs font-medium text-teal/80 sm:block">صوّر الغرفة وابدأ</div>
            <div className="mt-0.5 text-xs font-medium text-teal/80 sm:hidden">صوّر • صف • استخرج</div>
          </div>
        </Link>
      </div>

      {estimates.length === 0 ? (
        <div className="card p-6 text-center sm:p-8">
          <div className="empty-illustration">
            <IconFileStack className="h-7 w-7" />
          </div>
          <div className="font-display text-lg font-extrabold text-ink">لا توجد تقديرات بعد</div>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            ارفع صور الغرفة واكتب وصفًا قصيرًا، وسيستخرج التطبيق البنود والكميات من قائمة أسعارك خلال ثوانٍ.
          </p>
          <Link href="/estimates/new" className="btn btn-primary mt-5 w-full sm:w-auto">
            ابدأ أول تقدير ←
          </Link>
          <p className="mt-3 text-xs text-ink-faint">لا حاجة لإدخال أسعار — التطبيق يستخدم قائمتك حصرًا.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-extrabold text-ink">التقديرات الأخيرة</h2>
            <span className="text-xs font-bold text-ink-faint">{estimates.length} عرض</span>
          </div>

          {estimates.map((e) => {
            const total = e.items.reduce((s, i) => s + Number(i.lineTotal), 0);
            return (
              <Link
                key={e.id}
                href={`/estimates/${e.id}`}
                className="card card-hover card-interactive group flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-display text-[15px] font-extrabold text-ink group-hover:text-teal transition-colors">
                      {e.clientName || e.roomType || "تقدير بدون اسم"}
                    </div>
                    <span
                      className={
                        e.status === "final"
                          ? "chip chip-teal shrink-0"
                          : "chip chip-ochre shrink-0"
                      }
                    >
                      {e.status === "final" ? "نهائي" : "مسودة"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-ink-faint" aria-hidden />
                      {formatDate(e.createdAt)}
                    </span>
                    {e.roomType && (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-ink-faint" aria-hidden />
                        {e.roomType}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-ink-faint" aria-hidden />
                      {e.items.length} بند
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3 sm:border-0 sm:pt-0 sm:justify-end">
                  <div className="whitespace-nowrap font-display text-lg font-extrabold text-teal">
                    <span dir="ltr" className="tnum">
                      {formatAmount(total)}
                    </span>{" "}
                    <span className="text-sm">دج</span>
                  </div>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-paper-100 text-ink-soft transition-colors group-hover:bg-teal group-hover:text-white sm:h-7 sm:w-7">
                    <span aria-hidden className="text-sm font-bold">‹</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
