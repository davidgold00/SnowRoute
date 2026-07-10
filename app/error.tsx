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
      <section className="glass-panel w-full rounded-2xl p-6 sm:p-8">
        <p className="eyebrow">Unexpected interruption</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          This view could not finish loading.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
          Your route details should remain on this device. Try the view again, or return to
          the planner and submit once more.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-slate-400">Reference: {error.digest}</p>
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
            className="inline-flex min-h-11 items-center rounded-xl border border-white/12 px-5 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.05]"
          >
            Return to planner
          </Link>
        </div>
      </section>
    </main>
  );
}
