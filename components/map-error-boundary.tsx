"use client";

import { unstable_catchError as catchError, type ErrorInfo } from "next/error";

function MapFallback(
  _props: { children: React.ReactNode },
  { unstable_retry }: ErrorInfo,
) {
  return (
    <section className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#0d2029] p-6 text-center">
      <div className="max-w-md">
        <p className="text-sm font-semibold text-white">The route map could not load.</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          The textual decision and checkpoint evidence are still available. Map tiles are
          presentation only and do not determine the recommendation.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-5 min-h-11 rounded-xl border border-cyan-100/25 bg-cyan-300/[0.07] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.12]"
        >
          Retry map
        </button>
      </div>
    </section>
  );
}

export const MapErrorBoundary = catchError(MapFallback);
