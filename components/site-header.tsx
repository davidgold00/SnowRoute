"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Logo Icon Component - Clean SVG representation
function SnowRouteIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="group"
    >
      {/* Snowflake icon with modern styling */}
      <defs>
        <linearGradient
          id="snowGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#89d8ff" />
          <stop offset="100%" stopColor="#5dc8ff" />
        </linearGradient>
      </defs>
      
      {/* Main snowflake structure */}
      <g stroke="url(#snowGradient)" strokeWidth="1.5" strokeLinecap="round">
        {/* Vertical line */}
        <line x1="12" y1="2" x2="12" y2="22" />
        
        {/* Horizontal line */}
        <line x1="2" y1="12" x2="22" y2="12" />
        
        {/* Diagonal lines */}
        <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
        <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
        
        {/* Side branches */}
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

// Logo Wordmark Component
function SnowRouteWordmark() {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-lg font-semibold tracking-tight text-white">
        Snow
      </span>
      <span className="text-lg font-semibold tracking-tight bg-gradient-to-r from-cyan-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
        Route
      </span>
    </div>
  );
}

const navItems = [
  {
    href: "/",
    label: "Homepage",
  },
  {
    href: "/analyze-trip",
    label: "Analyze a Trip",
  },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/50 px-4 py-4 sm:px-6 lg:px-8 backdrop-blur-sm bg-slate-950/80">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-8">
          {/* Logo Section */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group transition-opacity hover:opacity-80"
            aria-label="SnowRoute Home"
          >
            <div className="relative">
              {/* Subtle glow effect on icon */}
              <div className="absolute inset-0 bg-cyan-500/20 rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-2 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 transition-all duration-300 group-hover:bg-cyan-500/15 group-hover:border-cyan-500/30">
                <SnowRouteIcon />
              </div>
            </div>
            <SnowRouteWordmark />
          </Link>

          {/* Navigation Section */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? "text-white bg-white/10 border border-white/15"
                      : "text-slate-400 hover:text-slate-300 hover:bg-white/5 border border-transparent"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                  
                  {/* Active indicator line */}
                  {isActive && (
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
