"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useGuestTripHistory } from "@/hooks/use-guest-trip-history";
import {
  queueGuestTripRestore,
  type GuestTripHistoryEntry,
} from "@/lib/guest-trip-history";

const DECISION_TREATMENT: Record<
  GuestTripHistoryEntry["decision"],
  { symbol: string; className: string }
> = {
  GO: { symbol: "✓", className: "border-emerald-200/25 bg-emerald-300/10 text-emerald-50" },
  CAUTION: { symbol: "!", className: "border-amber-200/25 bg-amber-300/10 text-amber-50" },
  DELAY: { symbol: "↻", className: "border-orange-200/25 bg-orange-300/10 text-orange-50" },
  HOLD: { symbol: "Ⅱ", className: "border-orange-200/25 bg-orange-300/10 text-orange-50" },
  AVOID: { symbol: "×", className: "border-rose-200/25 bg-rose-300/10 text-rose-50" },
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

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.12em] ${treatment.className}`}
            >
              <span aria-hidden="true">{treatment.symbol}</span>
              {trip.decision}
            </span>
            <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs font-medium text-slate-300">
              Previous forecast
            </span>
          </div>

          <h2 className="mt-4 break-words text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {trip.origin.label}
            <span className="mx-2 text-slate-500" aria-hidden="true">→</span>
            {trip.destination.label}
          </h2>
          {trip.waypoints.length > 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              Via {trip.waypoints.map((waypoint) => waypoint.label).join(" and ")}
            </p>
          ) : null}

          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
            <div className="flex gap-1.5">
              <dt className="font-semibold text-slate-300">Route</dt>
              <dd>{Math.round(trip.distanceKm)} km · {formatDuration(trip.durationMinutes)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold text-slate-300">Risk</dt>
              <dd>{trip.overallRisk}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold text-slate-300">Confidence</dt>
              <dd>{trip.confidence}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold text-slate-300">Planned departure</dt>
              <dd>{trip.departureTimeLocal.replace("T", " at ")} · {trip.timeZone}</dd>
            </div>
          </dl>

          <p className="mt-3 text-xs leading-5 text-slate-400">
            <span className="font-semibold text-slate-300">Main factor:</span>{" "}
            {trip.mainHazards[0] ?? "No dominant hazard recorded"}
          </p>

          <p className="mt-4 text-xs leading-5 text-amber-100/80">
            Analyzed <time dateTime={trip.analyzedAt}>{formatAnalyzedAt(trip.analyzedAt)}</time>.
            Forecasts and road conditions change; analyze again for current conditions.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-52 lg:justify-end">
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={isExpanded}
            className="min-h-11 rounded-xl border border-cyan-100/20 bg-cyan-300/[0.06] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.1]"
          >
            {isExpanded ? "Close summary" : "Open summary"}
          </button>
          <button
            type="button"
            onClick={onAnalyzeAgain}
            className="min-h-11 rounded-xl bg-[linear-gradient(135deg,#b7f0ff,#5bd0f2_52%,#8be8c7)] px-4 text-sm font-bold text-slate-950 shadow-[0_10px_28px_rgba(91,208,242,0.16)] transition hover:brightness-105"
          >
            Analyze again
          </button>
          {!isConfirmingDelete ? (
            <button
              type="button"
              onClick={onRequestDelete}
              className="min-h-11 rounded-xl border border-white/12 bg-white/[0.035] px-4 text-sm font-semibold text-slate-200 transition hover:border-rose-200/25 hover:bg-rose-300/[0.06] hover:text-white"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {isExpanded ? (
        <section className="mt-5 rounded-xl border border-white/10 bg-black/15 p-4" aria-label="Saved analysis summary">
          <p className="max-w-3xl text-sm leading-6 text-slate-300">{trip.decisionSummary}</p>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-semibold uppercase tracking-[0.14em] text-slate-400">Worst segment</dt>
              <dd className="mt-1 leading-5 text-slate-200">
                {trip.worstSegmentRisk} risk {trip.worstSegmentLocationLabel}, expected around {trip.worstSegmentArrivalTime}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.14em] text-slate-400">Main factors</dt>
              <dd className="mt-1 leading-5 text-slate-200">
                {trip.mainHazards.length > 0 ? trip.mainHazards.join(" · ") : "No dominant hazard recorded"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[11px] text-slate-500">Risk model {trip.riskModelVersion}</p>
        </section>
      ) : null}

      {isConfirmingDelete ? (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-rose-200/18 bg-rose-300/[0.055] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-rose-50">Remove this trip from this device?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancelDelete}
              className="min-h-10 rounded-lg border border-white/12 px-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.05]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="min-h-10 rounded-lg bg-rose-200 px-3 text-sm font-bold text-rose-950 hover:bg-rose-100"
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

  function analyzeAgain(trip: GuestTripHistoryEntry) {
    queueGuestTripRestore(trip);
    router.push("/analyze-trip");
  }

  return (
    <main className="min-h-screen pb-16 pt-4">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="glass-panel rounded-2xl px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow">Trip history</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Recent analyses on this device
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                SnowRoute keeps up to 20 recent routes in this browser so you can quickly
                analyze them again. This history is not uploaded or synced.
              </p>
            </div>
            {trips.length > 0 && !isConfirmingClear ? (
              <button
                type="button"
                onClick={() => setIsConfirmingClear(true)}
                className="min-h-11 shrink-0 rounded-xl border border-white/12 bg-white/[0.035] px-4 text-sm font-semibold text-slate-200 transition hover:border-rose-200/25 hover:bg-rose-300/[0.06]"
              >
                Clear history
              </button>
            ) : null}
          </div>
        </header>

        {isConfirmingClear ? (
          <section className="mt-5 rounded-2xl border border-rose-200/18 bg-rose-300/[0.055] p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div>
              <h2 className="font-semibold text-rose-50">Clear all recent trips?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-300">This removes every saved analysis from this browser.</p>
            </div>
            <div className="mt-4 flex gap-2 sm:mt-0">
              <button
                type="button"
                onClick={() => setIsConfirmingClear(false)}
                className="min-h-10 rounded-lg border border-white/12 px-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void clear();
                  setIsConfirmingClear(false);
                }}
                className="min-h-10 rounded-lg bg-rose-200 px-3 text-sm font-bold text-rose-950 hover:bg-rose-100"
              >
                Clear history
              </button>
            </div>
          </section>
        ) : null}

        {error ? (
          <div role="alert" className="mt-5 rounded-xl border border-amber-200/20 bg-amber-200/[0.06] px-4 py-3 text-sm text-amber-50">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-6 space-y-4" aria-label="Loading recent trips">
            {[0, 1].map((item) => (
              <div key={item} className="h-52 rounded-2xl border border-white/8 bg-white/[0.025] motion-safe:animate-pulse" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-dashed border-white/15 bg-black/10 px-5 py-14 text-center sm:px-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-cyan-100/20 bg-cyan-300/[0.07] text-xl text-cyan-100" aria-hidden="true">
              ↻
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">No recent trips on this device</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Analyze a route and its decision summary will appear here automatically.
            </p>
            <button
              type="button"
              onClick={() => router.push("/analyze-trip")}
              className="mt-6 min-h-11 rounded-xl bg-cyan-100 px-5 text-sm font-bold text-slate-950 hover:bg-white"
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

        <aside className="mt-6 rounded-xl border border-cyan-100/12 bg-cyan-300/[0.045] px-5 py-4 text-xs leading-5 text-slate-300">
          <p className="font-semibold text-cyan-50">Stored locally for privacy</p>
          <p className="mt-1">
            Recent trips stay in this browser and may be removed by clearing site data. A past
            recommendation is never current guidance—always analyze again before departure.
          </p>
        </aside>
      </div>
    </main>
  );
}
