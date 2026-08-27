import type { Metadata } from "next";
import Link from "next/link";
import { Tajawal, Cairo, Aref_Ruqaa } from "next/font/google";
import "./globals.css";
import { MobileNav } from "@/components/mobile-nav";
import { ToastProvider } from "@/components/ui";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
  display: "swap",
});
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["700", "800"],
  variable: "--font-cairo",
  display: "swap",
});
const ruqaa = Aref_Ruqaa({
  subsets: ["arabic"],
  weight: ["700"],
  variable: "--font-ruqaa",
  display: "swap",
});

export const metadata: Metadata = {
  title: "تقدير — عروض أسعار التشطيبات في دقائق",
  description:
    "ارفع صور الغرفة مع وصف قصير، ويستخرج لك التطبيق بنود العمل وكمياتها مطابقةً لقائمة أسعارك — عرض سعر جاهز للإرسال عبر واتساب.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} ${cairo.variable} ${ruqaa.variable}`}
    >
      <body className="min-h-screen antialiased">
        <ToastProvider>
          {/* Header — desktop nav, mobile compact */}
          <header className="no-print sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
              <Link href="/" className="flex items-baseline gap-2.5 shrink-0">
                <span className="font-brand text-[1.7rem] leading-none tracking-tight text-teal sm:text-3xl">
                  تقدير
                </span>
                <span className="hidden text-[11px] font-bold tracking-wide text-ink-soft sm:inline">
                  عرض السعر في دقائق
                </span>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden items-center gap-1 text-sm font-bold sm:flex">
                <Link href="/" className="rounded-lg px-3 py-2 text-ink hover:bg-paper transition-colors">
                  التقديرات
                </Link>
                <Link href="/prices" className="rounded-lg px-3 py-2 text-ink hover:bg-paper transition-colors">
                  قائمة الأسعار
                </Link>
                <Link
                  href="/estimates/new"
                  className="mr-1 inline-flex items-center gap-1 rounded-lg bg-teal px-4 py-2 text-white shadow-sm hover:bg-teal-deep transition-colors"
                >
                  <span className="text-lg leading-none">+</span> تقدير جديد
                </Link>
              </nav>

              {/* Mobile: minimal badge */}
              <span className="sm:hidden inline-flex items-center rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-extrabold text-teal border border-teal/10">
                سحب • قياس • تسعير
              </span>
            </div>
            <div className="ruler ruler-teal ruler-animated mx-auto max-w-3xl" />
          </header>

          {/* Main — add bottom padding on mobile for bottom-nav */}
          <main className="mx-auto max-w-3xl px-4 py-5 pb-28 sm:pb-6 sm:py-6">{children}</main>

          <footer className="no-print mx-auto max-w-3xl px-4 pb-28 sm:pb-8 pt-2 text-center">
            <div className="mx-auto max-w-xl rounded-xl border border-line bg-card px-4 py-3 shadow-sm">
              <p className="text-xs font-medium leading-relaxed text-ink-soft">
                <span className="font-bold text-teal">الأسعار من قائمتك أنت</span> — الذكاء الاصطناعي يستخرج البنود والكميات فقط، ولا يخترع أسعارًا أبدًا.
              </p>
            </div>
          </footer>

          {/* Mobile bottom nav + FAB */}
          <MobileNav />
        </ToastProvider>
      </body>
    </html>
  );
}
