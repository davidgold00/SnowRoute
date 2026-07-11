import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#071117]/88">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-slate-100">Plan carefully. Verify locally.</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            SnowRoute provides forecast-based suggestions only; it cannot guarantee safe
            travel or replace official warnings, road conditions, emergency guidance, and
            driver judgment. SnowRoute is not liable for accidents, injuries, property
            damage, delays, or other travel outcomes. Proceed with caution.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
          <Link
            href="/analyze-trip"
            className="inline-flex min-h-11 items-center transition hover:text-white"
          >
            New trip
          </Link>
          <Link
            href="/history"
            className="inline-flex min-h-11 items-center transition hover:text-white"
          >
            Trip history
          </Link>
          <Link
            href="/about"
            className="inline-flex min-h-11 items-center transition hover:text-white"
          >
            About and methodology
          </Link>
        </nav>
      </div>
    </footer>
  );
}
