import Link from "next/link";
import { prisma } from "@/lib/db";
import { ensureDefaultContractor } from "@/lib/seed";
import { formatAmount, formatDate } from "@/lib/format";
import { SectionHeader } from "@/components/section-header";

export const dynamic = "force-dynamic";

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
        hint="كل تقديراتك الأخيرة في مكان واحد."
      />

      {needsSetup && (
        <div className="card mb-5 border-ochre/50 bg-ochre-soft p-4">
          <div className="font-display font-bold text-ochre">خطوة أولى قبل الانطلاق</div>
          <p className="mt-1 text-sm text-ink">
            عدّل اسم مؤسستك ورقم هاتفك، وراجع قائمة الأسعار الافتراضية وبدّلها بأسعارك الحقيقية —
            كل التقديرات تُحسب منها حصريًا.
          </p>
          <Link href="/prices" className="btn btn-primary mt-3">
            ضبط قائمة الأسعار ←
          </Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="tnum font-display text-3xl font-extrabold text-teal">
            {estimates.length}
          </div>
          <div className="mt-1 text-xs font-bold text-ink-soft">تقدير</div>
        </div>
        <div className="card p-4 text-center">
          <div className="tnum font-display text-3xl font-extrabold text-teal">
            {activeItems}
          </div>
          <div className="mt-1 text-xs font-bold text-ink-soft">بند في قائمتك</div>
        </div>
        <Link
          href="/estimates/new"
          className="card flex flex-col items-center justify-center gap-1 border-dashed border-teal/60 p-4 text-teal transition-colors hover:bg-teal hover:text-white"
        >
          <div className="text-2xl font-extrabold">+</div>
          <div className="text-xs font-bold">تقدير جديد</div>
        </Link>
      </div>

      {estimates.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="font-display text-lg font-bold">لا توجد تقديرات بعد</div>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            ارفع صور الغرفة واكتب وصفًا قصيرًا، وسيستخرج التطبيق البنود والكميات من قائمة أسعارك
            خلال ثوانٍ.
          </p>
          <Link href="/estimates/new" className="btn btn-primary mt-4">
            ابدأ أول تقدير ←
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {estimates.map((e) => {
            const total = e.items.reduce((s, i) => s + Number(i.lineTotal), 0);
            return (
              <Link
                key={e.id}
                href={`/estimates/${e.id}`}
                className="card flex items-center justify-between gap-3 p-4 transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="font-display font-bold text-ink">
                    {e.clientName || e.roomType || "تقدير بدون اسم"}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-soft">
                    {formatDate(e.createdAt)}
                    {e.roomType ? ` — ${e.roomType}` : ""}
                    {` — ${e.items.length} بند`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="whitespace-nowrap font-display text-lg font-extrabold text-teal">
                    <span dir="ltr" className="tnum">
                      {formatAmount(total)}
                    </span>{" "}
                    دج
                  </div>
                  <span
                    className={
                      e.status === "final"
                        ? "chip bg-teal/10 text-teal"
                        : "chip bg-ochre-soft text-ochre"
                    }
                  >
                    {e.status === "final" ? "نهائي" : "مسودة"}
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
