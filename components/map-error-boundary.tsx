"use client";

import { unstable_catchError as catchError, type ErrorInfo } from "next/error";

function MapFallback(
  _props: { children: React.ReactNode },
  { unstable_retry }: ErrorInfo,
) {
  return (
    <section className="flex min-h-[420px] items-center justify-center border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] p-6 text-center">
      <div className="max-w-md">
        <p className="text-sm font-semibold text-[var(--color-text)]">The route map could not load.</p>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
          The textual decision and checkpoint evidence are still available. Map tiles are
          presentation only and do not determine the recommendation.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="button-secondary mt-5"
        >
          Retry map
        </button>
      </div>
    </section>
  );
}

export const MapErrorBoundary = catchError(MapFallback);
