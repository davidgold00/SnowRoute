import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#071117]/88">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-slate-100">Plan carefully. Verify locally.</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            SnowRoute provides forecast-based planning suggestions, not a guarantee of safe
            travel. It does not replace official weather warnings, road closures, emergency
            guidance, or driver judgment. Conditions can change quickly; proceed with caution.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
          <Link href="/about" className="transition hover:text-white">How it works</Link>
          <Link href="/history" className="transition hover:text-white">Trip history</Link>
          <Link href="/account" className="transition hover:text-white">Account</Link>
        </nav>
      </div>
    </footer>
  );
}
