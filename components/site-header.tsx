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
    <header className="sticky top-0 z-50 border-b border-[#d9ddd6] bg-[#f4f3ee]/95 backdrop-blur-md">
      <div className="page-container flex min-h-16 items-center justify-between gap-3">
        <Link
          href="/"
          className="shrink-0 rounded-md transition-opacity hover:opacity-75"
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

        <div className="flex min-w-0 items-center gap-1 sm:gap-4">
          <nav aria-label="Primary navigation" className="flex min-w-0 items-center gap-1 sm:gap-2">
            {primaryNavItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.accessibleLabel}
                  className={`inline-flex min-h-11 shrink-0 items-center border-b-2 px-2.5 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                    isActive
                      ? "border-[#176c68] text-[#202927]"
                      : "border-transparent text-[#596762] hover:text-[#176c68]"
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
            className={`hidden min-h-11 items-center border-b-2 px-2 text-sm font-medium transition sm:inline-flex ${
              pathname === "/about"
                ? "border-[#176c68] text-[#202927]"
                : "border-transparent text-[#6d7a76] hover:text-[#176c68]"
            }`}
          >
            About
          </Link>
        </div>
      </div>
    </header>
  );
}
