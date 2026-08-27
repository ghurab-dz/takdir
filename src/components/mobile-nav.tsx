"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M3 10L12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}
function IconList(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M8 6h11M8 12h11M8 18h11M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
    </svg>
  );
}
function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeWidth={2.2} />
    </svg>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isPrices = pathname?.startsWith("/prices");
  const isNew = pathname?.startsWith("/estimates/new");

  return (
    <nav className="bottom-nav sm:hidden no-print" aria-label="التنقل الرئيسي">
      <div className="bottom-nav-inner">
        <Link
          href="/"
          aria-current={isHome ? "page" : undefined}
          className="bottom-nav-link"
        >
          <IconHome />
          <span>التقديرات</span>
        </Link>

        <Link href="/estimates/new" className="bottom-nav-fab" aria-label="تقدير جديد">
          <span className="bottom-nav-fab-circle" aria-hidden>
            <IconPlus className="h-6 w-6" />
          </span>
          <span className="bottom-nav-fab-label">جديد</span>
        </Link>

        <Link
          href="/prices"
          aria-current={isPrices ? "page" : undefined}
          className="bottom-nav-link"
        >
          <IconList />
          <span>قائمة الأسعار</span>
        </Link>
      </div>
      {/* active indicator for new page */}
      {isNew && <div className="ruler ruler-teal h-[3px] opacity-60" />}
    </nav>
  );
}
