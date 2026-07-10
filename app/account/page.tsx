import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Account",
  description: "Optional SnowRoute account availability and precise-location privacy information.",
};

export default function AccountPage() {
  const accountInfrastructureConfigured = Boolean(
    process.env.DATABASE_URL && process.env.AUTH_SECRET && process.env.AUTH_ISSUER,
  );

  return (
    <main className="min-h-screen pb-16 pt-6">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <p className="eyebrow">Optional account</p>
          <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Keep trips available across devices.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                An account is only for convenience. Route analysis, danger windows, departure
                comparisons, and strategy guidance remain available without signing in.
              </p>
              <ul className="mt-6 grid gap-3 text-sm leading-6 text-slate-200 sm:grid-cols-2">
                {[
                  "Sync saved trip summaries across devices",
                  "Re-run a familiar route with fresh forecasts",
                  "Delete individual trips or clear account history",
                  "Keep local guest history until you choose to import it",
                ].map((benefit) => (
                  <li key={benefit} className="rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <aside className="rounded-xl border border-white/10 bg-[#0d2029] p-5">
              <p className="text-sm font-semibold text-white">
                {accountInfrastructureConfigured
                  ? "Account infrastructure detected"
                  : "Accounts are not enabled in this preview"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {accountInfrastructureConfigured
                  ? "The deployment has database and identity settings, but the account UI remains disabled until the configured provider has passed deployment validation."
                  : "A secure database and identity provider have not been configured. SnowRoute will not simulate a login or store credentials insecurely."}
              </p>
              <Link
                href="/analyze-trip"
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#76d5d1] px-4 text-sm font-bold text-[#07161d] transition hover:bg-[#9be4e0]"
              >
                Continue without an account
              </Link>
              <Link
                href="/history"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/12 px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.05]"
              >
                View local trip history
              </Link>
            </aside>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-cyan-100/12 bg-cyan-300/[0.045] p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Precise-location privacy</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
            Saved routes can reveal home, work, and travel patterns. Local guest history stays
            in this browser and is bounded to recent compact summaries. If cloud accounts are
            enabled later, importing local trips will be explicit and optional; saved trips will
            be private by default and removable by the account owner.
          </p>
        </section>
      </div>
    </main>
  );
}
