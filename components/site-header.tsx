"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SnowRouteLogo } from "@/components/snowroute-logo";

const primaryNavItems = [
  { href: "/analyze-trip", label: "New trip" },
  { href: "/history", label: "History", accessibleLabel: "Trip history" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[#28414c] bg-[#08161d]/95 px-4 py-3 backdrop-blur-lg sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 sm:gap-6">
        <Link
          href="/"
          className="shrink-0 rounded-lg transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
          aria-label="SnowRoute home"
          aria-current={pathname === "/" ? "page" : undefined}
        >
          <span className="sm:hidden">
            <SnowRouteLogo compact />
          </span>
          <span className="hidden sm:inline-flex">
            <SnowRouteLogo />
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <nav aria-label="Primary navigation" className="flex min-w-0 items-center gap-1">
            {primaryNavItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.accessibleLabel}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-lg border px-2.5 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 sm:px-3 sm:text-sm ${
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
          <Link
            href="/about"
            aria-current={pathname === "/about" ? "page" : undefined}
            className={`hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 sm:inline-flex ${
              pathname === "/about"
                ? "bg-white/[0.07] text-white"
                : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            About
          </Link>
        </div>
      </div>
    </header>
  );
}
