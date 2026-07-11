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
    <main className="min-h-screen pb-16 pt-10">
      <div className="page-container max-w-5xl">
        <section className="border-b border-[var(--color-border)] pb-10">
          <p className="eyebrow">Optional account</p>
          <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
                Keep trips available across devices.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-text-muted)]">
                An account is only for convenience. Route analysis, danger windows, departure
                comparisons, and strategy guidance remain available without signing in.
              </p>
              <ul className="mt-6 grid border-t border-[var(--color-border)] text-sm leading-6 text-[var(--color-text-muted)] sm:grid-cols-2">
                {[
                  "Sync saved trip summaries across devices",
                  "Re-run a familiar route with fresh forecasts",
                  "Delete individual trips or clear account history",
                  "Keep local guest history until you choose to import it",
                ].map((benefit) => (
                  <li key={benefit} className="border-b border-[var(--color-border)] py-3 sm:pr-4 sm:odd:border-r sm:even:pl-4">
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <aside className="feature-surface p-5">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {accountInfrastructureConfigured
                  ? "Account infrastructure detected"
                  : "Accounts are not enabled in this preview"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                {accountInfrastructureConfigured
                  ? "The deployment has database and identity settings, but the account UI remains disabled until the configured provider has passed deployment validation."
                  : "A secure database and identity provider have not been configured. SnowRoute will not simulate a login or store credentials insecurely."}
              </p>
              <Link
                href="/analyze-trip"
                className="button-primary mt-5 w-full"
              >
                Continue without an account
              </Link>
              <Link
                href="/history"
                className="button-secondary mt-3 w-full"
              >
                View local trip history
              </Link>
            </aside>
          </div>
        </section>

        <section className="mt-8 bg-[var(--color-brand-soft)] p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Precise-location privacy</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--color-text-muted)]">
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
