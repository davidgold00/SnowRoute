"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("SnowRoute page error", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-16 sm:px-6">
      <section className="surface-panel w-full p-6 sm:p-8">
        <p className="eyebrow">Unexpected interruption</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text)]">
          This view could not finish loading.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--color-text-muted)]">
          Your route details should remain on this device. Try the view again, or return to
          the planner and submit once more.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-[var(--color-text-faint)]">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="min-h-11 rounded-xl bg-[#76d5d1] px-5 text-sm font-bold text-[#07161d] transition hover:bg-[#9be4e0]"
          >
            Try again
          </button>
          <Link
            href="/analyze-trip"
            className="button-secondary"
          >
            Return to planner
          </Link>
        </div>
      </section>
    </main>
  );
}
