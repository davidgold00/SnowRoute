"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SnowRouteLogo } from "@/components/snowroute-logo";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/analyze-trip", label: "Analyze a trip" },
  { href: "/history", label: "History", accessibleLabel: "Trip history" },
  { href: "/about", label: "About" },
  { href: "/account", label: "Account" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[#28414c] bg-[#08161d]/95 px-4 py-3 backdrop-blur-lg sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 sm:flex-nowrap sm:gap-6">
        <div className="flex items-center">
          <Link
            href="/"
            className="rounded-lg transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
            aria-label="Go to homepage"
          >
            <SnowRouteLogo />
          </Link>
        </div>

        <nav aria-label="Primary navigation" className="flex w-full min-w-0 items-center gap-1 overflow-x-auto sm:w-auto sm:overflow-visible">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.accessibleLabel}
                className={`shrink-0 rounded-lg border px-2.5 py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 sm:px-3 sm:text-sm ${
                  isActive
                    ? "border-cyan-200/30 bg-cyan-300/[0.1] text-white"
                    : "border-transparent text-slate-300 hover:bg-white/[0.05] hover:text-white"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
