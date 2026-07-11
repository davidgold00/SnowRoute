"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { useGuestTripHistory } from "@/hooks/use-guest-trip-history";
import {
  getGuestTripLocationLabel,
  guestTripUsesCityFallback,
  queueGuestTripRestore,
  type GuestTripHistoryEntry,
} from "@/lib/guest-trip-history";

const DECISION_TREATMENT: Record<
  GuestTripHistoryEntry["decision"],
  { symbol: string; className: string }
> = {
  GO: { symbol: "✓", className: "border-emerald-700/25 bg-emerald-50 text-emerald-800" },
  CAUTION: { symbol: "!", className: "border-amber-700/25 bg-amber-50 text-amber-800" },
  DELAY: { symbol: "↻", className: "border-orange-700/25 bg-orange-50 text-orange-800" },
  HOLD: { symbol: "Ⅱ", className: "border-orange-700/25 bg-orange-50 text-orange-800" },
  AVOID: { symbol: "×", className: "border-rose-700/25 bg-rose-50 text-rose-800" },
};

function formatAnalyzedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(minutes: number) {
  const roundedMinutes = Math.max(1, Math.round(minutes));
  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  return `${hours} hr${hours === 1 ? "" : "s"}${remainingMinutes ? ` ${remainingMinutes} min` : ""}`;
}

function TripHistoryCard({
  trip,
  isExpanded,
  isConfirmingDelete,
  onAnalyzeAgain,
  onToggleExpanded,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  trip: GuestTripHistoryEntry;
  isExpanded: boolean;
  isConfirmingDelete: boolean;
  onAnalyzeAgain: () => void;
  onToggleExpanded: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const treatment = DECISION_TREATMENT[trip.decision];
  const originLabel = getGuestTripLocationLabel(trip, "origin");
  const destinationLabel = getGuestTripLocationLabel(trip, "destination");
  const usesOriginFallback = guestTripUsesCityFallback(trip, "origin");
  const usesDestinationFallback = guestTripUsesCityFallback(trip, "destination");
  const deleteDialogTitleId = useId();
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingDeleteRef = useRef(false);

  useEffect(() => {
    if (isConfirmingDelete) {
      cancelDeleteButtonRef.current?.focus();
    } else if (wasConfirmingDeleteRef.current) {
      deleteButtonRef.current?.focus();
    }

    wasConfirmingDeleteRef.current = isConfirmingDelete;
  }, [isConfirmingDelete]);

  return (
    <article className="border-b border-[var(--color-border)] py-6 first:border-t">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.12em] ${treatment.className}`}
            >
              <span aria-hidden="true">{treatment.symbol}</span>
              {trip.decision}
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
              Previous forecast
            </span>
          </div>

          <h2 className="mt-4 break-words text-xl font-semibold tracking-tight text-[var(--color-text)] sm:text-2xl">
            {originLabel}
            <span className="sr-only"> to </span>
            <span className="mx-2 text-slate-500" aria-hidden="true">→</span>
            {destinationLabel}
          </h2>
          {trip.requiresCityConfirmation ? (
            <p className="mt-2 max-w-2xl text-xs leading-5 text-amber-800">
              This legacy route predates city-first search. Its labels and coordinates were
              preserved, but both cities must be confirmed before a new analysis.
            </p>
          ) : usesOriginFallback || usesDestinationFallback ? (
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-faint)]">
              {[usesOriginFallback ? "Starting point uses an approximate city point" : null,
                usesDestinationFallback ? "destination uses an approximate city point" : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {trip.waypoints.length > 0 ? (
            <p className="mt-2 text-sm text-[var(--color-text-faint)]">
              Via {trip.waypoints.map((waypoint) => waypoint.label).join(" and ")}
            </p>
          ) : null}

          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--color-text-faint)]">
            <div className="flex gap-1.5">
              <dt className="font-semibold text-[var(--color-text-muted)]">Route</dt>
              <dd>{Math.round(trip.distanceKm)} km · {formatDuration(trip.durationMinutes)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold text-[var(--color-text-muted)]">Risk</dt>
              <dd>{trip.overallRisk}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold text-[var(--color-text-muted)]">Confidence</dt>
              <dd>{trip.confidence}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold text-[var(--color-text-muted)]">Planned departure</dt>
              <dd>{trip.departureTimeLocal.replace("T", " at ")} · {trip.timeZone}</dd>
            </div>
          </dl>

          <p className="mt-3 text-xs leading-5 text-[var(--color-text-faint)]">
            <span className="font-semibold text-[var(--color-text-muted)]">Main factor:</span>{" "}
            {trip.mainHazards[0] ?? "No dominant hazard recorded"}
          </p>

          <p className="mt-4 text-xs leading-5 text-amber-800">
            Analyzed <time dateTime={trip.analyzedAt}>{formatAnalyzedAt(trip.analyzedAt)}</time>.
            Forecasts and road conditions change; analyze again for current conditions.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-52 lg:justify-end">
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={isExpanded}
            className="button-secondary"
          >
            {isExpanded ? "Close summary" : "Open summary"}
          </button>
          <button
            type="button"
            onClick={onAnalyzeAgain}
            className="button-primary"
          >
            Analyze again
          </button>
          {!isConfirmingDelete ? (
            <button
              ref={deleteButtonRef}
              type="button"
              onClick={onRequestDelete}
              className="min-h-11 rounded-md border border-[var(--color-border-strong)] bg-white px-4 text-sm font-semibold text-[var(--color-text-muted)] transition hover:border-rose-400 hover:text-rose-800"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {isExpanded ? (
        <section className="mt-5 bg-[var(--color-surface-subtle)] p-4" aria-label="Saved analysis summary">
          <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-muted)]">{trip.decisionSummary}</p>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Worst segment</dt>
              <dd className="mt-1 leading-5 text-[var(--color-text-muted)]">
                {trip.worstSegmentRisk} risk {trip.worstSegmentLocationLabel}, expected around {trip.worstSegmentArrivalTime}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Main factors</dt>
              <dd className="mt-1 leading-5 text-[var(--color-text-muted)]">
                {trip.mainHazards.length > 0 ? trip.mainHazards.join(" · ") : "No dominant hazard recorded"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[11px] leading-5 text-[var(--color-text-faint)]">
            Risk model {trip.riskModelVersion} · Locations: {trip.geocoderProvider}
          </p>
        </section>
      ) : null}

      {isConfirmingDelete ? (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={deleteDialogTitleId}
          className="mt-5 flex flex-col gap-3 border border-rose-300 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p id={deleteDialogTitleId} className="text-sm text-rose-900">
            Remove this trip from this device?
          </p>
          <div className="flex gap-2">
            <button
              ref={cancelDeleteButtonRef}
              type="button"
              onClick={onCancelDelete}
              className="button-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="min-h-11 rounded-lg bg-rose-200 px-3 text-sm font-bold text-rose-950 hover:bg-rose-100"
            >
              Delete trip
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function TripHistory() {
  const router = useRouter();
  const { trips, isLoading, error, remove, clear } = useGuestTripHistory();
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const clearDialogTitleId = useId();
  const clearHistoryButtonRef = useRef<HTMLButtonElement>(null);
  const cancelClearButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingClearRef = useRef(false);

  useEffect(() => {
    if (isConfirmingClear) {
      cancelClearButtonRef.current?.focus();
    } else if (wasConfirmingClearRef.current) {
      clearHistoryButtonRef.current?.focus();
    }

    wasConfirmingClearRef.current = isConfirmingClear;
  }, [isConfirmingClear]);

  function analyzeAgain(trip: GuestTripHistoryEntry) {
    if (!queueGuestTripRestore(trip)) {
      setActionError(
        "This browser could not prepare the saved trip. Keep this page open and check whether site storage is blocked.",
      );
      return;
    }

    setActionError(null);
    router.push("/analyze-trip");
  }

  return (
    <main className="min-h-screen pb-16 pt-10">
      <div className="page-container max-w-5xl">
        <header className="border-b border-[var(--color-border)] pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow">Trip history</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
                Recent analyses on this device
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-muted)] sm:text-base">
                SnowRoute keeps up to 20 recent routes in this browser so you can quickly
                analyze them again. This history is not uploaded or synced.
              </p>
            </div>
            {trips.length > 0 && !isConfirmingClear ? (
              <button
                ref={clearHistoryButtonRef}
                type="button"
                onClick={() => {
                  setActionError(null);
                  setIsConfirmingClear(true);
                }}
                className="button-secondary shrink-0 hover:border-rose-400 hover:text-rose-800"
              >
                Clear history
              </button>
            ) : null}
          </div>
        </header>

        {isConfirmingClear ? (
          <section
            role="alertdialog"
            aria-modal="false"
            aria-labelledby={clearDialogTitleId}
            className="mt-5 border border-rose-300 bg-rose-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-5"
          >
            <div>
              <h2 id={clearDialogTitleId} className="font-semibold text-rose-900">
                Clear all recent trips?
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">This removes every saved analysis from this browser.</p>
            </div>
            <div className="mt-4 flex gap-2 sm:mt-0">
              <button
                ref={cancelClearButtonRef}
                type="button"
                onClick={() => setIsConfirmingClear(false)}
                className="button-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void clear();
                  setIsConfirmingClear(false);
                }}
                className="min-h-11 rounded-lg bg-rose-200 px-3 text-sm font-bold text-rose-950 hover:bg-rose-100"
              >
                Clear history
              </button>
            </div>
          </section>
        ) : null}

        {actionError ?? error ? (
          <div role="alert" className="mt-5 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {actionError ?? error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-6 space-y-4" role="status" aria-live="polite">
            <span className="sr-only">Loading recent trips.</span>
            <div aria-hidden="true" className="space-y-4">
              {[0, 1].map((item) => (
                <div key={item} className="h-52 border border-[var(--color-border)] bg-[var(--color-surface-subtle)] motion-safe:animate-pulse" />
              ))}
            </div>
          </div>
        ) : trips.length === 0 ? (
          <section className="mt-6 border border-dashed border-[var(--color-border-strong)] bg-white px-5 py-14 text-center sm:px-8">
            <div className="mx-auto text-3xl text-[var(--color-brand)]" aria-hidden="true">
              ↻
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[var(--color-text)]">No recent trips on this device</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-text-muted)]">
              Analyze a route and its decision summary will appear here automatically.
            </p>
            <button
              type="button"
              onClick={() => router.push("/analyze-trip")}
              className="button-primary mt-6"
            >
              Analyze a trip
            </button>
          </section>
        ) : (
          <section className="mt-6 space-y-4" aria-label="Recent trip analyses">
            {trips.map((trip) => (
              <TripHistoryCard
                key={trip.id}
                trip={trip}
                isExpanded={expandedTripId === trip.id}
                isConfirmingDelete={confirmingDeleteId === trip.id}
                onAnalyzeAgain={() => analyzeAgain(trip)}
                onToggleExpanded={() =>
                  setExpandedTripId((currentId) => currentId === trip.id ? null : trip.id)
                }
                onRequestDelete={() => setConfirmingDeleteId(trip.id)}
                onCancelDelete={() => setConfirmingDeleteId(null)}
                onDelete={() => {
                  void remove(trip.id);
                  setConfirmingDeleteId(null);
                }}
              />
            ))}
          </section>
        )}

        <aside className="mt-6 bg-[var(--color-brand-soft)] px-5 py-4 text-xs leading-5 text-[var(--color-text-muted)]">
          <p className="font-semibold text-[var(--color-brand)]">Stored locally for privacy</p>
          <p className="mt-1">
            Recent trips stay in this browser and may be removed by clearing site data. A past
            recommendation is never current guidance—always analyze again before departure.
          </p>
        </aside>
      </div>
    </main>
  );
}
