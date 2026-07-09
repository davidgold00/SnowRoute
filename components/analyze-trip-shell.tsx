"use client";

import { fromZonedTime } from "date-fns-tz";
import dynamic from "next/dynamic";
import { startTransition, useEffect, useRef, useState } from "react";

import { InfoTooltip } from "@/components/info-tooltip";
import { RouteForm, type EditableStop } from "@/components/route-form";
import { SegmentTable } from "@/components/segment-table";
import { StrategySuggestions } from "@/components/strategy-suggestions";
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
  { ssr: false },
);

const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false });

const RiskTimeline = dynamic(
  () => import("@/components/risk-timeline").then((module) => module.RiskTimeline),
  { ssr: false },
);

const TRIP_DRAFT_STORAGE_KEY = "snowroute.tripDraft.v2";

type TripDraft = {
  origin: EditableStop;
  destination: EditableStop;
  waypoints: EditableStop[];
  timeZone: string;
  timeZoneManuallySet: boolean;
};

type TripStage = "input" | "analysis" | "strategy";

function createStop(id: string): EditableStop {
  return { id, query: "", selected: null };
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
  date.setHours(date.getHours() + 1);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);

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

function loadTripDraft(): TripDraft | null {
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
      timeZone: parsedDraft.timeZone ?? getBrowserTimeZone(),
      timeZoneManuallySet: Boolean(parsedDraft.timeZoneManuallySet),
    };
  } catch {
    return null;
  }
}

function saveTripDraft(draft: TripDraft) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TRIP_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }
}

function clearTripDraft() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TRIP_DRAFT_STORAGE_KEY);
  }
}

export function AnalyzeTripShell() {
  const [origin, setOrigin] = useState<EditableStop>(() => createStop("origin"));
  const [destination, setDestination] = useState<EditableStop>(() => createStop("destination"));
  const [waypoints, setWaypoints] = useState<EditableStop[]>([]);
  const [departureTimeLocal, setDepartureTimeLocal] = useState(getDefaultDepartureTime);
  const [timeZone, setTimeZone] = useState("UTC");
  const [timeZoneManuallySet, setTimeZoneManuallySet] = useState(false);
  const [originTimeZoneSuggestion, setOriginTimeZoneSuggestion] = useState<string | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<RouteAnalysisResponse | null>(null);
  const [activeStage, setActiveStage] = useState<TripStage>("input");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const stageContentRef = useRef<HTMLElement | null>(null);
  const hasRestoredDraftRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const draft = loadTripDraft();

      if (draft) {
        setOrigin(draft.origin);
        setDestination(draft.destination);
        setWaypoints(draft.waypoints);
        setTimeZone(draft.timeZone);
        setTimeZoneManuallySet(draft.timeZoneManuallySet);
      } else {
        setTimeZone(getBrowserTimeZone());
      }

      // Departure time is deliberately never restored. Every visit starts today,
      // one hour ahead, so a stale plan cannot silently become the active departure.
      setDepartureTimeLocal(getDefaultDepartureTime());
      hasRestoredDraftRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hasRestoredDraftRef.current) {
      return;
    }

    saveTripDraft({ origin, destination, waypoints, timeZone, timeZoneManuallySet });
  }, [destination, origin, timeZone, timeZoneManuallySet, waypoints]);

  function focusStageContent() {
    window.requestAnimationFrame(() => {
      stageContentRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      stageContentRef.current?.focus({ preventScroll: true });
    });
  }

  function selectStage(stage: TripStage) {
    if (stage !== "input" && !analysis) {
      return;
    }

    setActiveStage(stage);
    focusStageContent();
  }

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
    setter((currentStop) => ({ ...currentStop, query: suggestion.label, selected: suggestion }));
  }

  function handleOriginSelect(suggestion: LocationSuggestion) {
    handleStopSelect(setOrigin, suggestion);
    const inferredTimeZone = inferTimeZoneFromLocation(suggestion);

    setOriginTimeZoneSuggestion(
      shouldOfferOriginTimeZoneSwitch({
        currentTimeZone: timeZone,
        manualOverride: timeZoneManuallySet,
        originTimeZone: inferredTimeZone,
      })
        ? inferredTimeZone
        : null,
    );
  }

  function handleTimeZoneChange(nextTimeZone: string) {
    setTimeZone(nextTimeZone);
    setTimeZoneManuallySet(true);
    setOriginTimeZoneSuggestion(null);
  }

  function handleUseOriginTimeZone() {
    if (originTimeZoneSuggestion) {
      setTimeZone(originTimeZoneSuggestion);
      setTimeZoneManuallySet(true);
      setOriginTimeZoneSuggestion(null);
    }
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
    setActiveStage("input");
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
        headers: { "Content-Type": "application/json" },
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
        setActiveStage("analysis");
      });
      focusStageContent();
    } catch (error) {
      if (!abortController.signal.aborted) {
        setAnalysisError(
          error instanceof Error ? error.message : "SnowRoute could not analyze that route right now.",
        );
      }
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
          help: "A blended 0–100 winter-driving risk score. Higher numbers mean more snow, ice, low visibility, wind, darkness, or forecast uncertainty along the route.",
        },
        {
          label: "Worst segment",
          value: `${analysis.summary.maxScore}/100`,
          detail: "Highest checkpoint risk",
          help: "The highest risk score found at any checkpoint or route segment.",
        },
        {
          label: "Hazard windows",
          value: analysis.hazardWindows.length.toString(),
          detail: analysis.hazardWindows.length ? "Time blocks flagged" : "None sustained",
          help: "Nearby high-risk checkpoints are grouped into practical periods of concern.",
        },
        {
          label: "Checkpoints",
          value: analysis.samples.length.toString(),
          detail: "ETA-matched forecast points",
          help: "Each point is paired with the nearest forecast hour for its estimated arrival time.",
        },
      ]
    : [];
  const stages: Array<{ id: TripStage; number: string; label: string; detail: string }> = [
    { id: "input", number: "01", label: "Trip details", detail: "Route, stops, departure" },
    { id: "analysis", number: "02", label: "Analysis", detail: "Route risk and timing" },
    { id: "strategy", number: "03", label: "Suggestions", detail: "Weather-hold strategy" },
  ];

  return (
    <div className="min-h-screen pb-16 pt-4">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="glass-panel rounded-2xl px-5 py-5 sm:px-6 lg:px-7">
          <div className="max-w-3xl space-y-3">
            <p className="eyebrow">Analyze a trip</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Winter travel, organized.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Set the trip first, review the route analysis second, then open a formal
              weather-hold strategy only when you need it.
            </p>
          </div>
        </header>

        <nav
          className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-black/15 p-2 sm:grid-cols-3"
          aria-label="Trip analysis stages"
          role="tablist"
        >
          {stages.map((stage) => {
            const isActive = activeStage === stage.id;
            const isUnavailable = stage.id !== "input" && !analysis;

            return (
              <button
                key={stage.id}
                id={`trip-stage-${stage.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="trip-stage-content"
                disabled={isUnavailable}
                onClick={() => selectStage(stage.id)}
                className={`flex min-h-16 items-center gap-3 rounded-xl px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 disabled:cursor-not-allowed disabled:opacity-45 ${
                  isActive
                    ? "bg-cyan-300/[0.14] shadow-[inset_0_0_0_1px_rgba(186,230,253,0.3)]"
                    : "hover:bg-white/[0.045]"
                }`}
              >
                <span className="font-mono text-xs font-semibold text-cyan-100/80">
                  {stage.number}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{stage.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{stage.detail}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {isSubmitting
            ? "Analyzing route."
            : analysisError
              ? `Analysis failed. ${analysisError}`
              : analysis
                ? "Latest route analysis is ready."
                : "Trip details ready."}
        </div>

        {analysisError ? (
          <div className="mt-5 rounded-2xl border border-rose-300/20 bg-[linear-gradient(135deg,rgba(251,113,133,0.14),rgba(255,255,255,0.03))] px-5 py-4 text-sm text-rose-50 shadow-[0_18px_48px_rgba(37,9,15,0.24)]">
            <p className="eyebrow text-rose-100/80">Analysis issue</p>
            <p className="mt-2 max-w-3xl leading-6">{analysisError}</p>
          </div>
        ) : null}

        <main
          id="trip-stage-content"
          ref={stageContentRef}
          tabIndex={-1}
          role="tabpanel"
          aria-labelledby={`trip-stage-${activeStage}`}
          className="mt-6 scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70"
        >
          {activeStage === "input" ? (
            <div className="space-y-5">
              {analysis ? (
                <section className="rounded-2xl border border-cyan-100/15 bg-cyan-300/[0.06] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
                  <div>
                    <p className="text-sm font-semibold text-cyan-50">A route analysis is ready.</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      Updating the details below will not change it until you analyze again.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectStage("analysis")}
                    className="mt-3 min-h-10 rounded-lg border border-cyan-100/30 bg-cyan-200/12 px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 sm:mt-0"
                  >
                    View analysis
                  </button>
                </section>
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
                onDestinationSelect={(suggestion) => handleStopSelect(setDestination, suggestion)}
                onWaypointChange={(id, value) => {
                  setWaypoints((currentWaypoints) =>
                    currentWaypoints.map((waypoint) =>
                      waypoint.id === id
                        ? {
                            ...waypoint,
                            query: value,
                            selected:
                              waypoint.selected?.label === value ? waypoint.selected : null,
                          }
                        : waypoint,
                    ),
                  );
                }}
                onWaypointSelect={(id, suggestion) => {
                  setWaypoints((currentWaypoints) =>
                    currentWaypoints.map((waypoint) =>
                      waypoint.id === id
                        ? { ...waypoint, query: suggestion.label, selected: suggestion }
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
            </div>
          ) : null}

          {activeStage === "analysis" && analysis ? (
            <section className="space-y-6">
              <section className="glass-panel rounded-2xl p-5 sm:p-6 lg:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="eyebrow">Step 2 · Route analysis</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {latestRouteName}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      Review the forecast-matched route risk, then open the strategy
                      briefing if you want planned weather-hold decision points.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => selectStage("input")}
                      className="min-h-11 rounded-xl border border-white/12 bg-white/[0.035] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07]"
                    >
                      Edit trip
                    </button>
                    <button
                      type="button"
                      onClick={() => selectStage("strategy")}
                      className="min-h-11 rounded-xl bg-[linear-gradient(135deg,#b7f0ff,#5bd0f2_52%,#8be8c7)] px-4 text-sm font-bold text-slate-950 shadow-[0_10px_28px_rgba(91,208,242,0.18)] transition hover:brightness-105"
                    >
                      See suggestions
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {analysisSnapshot.map((item) => (
                    <div key={item.label} className="metric-card rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                          {item.label}
                        </p>
                        <InfoTooltip label={`Explain ${item.label}`}>{item.help}</InfoTooltip>
                      </div>
                      <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                      <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.32fr)_minmax(320px,0.68fr)]">
                <div className="min-w-0"><RouteMap analysis={analysis} activeSampleId={activeSampleId} onSelectSample={setActiveSampleId} /></div>
                <div className="min-w-0"><SummaryPanel analysis={analysis} /></div>
              </div>

              <DepartureTimeOptimizer optimization={analysis.departureOptimization} />

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                <SegmentTable
                  samples={analysis.samples}
                  activeSampleId={activeSampleId}
                  onSelectSample={setActiveSampleId}
                />
                <RiskTimeline samples={analysis.samples} activeSampleId={activeSampleId} />
              </div>
            </section>
          ) : null}

          {activeStage === "strategy" && analysis ? <StrategySuggestions analysis={analysis} /> : null}
        </main>
      </div>
    </div>
  );
}
