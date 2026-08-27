import type { Metadata } from "next";
import Link from "next/link";
import { Tajawal, Cairo, Aref_Ruqaa } from "next/font/google";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
});
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["700", "800"],
  variable: "--font-cairo",
});
const ruqaa = Aref_Ruqaa({
  subsets: ["arabic"],
  weight: ["700"],
  variable: "--font-ruqaa",
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
        <header className="no-print border-b border-line bg-card">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-brand text-3xl leading-none text-teal">تقدير</span>
              <span className="hidden text-xs text-ink-soft sm:inline">
                عرض السعر في دقائق
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm font-bold">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 text-ink hover:bg-paper"
              >
                التقديرات
              </Link>
              <Link
                href="/prices"
                className="rounded-md px-3 py-1.5 text-ink hover:bg-paper"
              >
                قائمة الأسعار
              </Link>
              <Link
                href="/estimates/new"
                className="mr-1 rounded-md bg-teal px-3 py-1.5 text-white hover:bg-teal-deep"
              >
                + تقدير جديد
              </Link>
            </nav>
          </div>
          <div className="ruler ruler-teal mx-auto max-w-3xl" />
        </header>

        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

        <footer className="no-print mx-auto max-w-3xl px-4 pb-8 pt-4 text-center text-xs text-ink-soft">
          الأسعار من قائمتك أنت — الذكاء الاصطناعي يستخرج البنود والكميات فقط، ولا يخترع أسعارًا أبدًا.
        </footer>
      </body>
    </html>
  );
}
