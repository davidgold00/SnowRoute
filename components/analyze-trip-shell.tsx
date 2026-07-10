"use client";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import dynamic from "next/dynamic";
import { startTransition, useEffect, useRef, useState } from "react";

import { HowItWorks } from "@/components/how-it-works";
import { MapErrorBoundary } from "@/components/map-error-boundary";
import { DecisionCard } from "@/components/decision-card";
import {
  DangerWindows,
  HoldGuidance,
  SaferDepartureCard,
  ForecastLimitations,
} from "@/components/decision-guidance";
import {
  RouteForm,
  type EditableStop,
  type RouteFormFieldErrors,
} from "@/components/route-form";
import { SegmentTable } from "@/components/segment-table";
import { StrategySuggestions } from "@/components/strategy-suggestions";
import { SummaryPanel } from "@/components/summary-panel";
import {
  consumeGuestTripRestore,
  createGuestTripHistoryEntry,
  saveGuestTrip,
} from "@/lib/guest-trip-history";
import {
  createPublicAppError,
  isApiFailure,
  isApiSuccess,
  type PublicAppError,
} from "@/lib/app-error";
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
const TRIP_LAUNCH_STORAGE_KEY = "snowroute.tripLaunch.v1";
const TRIP_LAUNCH_MAX_AGE_MS = 10 * 60 * 1000;

type TripDraft = {
  origin: EditableStop;
  destination: EditableStop;
  waypoints: EditableStop[];
  timeZone: string;
  timeZoneManuallySet: boolean;
};

type TripLaunch = TripDraft & {
  departureTimeLocal: string;
  createdAt: string;
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

function formatTripDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min` : `${minutes} min`;
}

function formatAnalysisTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPublicError(error: PublicAppError) {
  const reference = error.correlationId ? ` Reference: ${error.correlationId}.` : "";
  return `${error.title} ${error.message}${reference}`;
}

function getRouteFieldErrors(error: PublicAppError): RouteFormFieldErrors {
  const nextErrors: RouteFormFieldErrors = {};

  for (const field of ["origin", "destination", "departure"] as const) {
    const fieldError = error.fieldErrors?.[field];

    if (fieldError) {
      nextErrors[field] = `${fieldError.title} ${fieldError.message}`;
    }
  }

  if (
    (error.field === "origin" || error.field === "destination" || error.field === "departure") &&
    !nextErrors[error.field]
  ) {
    nextErrors[error.field] = `${error.title} ${error.message}`;
  }

  return nextErrors;
}

function isRouteAnalysisResponse(value: unknown): value is RouteAnalysisResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RouteAnalysisResponse>;

  return Boolean(
    candidate.metadata?.analyzedAt &&
      candidate.metadata.riskModelVersion &&
      candidate.route &&
      Array.isArray(candidate.route.coordinates) &&
      Array.isArray(candidate.samples) &&
      candidate.samples.length > 0 &&
      candidate.summary &&
      candidate.departureOptimization &&
      candidate.tripDecision,
  );
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

function consumeTripLaunch(): TripLaunch | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedLaunch = window.sessionStorage.getItem(TRIP_LAUNCH_STORAGE_KEY);
    window.sessionStorage.removeItem(TRIP_LAUNCH_STORAGE_KEY);

    if (!storedLaunch) {
      return null;
    }

    const parsed = JSON.parse(storedLaunch) as Partial<TripLaunch>;
    const createdAt = typeof parsed.createdAt === "string" ? Date.parse(parsed.createdAt) : NaN;

    if (
      !parsed.origin?.selected ||
      !parsed.destination?.selected ||
      !parsed.departureTimeLocal ||
      !parsed.timeZone ||
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > TRIP_LAUNCH_MAX_AGE_MS
    ) {
      return null;
    }

    return {
      origin: parsed.origin,
      destination: parsed.destination,
      waypoints: (parsed.waypoints ?? []).slice(0, MAX_WAYPOINTS),
      timeZone: parsed.timeZone,
      timeZoneManuallySet: Boolean(parsed.timeZoneManuallySet),
      departureTimeLocal: parsed.departureTimeLocal,
      createdAt: parsed.createdAt!,
    };
  } catch {
    return null;
  }
}

export function AnalyzeTripShell() {
  const [origin, setOrigin] = useState<EditableStop>(() => createStop("origin"));
  const [destination, setDestination] = useState<EditableStop>(() => createStop("destination"));
  const [waypoints, setWaypoints] = useState<EditableStop[]>([]);
  const [departureTimeLocal, setDepartureTimeLocal] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [timeZoneManuallySet, setTimeZoneManuallySet] = useState(false);
  const [originTimeZoneSuggestion, setOriginTimeZoneSuggestion] = useState<string | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<RouteAnalysisResponse | null>(null);
  const [activeStage, setActiveStage] = useState<TripStage>("input");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RouteFormFieldErrors>({});
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  const [isPlannerReady, setIsPlannerReady] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const stageContentRef = useRef<HTMLElement | null>(null);
  const hasRestoredDraftRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const restoredTrip = consumeGuestTripRestore();
      const launchedTrip = consumeTripLaunch();
      const draft = loadTripDraft();

      if (restoredTrip) {
        setOrigin({
          id: "origin",
          query: restoredTrip.origin.label,
          selected: restoredTrip.origin,
        });
        setDestination({
          id: "destination",
          query: restoredTrip.destination.label,
          selected: restoredTrip.destination,
        });
        setWaypoints(
          restoredTrip.waypoints.map((waypoint, index) => ({
            id: `waypoint-restored-${index + 1}`,
            query: waypoint.label,
            selected: waypoint,
          })),
        );
        setTimeZone(restoredTrip.timeZone);
        setTimeZoneManuallySet(true);
        setRestoreNotice(
          "Route restored from trip history. SnowRoute selected a fresh departure time so the next analysis uses current forecast conditions.",
        );
      } else if (launchedTrip) {
        setOrigin(launchedTrip.origin);
        setDestination(launchedTrip.destination);
        setWaypoints(launchedTrip.waypoints);
        setTimeZone(launchedTrip.timeZone);
        setTimeZoneManuallySet(launchedTrip.timeZoneManuallySet);
        setDepartureTimeLocal(launchedTrip.departureTimeLocal);
        setRestoreNotice(
          "Trip details carried over from the homepage. Review the route and departure before analyzing.",
        );
      } else if (draft) {
        setOrigin(draft.origin);
        setDestination(draft.destination);
        setWaypoints(draft.waypoints);
        setTimeZone(draft.timeZone);
        setTimeZoneManuallySet(draft.timeZoneManuallySet);
      } else {
        setTimeZone(getBrowserTimeZone());
      }

      // A deliberate same-session homepage launch keeps its selected time. Drafts and
      // history restores use a fresh +1 hour departure so stale plans never become active.
      if (!launchedTrip || restoredTrip) {
        setDepartureTimeLocal(getDefaultDepartureTime());
      }
      hasRestoredDraftRef.current = true;
      setIsPlannerReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hasRestoredDraftRef.current) {
      return;
    }

    saveTripDraft({ origin, destination, waypoints, timeZone, timeZoneManuallySet });
  }, [destination, origin, timeZone, timeZoneManuallySet, waypoints]);

  function focusStageContent(targetId?: string) {
    window.requestAnimationFrame(() => {
      const target = targetId ? document.getElementById(targetId) : stageContentRef.current;
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
      }
    });
  }

  function selectStage(stage: TripStage) {
    if (stage !== "input" && !analysis) {
      return;
    }

    setActiveStage(stage);
    focusStageContent(stage === "analysis" ? "decision" : undefined);
  }

  function handleStageKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentStage: TripStage,
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    const availableStages: TripStage[] = analysis
      ? ["input", "analysis", "strategy"]
      : ["input"];
    const currentIndex = Math.max(0, availableStages.indexOf(currentStage));
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? availableStages.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % availableStages.length
            : (currentIndex - 1 + availableStages.length) % availableStages.length;
    const nextStage = availableStages[nextIndex];

    event.preventDefault();
    selectStage(nextStage);
    window.requestAnimationFrame(() => {
      document.getElementById(`trip-stage-${nextStage}`)?.focus();
    });
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

  function clearFieldError(field: keyof RouteFormFieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleStopSelect(
    setter: React.Dispatch<React.SetStateAction<EditableStop>>,
    suggestion: LocationSuggestion,
  ) {
    setter((currentStop) => ({ ...currentStop, query: suggestion.label, selected: suggestion }));
  }

  function handleOriginSelect(suggestion: LocationSuggestion) {
    handleStopSelect(setOrigin, suggestion);
    clearFieldError("origin");
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
    clearFieldError("departure");
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
    setFieldErrors({});
    setRestoreNotice(null);
    setActiveStage("input");
  }

  function handleCancelAnalysis() {
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    setIsSubmitting(false);
    setAnalysisError(null);
    setFieldErrors({});
    setRestoreNotice("Analysis cancelled. Your trip details were kept.");
  }

  function handleUseSuggestedDeparture(departureTimeUtc: string) {
    setDepartureTimeLocal(
      formatInTimeZone(new Date(departureTimeUtc), timeZone, "yyyy-MM-dd'T'HH:mm"),
    );
    setAnalysisError(null);
    clearFieldError("departure");
    selectStage("input");
  }

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const hasIncompleteWaypoint = waypoints.some(
      (waypoint) => waypoint.query.trim().length > 0 && !waypoint.selected,
    );
    const localFieldErrors: RouteFormFieldErrors = {
      ...(!origin.selected
        ? { origin: "Choose a verified suggestion for the starting location." }
        : {}),
      ...(!destination.selected
        ? { destination: "Choose a verified suggestion for the destination." }
        : {}),
      ...(!departureTimeLocal
        ? { departure: "Choose a complete departure date and time." }
        : {}),
    };

    if (!origin.selected || !destination.selected || !departureTimeLocal || hasIncompleteWaypoint) {
      setFieldErrors(localFieldErrors);
      setAnalysisError(
        hasIncompleteWaypoint
          ? "Choose a verified autocomplete suggestion for every stop before analyzing."
          : "Correct the highlighted trip details before analyzing.",
      );
      return;
    }

    const departureDate = fromZonedTime(departureTimeLocal, timeZone);

    if (Number.isNaN(departureDate.getTime())) {
      setFieldErrors({ departure: "Choose a complete, valid departure date and time." });
      setAnalysisError("Departure time is not valid yet. Choose a new date and time.");
      return;
    }

    setIsSubmitting(true);
    setAnalysisError(null);
    setFieldErrors({});
    setRestoreNotice(null);
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
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok || isApiFailure(payload)) {
        const publicError = isApiFailure(payload)
          ? payload.error
          : createPublicAppError("INTERNAL_ANALYSIS_ERROR");
        setFieldErrors(getRouteFieldErrors(publicError));
        setAnalysisError(formatPublicError(publicError));
        return;
      }

      if (!isApiSuccess<RouteAnalysisResponse>(payload) || !isRouteAnalysisResponse(payload.data)) {
        const publicError = createPublicAppError("INTERNAL_ANALYSIS_ERROR");
        setAnalysisError(formatPublicError(publicError));
        return;
      }

      const nextAnalysis = payload.data;
      const highestRiskSample = nextAnalysis.samples.reduce(
        (current, sample) => (sample.score > current.score ? sample : current),
        nextAnalysis.samples[0],
      );

      void saveGuestTrip(
        createGuestTripHistoryEntry({
          origin: origin.selected,
          destination: destination.selected,
          waypoints: waypoints.flatMap((waypoint) =>
            waypoint.selected ? [waypoint.selected] : [],
          ),
          departureTimeLocal,
          departureTimeUtc: departureDate.toISOString(),
          timeZone,
          decision: nextAnalysis.tripDecision.decision,
          decisionLabel: nextAnalysis.tripDecision.decisionLabel,
          decisionSummary: nextAnalysis.tripDecision.decisionSummary,
          overallRisk: nextAnalysis.tripDecision.overallRisk,
          confidence: nextAnalysis.tripDecision.confidence,
          mainHazards: nextAnalysis.tripDecision.mainHazards,
          worstSegmentRisk: nextAnalysis.tripDecision.worstSegmentRisk,
          worstSegmentLocationLabel: nextAnalysis.tripDecision.worstSegmentLocationLabel,
          worstSegmentArrivalTime: nextAnalysis.tripDecision.worstSegmentArrivalTime,
          riskModelVersion: nextAnalysis.metadata.riskModelVersion,
          distanceKm: nextAnalysis.route.distanceKm,
          durationMinutes: nextAnalysis.route.durationMinutes,
        }, {
          analyzedAt: new Date(nextAnalysis.metadata.analyzedAt),
        }),
      ).catch(() => undefined);

      startTransition(() => {
        setAnalysis(nextAnalysis);
        setActiveSampleId(highestRiskSample?.id ?? null);
        setActiveStage("analysis");
      });
      focusStageContent("decision");
    } catch (error) {
      if (!abortController.signal.aborted) {
        const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
        const publicError = createPublicAppError(
          isOffline ? "NETWORK_OFFLINE" : "INTERNAL_ANALYSIS_ERROR",
        );
        setAnalysisError(
          error instanceof Error && error.message
            ? `${publicError.title} ${publicError.message}`
            : formatPublicError(publicError),
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
              Know whether this drive is smart to start.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              SnowRoute matches forecast conditions to your arrival time, then gives a
              clear drive, delay, hold, or avoid recommendation.
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
                onKeyDown={(event) => handleStageKeyDown(event, stage.id)}
                tabIndex={isActive ? 0 : -1}
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
              {restoreNotice ? (
                <section
                  role="status"
                  className="rounded-2xl border border-cyan-100/18 bg-cyan-300/[0.06] px-5 py-4 text-sm leading-6 text-cyan-50"
                >
                  {restoreNotice}
                </section>
              ) : null}

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

              {isPlannerReady ? <RouteForm
                origin={origin}
                destination={destination}
                waypoints={waypoints}
                departureTimeLocal={departureTimeLocal}
                timeZone={timeZone}
                originTimeZoneSuggestion={originTimeZoneSuggestion}
                isSubmitting={isSubmitting}
                fieldErrors={fieldErrors}
                onOriginChange={(value) => {
                  handleStopChange(setOrigin, value);
                  setOriginTimeZoneSuggestion(null);
                  clearFieldError("origin");
                }}
                onOriginSelect={handleOriginSelect}
                onDestinationChange={(value) => {
                  handleStopChange(setDestination, value);
                  clearFieldError("destination");
                }}
                onDestinationSelect={(suggestion) => {
                  handleStopSelect(setDestination, suggestion);
                  clearFieldError("destination");
                }}
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
                onDepartureTimeChange={(value) => {
                  setDepartureTimeLocal(value);
                  clearFieldError("departure");
                }}
                onTimeZoneChange={handleTimeZoneChange}
                onUseOriginTimeZone={handleUseOriginTimeZone}
                onDismissOriginTimeZone={() => {
                  setOriginTimeZoneSuggestion(null);
                  setTimeZoneManuallySet(true);
                }}
                onClearTrip={handleClearTrip}
                onCancelAnalysis={handleCancelAnalysis}
                onSubmit={handleAnalyze}
              /> : (
                <section aria-label="Preparing route planner" className="glass-panel min-h-[520px] rounded-2xl p-6 motion-safe:animate-pulse">
                  <div className="h-6 w-52 rounded bg-white/[0.08]" />
                  <div className="mt-8 grid gap-4 lg:grid-cols-2">
                    <div className="h-24 rounded-xl bg-white/[0.05]" />
                    <div className="h-24 rounded-xl bg-white/[0.05]" />
                  </div>
                  <div className="mt-6 h-44 rounded-xl bg-white/[0.05]" />
                </section>
              )}
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
                      Departure: {departureTimeLocal.replace("T", " at ")} • {timeZone}
                    </p>
                    <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                      <div className="flex gap-1.5">
                        <dt className="font-semibold text-slate-300">Distance</dt>
                        <dd>{Math.round(analysis.route.distanceKm)} km</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="font-semibold text-slate-300">Estimated drive</dt>
                        <dd>{formatTripDuration(analysis.route.durationMinutes)}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="font-semibold text-slate-300">Analyzed</dt>
                        <dd><time dateTime={analysis.metadata.analyzedAt}>{formatAnalysisTime(analysis.metadata.analyzedAt)}</time></dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="font-semibold text-slate-300">Model</dt>
                        <dd>{analysis.metadata.riskModelVersion}</dd>
                      </div>
                    </dl>
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
              </section>

              <DecisionCard decision={analysis.tripDecision} />

              <SaferDepartureCard
                decision={analysis.tripDecision}
                onUseDeparture={handleUseSuggestedDeparture}
              />

              <DangerWindows decision={analysis.tripDecision} />

              <HoldGuidance decision={analysis.tripDecision} />

              <section id="route-details" className="scroll-mt-24 space-y-6">
                <div>
                  <p className="eyebrow">Route details</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    Forecast evidence across the drive
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                    The map supports the decision above. Use the checkpoint list and timeline
                    to inspect where the score changes and why.
                  </p>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.32fr)_minmax(320px,0.68fr)]">
                  <div className="min-w-0">
                    <MapErrorBoundary>
                      <RouteMap analysis={analysis} activeSampleId={activeSampleId} onSelectSample={setActiveSampleId} />
                    </MapErrorBoundary>
                  </div>
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

              <ForecastLimitations decision={analysis.tripDecision} />
            </section>
          ) : null}

          {activeStage === "strategy" && analysis ? <StrategySuggestions analysis={analysis} /> : null}
        </main>

        <div className="mt-6 space-y-4">
          <HowItWorks />

          <footer className="rounded-2xl border border-amber-200/15 bg-amber-200/[0.045] px-5 py-4 text-xs leading-5 text-slate-300 sm:px-6">
            <p className="font-semibold uppercase tracking-[0.2em] text-amber-100/80">
              Important safety notice
            </p>
            <p className="mt-2 max-w-5xl">
              SnowRoute is an informational planning aid that provides forecast-based
              suggestions. It is not an emergency service, road-closure authority,
              meteorological guarantee, or substitute for your judgment. SnowRoute and
              its operators are not liable for accidents, injuries, property damage,
              delays, losses, or other consequences arising from travel decisions made
              using this service. Check official warnings and current road conditions,
              follow local instructions, and proceed only when you determine that travel
              is safe.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
