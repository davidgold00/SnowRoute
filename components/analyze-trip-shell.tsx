"use client";

import { fromZonedTime } from "date-fns-tz";
import dynamic from "next/dynamic";
import { startTransition, useEffect, useRef, useState } from "react";

import { InfoTooltip } from "@/components/info-tooltip";
import { RecommendationPill, RiskPill } from "@/components/status-pill";
import { RouteForm, type EditableStop } from "@/components/route-form";
import { SegmentTable } from "@/components/segment-table";
import { SummaryPanel } from "@/components/summary-panel";
import {
  MAX_WAYPOINTS,
  canAddWaypoint,
  getBrowserTimeZone,
  inferTimeZoneFromLocation,
  shouldOfferOriginTimeZoneSwitch,
} from "@/lib/time-zones";
import type { LocationSuggestion, RouteAnalysisResponse } from "@/lib/types";

const DepartureTimeOptimizer = dynamic(
  () =>
    import("@/components/departure-time-optimizer").then(
      (module) => module.DepartureTimeOptimizer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
            Departure optimizer
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Comparing safe departure windows
            </h2>
            <p className="max-w-md text-sm leading-6 text-slate-300">
              Ranking every hour on the selected travel day.
            </p>
          </div>
        </div>
      </div>
    ),
  },
);

const RouteMap = dynamic(() => import("@/components/route-map"), {
  ssr: false,
  loading: () => (
    <div className="map-shell rounded-2xl border border-white/10 p-10">
      <div className="flex min-h-[540px] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
          Route canvas
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Loading weather-aware map layers
          </h2>
          <p className="max-w-md text-sm leading-6 text-slate-300">
            Building the map surface, segment colors, and interactive checkpoints.
          </p>
        </div>
      </div>
    </div>
  ),
});

const RiskTimeline = dynamic(
  () => import("@/components/risk-timeline").then((module) => module.RiskTimeline),
  {
    ssr: false,
    loading: () => (
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex min-h-[460px] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">
            Risk timeline
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Loading score progression
            </h2>
            <p className="max-w-md text-sm leading-6 text-slate-300">
              Preparing the ETA-synced risk curve across the drive.
            </p>
          </div>
        </div>
      </div>
    ),
  },
);

const TRIP_DRAFT_STORAGE_KEY = "snowroute.tripDraft.v1";

type TripDraft = {
  origin: EditableStop;
  destination: EditableStop;
  waypoints: EditableStop[];
  departureTimeLocal: string;
  timeZone: string;
  timeZoneManuallySet: boolean;
};

function createStop(id: string): EditableStop {
  return {
    id,
    query: "",
    selected: null,
  };
}

function createWaypoint() {
  return createStop(`waypoint-${Math.random().toString(36).slice(2, 9)}`);
}

function createWaypointWithDraft(stop: EditableStop, index: number): EditableStop {
  return {
    id: stop.id || `waypoint-${index + 1}`,
    query: stop.query,
    selected: stop.selected,
  };
}

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultDepartureTime() {
  const date = new Date();
  date.setMinutes(Math.ceil(date.getMinutes() / 30) * 30 || 30, 0, 0);

  if (date.getMinutes() === 0) {
    date.setHours(date.getHours() + 1);
  }

  return formatLocalDateTime(date);
}

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return "SnowRoute could not analyze that route.";
}

function loadTripDraft() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedDraft = window.localStorage.getItem(TRIP_DRAFT_STORAGE_KEY);

    if (!storedDraft) {
      return null;
    }

    const parsedDraft = JSON.parse(storedDraft) as Partial<TripDraft>;

    return {
      origin: parsedDraft.origin ?? createStop("origin"),
      destination: parsedDraft.destination ?? createStop("destination"),
      waypoints: (parsedDraft.waypoints ?? [])
        .slice(0, MAX_WAYPOINTS)
        .map(createWaypointWithDraft),
      departureTimeLocal: parsedDraft.departureTimeLocal ?? getDefaultDepartureTime(),
      timeZone: parsedDraft.timeZone ?? getBrowserTimeZone(),
      timeZoneManuallySet: Boolean(parsedDraft.timeZoneManuallySet),
    } satisfies TripDraft;
  } catch {
    return null;
  }
}

function saveTripDraft(draft: TripDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TRIP_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function clearTripDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TRIP_DRAFT_STORAGE_KEY);
}

export function AnalyzeTripShell() {
  const [origin, setOrigin] = useState<EditableStop>(() => createStop("origin"));
  const [destination, setDestination] = useState<EditableStop>(() =>
    createStop("destination"),
  );
  const [waypoints, setWaypoints] = useState<EditableStop[]>([]);
  const [departureTimeLocal, setDepartureTimeLocal] = useState(() =>
    getDefaultDepartureTime(),
  );
  const [timeZone, setTimeZone] = useState("UTC");
  const [timeZoneManuallySet, setTimeZoneManuallySet] = useState(false);
  const [originTimeZoneSuggestion, setOriginTimeZoneSuggestion] = useState<string | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<RouteAnalysisResponse | null>(null);
  const [isRouteBuilderExpanded, setIsRouteBuilderExpanded] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const hasRestoredDraftRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const draft = loadTripDraft();

      if (draft) {
        setOrigin(draft.origin);
        setDestination(draft.destination);
        setWaypoints(draft.waypoints);
        setDepartureTimeLocal(draft.departureTimeLocal);
        setTimeZone(draft.timeZone);
        setTimeZoneManuallySet(draft.timeZoneManuallySet);
      } else {
        setTimeZone(getBrowserTimeZone());
      }

      hasRestoredDraftRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hasRestoredDraftRef.current) {
      return;
    }

    saveTripDraft({
      origin,
      destination,
      waypoints,
      departureTimeLocal,
      timeZone,
      timeZoneManuallySet,
    });
  }, [
    departureTimeLocal,
    destination,
    origin,
    timeZone,
    timeZoneManuallySet,
    waypoints,
  ]);

  function handleStopChange(
    setter: React.Dispatch<React.SetStateAction<EditableStop>>,
    value: string,
  ) {
    setter((currentStop) => ({
      ...currentStop,
      query: value,
      selected: currentStop.selected?.label === value ? currentStop.selected : null,
    }));
  }

  function handleStopSelect(
    setter: React.Dispatch<React.SetStateAction<EditableStop>>,
    suggestion: LocationSuggestion,
  ) {
    setter((currentStop) => ({
      ...currentStop,
      query: suggestion.label,
      selected: suggestion,
    }));
  }

  function handleOriginSelect(suggestion: LocationSuggestion) {
    handleStopSelect(setOrigin, suggestion);

    const inferredTimeZone = inferTimeZoneFromLocation(suggestion);

    if (
      shouldOfferOriginTimeZoneSwitch({
        currentTimeZone: timeZone,
        manualOverride: timeZoneManuallySet,
        originTimeZone: inferredTimeZone,
      })
    ) {
      setOriginTimeZoneSuggestion(inferredTimeZone);
    } else {
      setOriginTimeZoneSuggestion(null);
    }
  }

  function handleTimeZoneChange(nextTimeZone: string) {
    setTimeZone(nextTimeZone);
    setTimeZoneManuallySet(true);
    setOriginTimeZoneSuggestion(null);
  }

  function handleUseOriginTimeZone() {
    if (!originTimeZoneSuggestion) {
      return;
    }

    setTimeZone(originTimeZoneSuggestion);
    setTimeZoneManuallySet(true);
    setOriginTimeZoneSuggestion(null);
  }

  function handleClearTrip() {
    analyzeAbortRef.current?.abort();
    clearTripDraft();
    setOrigin(createStop("origin"));
    setDestination(createStop("destination"));
    setWaypoints([]);
    setDepartureTimeLocal(getDefaultDepartureTime());
    setTimeZone(getBrowserTimeZone());
    setTimeZoneManuallySet(false);
    setOriginTimeZoneSuggestion(null);
    setAnalysis(null);
    setActiveSampleId(null);
    setAnalysisError(null);
    setIsRouteBuilderExpanded(true);
  }

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const hasIncompleteWaypoint = waypoints.some(
      (waypoint) => waypoint.query.trim().length > 0 && !waypoint.selected,
    );

    if (!origin.selected || !destination.selected || !departureTimeLocal || hasIncompleteWaypoint) {
      setAnalysisError(
        "Select autocomplete suggestions for each stop and choose a departure time before analyzing.",
      );
      return;
    }

    const departureDate = fromZonedTime(departureTimeLocal, timeZone);

    if (Number.isNaN(departureDate.getTime())) {
      setAnalysisError("Departure time is not valid yet. Choose a new date and time.");
      return;
    }

    setIsSubmitting(true);
    setAnalysisError(null);
    analyzeAbortRef.current?.abort();
    const abortController = new AbortController();
    analyzeAbortRef.current = abortController;

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortController.signal,
        body: JSON.stringify({
          origin: origin.selected,
          destination: destination.selected,
          waypoints: waypoints.flatMap((waypoint) =>
            waypoint.selected ? [waypoint.selected] : [],
          ),
          departureTimeUtc: departureDate.toISOString(),
          clientTimeZone: timeZone,
        }),
      });

      const payload = (await response.json()) as RouteAnalysisResponse | { message: string };

      if (!response.ok) {
        throw new Error(getErrorMessage(payload));
      }

      const nextAnalysis = payload as RouteAnalysisResponse;
      const highestRiskSample = nextAnalysis.samples.reduce(
        (current, sample) => (sample.score > current.score ? sample : current),
        nextAnalysis.samples[0],
      );

      startTransition(() => {
        setAnalysis(nextAnalysis);
        setActiveSampleId(highestRiskSample?.id ?? null);
        setIsRouteBuilderExpanded(false);
      });

      window.requestAnimationFrame(() => {
        summaryRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        summaryRef.current?.focus({ preventScroll: true });
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      setAnalysisError(
        error instanceof Error
          ? error.message
          : "SnowRoute could not analyze that route right now.",
      );
    } finally {
      if (!abortController.signal.aborted) {
        setIsSubmitting(false);
        analyzeAbortRef.current = null;
      }
    }
  }

  const latestRouteName =
    origin.selected?.label && destination.selected?.label
      ? `${origin.selected.label} to ${destination.selected.label}`
      : "Latest analyzed route";

  const analysisSnapshot = analysis
    ? [
        {
          label: "Overall score",
          value: `${analysis.summary.overallScore}/100`,
          detail: `${analysis.summary.overallLabel} trip risk`,
          help: "A 0-100 blended winter driving risk score. Higher numbers mean more snow, ice, low visibility, wind, darkness, or forecast uncertainty along the route.",
        },
        {
          label: "Worst segment",
          value: `${analysis.summary.maxScore}/100`,
          detail: analysis.summary.worstSegmentId
            ? "Highest checkpoint risk"
            : "No critical segment",
          help: "The highest risk score found at any checkpoint or segment. It can drive the recommendation even when the route average is lower.",
        },
        {
          label: "Hazard windows",
          value: analysis.hazardWindows.length.toString(),
          detail:
            analysis.hazardWindows.length > 0 ? "Time blocks flagged" : "No sustained window",
          help: "Hazard windows group nearby high-risk checkpoints so short gaps do not hide a meaningful dangerous stretch.",
        },
        {
          label: "Sampled checkpoints",
          value: analysis.samples.length.toString(),
          detail: "ETA-matched forecast points",
          help: "SnowRoute samples the route at checkpoints, estimates arrival time at each point, and matches the closest forecast hour.",
        },
      ]
    : [];

  return (
    <div className="min-h-screen pb-16 pt-4">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="glass-panel rounded-2xl px-5 py-5 sm:px-6 lg:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="eyebrow">Analyze a trip</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Check the route before you go.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Enter your route, choose a departure time, and review the winter risk
                profile by checkpoint.
              </p>
            </div>
            <div className="grid min-w-full grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] text-center sm:min-w-[420px]">
              {[
                { label: "Route", value: analysis ? "Analyzed" : "Draft" },
                { label: "Map", value: analysis ? "Live" : "Standby" },
                { label: "Focus", value: activeSampleId ? "Pinned" : "Auto" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="border-l border-white/8 px-3 py-3 first:border-l-0"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {isSubmitting
            ? "Analyzing route."
            : analysisError
              ? `Analysis failed. ${analysisError}`
              : analysis
                ? "Latest route analysis is ready."
                : "Trip builder ready."}
        </div>

        {analysisError ? (
          <div className="mt-6 rounded-2xl border border-rose-300/20 bg-[linear-gradient(135deg,rgba(251,113,133,0.14),rgba(255,255,255,0.03))] px-5 py-4 text-sm text-rose-50 shadow-[0_18px_48px_rgba(37,9,15,0.24)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow text-rose-100/80">Analysis issue</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-rose-50">{analysisError}</p>
              </div>
              {analysis ? (
                <span className="rounded-full border border-rose-100/15 bg-rose-50/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-100">
                  Prior analysis preserved
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {analysis ? (
          <section
            ref={summaryRef}
            tabIndex={-1}
            className="glass-panel mt-6 scroll-mt-24 rounded-2xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70 lg:p-6"
            aria-label="Latest route analysis summary"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="eyebrow">Latest analysis</p>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {latestRouteName}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    Focus on the 0-100 overall score, the worst segment, and any
                    flagged hazard windows.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RiskPill label={analysis.summary.overallLabel} />
                <RecommendationPill recommendation={analysis.summary.recommendation} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {analysisSnapshot.map((item) => (
                <div key={item.label} className="metric-card rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                      {item.label}
                    </p>
                    <InfoTooltip label={`Explain ${item.label}`}>
                      {item.help}
                    </InfoTooltip>
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <main className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.32fr)_minmax(320px,0.68fr)]">
          <section className="min-w-0 space-y-6">
            {analysis && !isRouteBuilderExpanded ? (
              <section className="glass-panel rounded-2xl p-5 lg:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="eyebrow">Trip builder collapsed</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                      Route inputs saved
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      {latestRouteName} • {departureTimeLocal.replace("T", " at ")} •{" "}
                      {timeZone}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setIsRouteBuilderExpanded(true)}
                      className="min-h-11 rounded-xl border border-cyan-100/30 bg-cyan-300/[0.1] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
                    >
                      Modify route
                    </button>
                    <button
                      type="button"
                      onClick={handleClearTrip}
                      className="min-h-11 rounded-xl border border-white/12 bg-white/[0.035] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
                    >
                      Clear trip
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <>
                {analysis ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsRouteBuilderExpanded(false)}
                      className="min-h-10 rounded-xl border border-white/12 bg-white/[0.035] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
                    >
                      Collapse trip builder
                    </button>
                  </div>
                ) : null}

                <RouteForm
                  origin={origin}
                  destination={destination}
                  waypoints={waypoints}
                  departureTimeLocal={departureTimeLocal}
                  timeZone={timeZone}
                  originTimeZoneSuggestion={originTimeZoneSuggestion}
                  isSubmitting={isSubmitting}
                  onOriginChange={(value) => {
                    handleStopChange(setOrigin, value);
                    setOriginTimeZoneSuggestion(null);
                  }}
                  onOriginSelect={handleOriginSelect}
                  onDestinationChange={(value) => handleStopChange(setDestination, value)}
                  onDestinationSelect={(suggestion) =>
                    handleStopSelect(setDestination, suggestion)
                  }
                  onWaypointChange={(id, value) => {
                    setWaypoints((currentWaypoints) =>
                      currentWaypoints.map((waypoint) =>
                        waypoint.id === id
                          ? {
                              ...waypoint,
                              query: value,
                              selected:
                                waypoint.selected?.label === value
                                  ? waypoint.selected
                                  : null,
                            }
                          : waypoint,
                      ),
                    );
                  }}
                  onWaypointSelect={(id, suggestion) => {
                    setWaypoints((currentWaypoints) =>
                      currentWaypoints.map((waypoint) =>
                        waypoint.id === id
                          ? {
                              ...waypoint,
                              query: suggestion.label,
                              selected: suggestion,
                            }
                          : waypoint,
                      ),
                    );
                  }}
                  onWaypointAdd={() => {
                    setWaypoints((currentWaypoints) =>
                      canAddWaypoint(currentWaypoints.length)
                        ? [...currentWaypoints, createWaypoint()]
                        : currentWaypoints,
                    );
                  }}
                  onWaypointRemove={(id) => {
                    setWaypoints((currentWaypoints) =>
                      currentWaypoints.filter((waypoint) => waypoint.id !== id),
                    );
                  }}
                  onDepartureTimeChange={setDepartureTimeLocal}
                  onTimeZoneChange={handleTimeZoneChange}
                  onUseOriginTimeZone={handleUseOriginTimeZone}
                  onDismissOriginTimeZone={() => {
                    setOriginTimeZoneSuggestion(null);
                    setTimeZoneManuallySet(true);
                  }}
                  onClearTrip={handleClearTrip}
                  onSubmit={handleAnalyze}
                />
              </>
            )}

            {analysis ? (
              <DepartureTimeOptimizer optimization={analysis.departureOptimization} />
            ) : null}

            <RouteMap
              analysis={analysis}
              activeSampleId={activeSampleId}
              onSelectSample={setActiveSampleId}
            />
          </section>

          <div className="min-w-0">
            <SummaryPanel analysis={analysis} />
          </div>
        </main>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
          <div className="min-w-0">
            <SegmentTable
              samples={analysis?.samples ?? []}
              activeSampleId={activeSampleId}
              onSelectSample={setActiveSampleId}
            />
          </div>
          <div className="min-w-0">
            <RiskTimeline
              samples={analysis?.samples ?? []}
              activeSampleId={activeSampleId}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
