import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-16 sm:px-6">
      <section className="surface-panel w-full p-6 sm:p-8">
        <p className="eyebrow">404 · Route not found</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text)]">
          This page is not on the route.
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
          Return to the planner to check a new drive, or open your recent trip history.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/analyze-trip" className="inline-flex min-h-11 items-center rounded-xl bg-[#76d5d1] px-5 text-sm font-bold text-[#07161d] transition hover:bg-[#9be4e0]">
            Open planner
          </Link>
          <Link href="/history" className="button-secondary">
            Trip history
          </Link>
        </div>
      </section>
    </main>
  );
}
