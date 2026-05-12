"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function SnowRouteIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-transform duration-300"
    >
      <defs>
        <linearGradient id="snowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#89d8ff" />
          <stop offset="100%" stopColor="#5dc8ff" />
        </linearGradient>
      </defs>

      <g stroke="url(#snowGradient)" strokeWidth="1.5" strokeLinecap="round">
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
        <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
        <line x1="8" y1="4" x2="12" y2="8" />
        <line x1="16" y1="8" x2="12" y2="12" />
        <line x1="12" y1="12" x2="16" y2="16" />
        <line x1="8" y1="16" x2="12" y2="12" />
        <line x1="4" y1="8" x2="8" y2="12" />
        <line x1="12" y1="8" x2="8" y2="4" />
      </g>
    </svg>
  );
}

function SnowRouteWordmark() {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-lg font-semibold tracking-tight text-white">Snow</span>
      <span className="bg-gradient-to-r from-cyan-200 via-sky-200 to-cyan-300 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
        Route
      </span>
    </div>
  );
}

const navItems = [
  { href: "/", label: "Homepage" },
  { href: "/analyze-trip", label: "Analyze a Trip" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#071012]/78 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 sm:flex-nowrap sm:gap-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-xl transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
            aria-label="Go to homepage"
          >
            <div className="rounded-xl border border-cyan-200/18 bg-cyan-300/8 p-2">
              <div className="group-hover:rotate-12">
                <SnowRouteIcon />
              </div>
            </div>
            <SnowRouteWordmark />
            <span className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-semibold text-slate-200 sm:inline-flex">
              Home
            </span>
          </Link>
        </div>

        <nav className="flex w-full min-w-0 items-center gap-2 overflow-x-auto sm:w-auto sm:overflow-visible">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg border px-2.5 py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 sm:px-3 sm:text-sm ${
                  isActive
                    ? "border-cyan-200/35 bg-cyan-300/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_0_1px_rgba(125,211,252,0.08)]"
                    : "border-transparent text-slate-300 hover:bg-white/6 hover:text-white"
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
