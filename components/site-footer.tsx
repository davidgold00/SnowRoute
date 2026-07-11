import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#d9ddd6] bg-[#eceee9]">
      <div className="page-container grid gap-7 py-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[#202927]">Plan carefully. Verify locally.</p>
          <p className="mt-2 text-xs leading-5 text-[#596762]">
            SnowRoute provides forecast-based suggestions only; it cannot guarantee safe
            travel or replace official warnings, road conditions, emergency guidance, and
            driver judgment. SnowRoute is not liable for accidents, injuries, property
            damage, delays, or other travel outcomes. Proceed with caution.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#50605b]">
          <Link
            href="/analyze-trip"
            className="inline-flex min-h-11 items-center transition hover:text-[#176c68]"
          >
            New trip
          </Link>
          <Link
            href="/history"
            className="inline-flex min-h-11 items-center transition hover:text-[#176c68]"
          >
            Trip history
          </Link>
          <Link
            href="/about"
            className="inline-flex min-h-11 items-center transition hover:text-[#176c68]"
          >
            About and methodology
          </Link>
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center transition hover:text-[#176c68]"
          >
            Weather data
          </a>
        </nav>
      </div>
    </footer>
  );
}
