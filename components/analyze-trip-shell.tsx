"use client";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import dynamic from "next/dynamic";
import { startTransition, useEffect, useReducer, useRef, useState } from "react";

import { HowItWorks } from "@/components/how-it-works";
import { MapErrorBoundary } from "@/components/map-error-boundary";
import { DecisionCard } from "@/components/decision-card";
import {
  DangerWindows,
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
import { trackLocationEvent } from "@/lib/location-analytics";
import {
  createInitialRouteLocationState,
  getDestinationCity,
  getRouteEndpointSelections,
  normalizeStoredRouteLocationState,
  routeEndpointsAreEffectivelyIdentical,
  routeLocationReducer,
  toEffectiveRouteEndpoint,
  type RouteLocationAction,
  type RouteLocationState,
} from "@/lib/route-location-state";
import {
  MAX_WAYPOINTS,
  canAddWaypoint,
  getBrowserTimeZone,
  getDefaultDepartureTimeLocal,
  inferTimeZoneFromLocation,
} from "@/lib/time-zones";
import type {
  CitySelection,
  LocationSuggestion,
  RouteEndpointSelection,
  RouteAnalysisResponse,
} from "@/lib/types";

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

const TRIP_DRAFT_STORAGE_KEY = "snowroute.tripDraft.v3";
const LEGACY_TRIP_DRAFT_STORAGE_KEY = "snowroute.tripDraft.v2";
const TRIP_LAUNCH_STORAGE_KEY = "snowroute.tripLaunch.v2";
const LEGACY_TRIP_LAUNCH_STORAGE_KEY = "snowroute.tripLaunch.v1";
const TRIP_LAUNCH_MAX_AGE_MS = 10 * 60 * 1000;

type TripDraft = {
  version: 3;
  locations: RouteLocationState;
  waypoints: EditableStop[];
  timeZone: string;
  timeZoneManuallySet: boolean;
  requiresLocationConfirmation?: boolean;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseWaypointDraft(value: unknown, index: number): EditableStop | null {
  if (!isRecord(value)) {
    return null;
  }

  const selected = isRecord(value.selected) &&
    typeof value.selected.id === "string" &&
    typeof value.selected.label === "string" &&
    typeof value.selected.lat === "number" &&
    Number.isFinite(value.selected.lat) &&
    typeof value.selected.lon === "number" &&
    Number.isFinite(value.selected.lon)
      ? (value.selected as LocationSuggestion)
      : null;

  return {
    id: typeof value.id === "string" && value.id
      ? value.id.slice(0, 120)
      : `waypoint-${index + 1}`,
    query:
      typeof value.query === "string"
        ? value.query.slice(0, 200)
        : selected?.label ?? "",
    selected,
  };
}

function cityFromLegacySuggestion(value: unknown): CitySelection | null {
  if (!isRecord(value)) {
    return null;
  }

  const isCity = value.locationType === "city" || value.placeType === "City";
  const latitude = value.lat;
  const longitude = value.lon;
  const displayName = value.label;

  if (
    !isCity ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    typeof displayName !== "string" ||
    !displayName.trim()
  ) {
    return null;
  }

  const cityName =
    typeof value.locality === "string" && value.locality.trim()
      ? value.locality.trim()
      : typeof value.primaryLabel === "string" && value.primaryLabel.trim()
        ? value.primaryLabel.trim()
        : displayName.split(",")[0]?.trim();
  const countryName =
    typeof value.country === "string" && value.country.trim()
      ? value.country.trim()
      : "Unknown country";
  const countryCode =
    typeof value.countryCode === "string" && /^[A-Za-z]{2,3}$/.test(value.countryCode)
      ? value.countryCode.toUpperCase()
      : "ZZ";

  if (!cityName) {
    return null;
  }

  return {
    providerId: typeof value.providerId === "string" ? value.providerId : null,
    displayName: displayName.slice(0, 240),
    cityName: cityName.slice(0, 160),
    regionName: typeof value.region === "string" ? value.region.slice(0, 160) : null,
    regionCode: null,
    countryName: countryName.slice(0, 160),
    countryCode,
    postalCode: typeof value.postalCode === "string" ? value.postalCode.slice(0, 32) : null,
    latitude,
    longitude,
    boundingBox: null,
    timezone: null,
    precision: "city",
    providerConfidence:
      typeof value.providerConfidence === "number" ? value.providerConfidence : null,
  };
}

function legacyLocationsFromDraft(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const origin = isRecord(value.origin) ? value.origin : null;
  const destination = isRecord(value.destination) ? value.destination : null;
  const originSelected = origin?.selected;
  const destinationSelected = destination?.selected;
  const startCity = cityFromLegacySuggestion(originSelected);
  const destinationCity = cityFromLegacySuggestion(destinationSelected);
  const state = createInitialRouteLocationState();

  state.start = {
    ...state.start,
    cityQuery: startCity?.displayName ??
      (typeof origin?.query === "string" ? origin.query.slice(0, 120) : ""),
    city: startCity,
  };
  state.destination = {
    ...state.destination,
    cityQuery: destinationCity?.displayName ??
      (typeof destination?.query === "string" ? destination.query.slice(0, 120) : ""),
    city: destinationCity,
  };

  return state;
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

  for (const field of [
    "startCity",
    "startPlace",
    "destinationCity",
    "destinationPlace",
    "departure",
  ] as const) {
    const fieldError = error.fieldErrors?.[field];

    if (fieldError) {
      nextErrors[field] = `${fieldError.title} ${fieldError.message}`;
    }
  }

  const fieldAlias =
    error.field === "origin"
      ? "startCity"
      : error.field === "destination"
        ? "destinationCity"
        : error.field;

  if (fieldAlias && fieldAlias !== "general" && !nextErrors[fieldAlias]) {
    nextErrors[fieldAlias] = `${error.title} ${error.message}`;
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

    if (storedDraft) {
      const parsedDraft = JSON.parse(storedDraft) as unknown;

      if (isRecord(parsedDraft) && parsedDraft.version === 3) {
        const locations = normalizeStoredRouteLocationState(parsedDraft.locations);

        if (locations) {
          return {
            version: 3,
            locations,
            waypoints: (Array.isArray(parsedDraft.waypoints) ? parsedDraft.waypoints : [])
              .slice(0, MAX_WAYPOINTS)
              .map(parseWaypointDraft)
              .filter((stop): stop is EditableStop => stop !== null),
            timeZone:
              typeof parsedDraft.timeZone === "string"
                ? parsedDraft.timeZone.slice(0, 120)
                : getBrowserTimeZone(),
            timeZoneManuallySet: Boolean(parsedDraft.timeZoneManuallySet),
          };
        }
      }
    }

    const storedLegacyDraft = window.localStorage.getItem(LEGACY_TRIP_DRAFT_STORAGE_KEY);

    if (!storedLegacyDraft) {
      return null;
    }

    const parsedLegacyDraft = JSON.parse(storedLegacyDraft) as unknown;
    const locations = legacyLocationsFromDraft(parsedLegacyDraft);

    if (!locations) {
      return null;
    }

    return {
      version: 3,
      locations,
      waypoints: (isRecord(parsedLegacyDraft) && Array.isArray(parsedLegacyDraft.waypoints)
        ? parsedLegacyDraft.waypoints
        : [])
        .slice(0, MAX_WAYPOINTS)
        .map(parseWaypointDraft)
        .filter((stop): stop is EditableStop => stop !== null),
      timeZone:
        isRecord(parsedLegacyDraft) && typeof parsedLegacyDraft.timeZone === "string"
          ? parsedLegacyDraft.timeZone.slice(0, 120)
          : getBrowserTimeZone(),
      timeZoneManuallySet: Boolean(
        isRecord(parsedLegacyDraft) && parsedLegacyDraft.timeZoneManuallySet,
      ),
      requiresLocationConfirmation: true,
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
    window.localStorage.removeItem(LEGACY_TRIP_DRAFT_STORAGE_KEY);
  }
}

function consumeTripLaunch(): TripLaunch | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedLaunch =
      window.sessionStorage.getItem(TRIP_LAUNCH_STORAGE_KEY) ??
      window.sessionStorage.getItem(LEGACY_TRIP_LAUNCH_STORAGE_KEY);
    window.sessionStorage.removeItem(TRIP_LAUNCH_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_TRIP_LAUNCH_STORAGE_KEY);

    if (!storedLaunch) {
      return null;
    }

    const parsed = JSON.parse(storedLaunch) as unknown;
    const createdAt =
      isRecord(parsed) && typeof parsed.createdAt === "string"
        ? Date.parse(parsed.createdAt)
        : NaN;
    const locations = isRecord(parsed)
      ? normalizeStoredRouteLocationState(parsed.locations) ?? legacyLocationsFromDraft(parsed)
      : null;

    if (
      !isRecord(parsed) ||
      !locations ||
      typeof parsed.departureTimeLocal !== "string" ||
      typeof parsed.timeZone !== "string" ||
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > TRIP_LAUNCH_MAX_AGE_MS
    ) {
      return null;
    }

    return {
      version: 3,
      locations,
      waypoints: (Array.isArray(parsed.waypoints) ? parsed.waypoints : [])
        .slice(0, MAX_WAYPOINTS)
        .map(parseWaypointDraft)
        .filter((stop): stop is EditableStop => stop !== null),
      timeZone: parsed.timeZone.slice(0, 120),
      timeZoneManuallySet: Boolean(parsed.timeZoneManuallySet),
      departureTimeLocal: parsed.departureTimeLocal.slice(0, 32),
      createdAt: new Date(createdAt).toISOString(),
      requiresLocationConfirmation: !normalizeStoredRouteLocationState(parsed.locations),
    };
  } catch {
    return null;
  }
}

function routeStateFromEndpoints(
  origin: RouteEndpointSelection,
  destination: RouteEndpointSelection,
  sameCity: boolean,
): RouteLocationState {
  return {
    start: {
      cityQuery: origin.city.displayName,
      city: origin.city,
      placeQuery: origin.place?.displayName ?? "",
      place: origin.place ?? null,
    },
    destination: {
      cityQuery: sameCity ? "" : destination.city.displayName,
      city: sameCity ? null : destination.city,
      placeQuery: destination.place?.displayName ?? "",
      place: destination.place ?? null,
    },
    sameCity,
    savedDifferentCityDestination: null,
    notice: null,
  };
}

function createAnalysisInputSignature({
  endpoints,
  waypoints,
  departureTimeLocal,
  timeZone,
}: {
  endpoints: {
    origin: RouteEndpointSelection;
    destination: RouteEndpointSelection;
  };
  waypoints: EditableStop[];
  departureTimeLocal: string;
  timeZone: string;
}) {
  return JSON.stringify({
    origin: [
      endpoints.origin.effectiveLatitude,
      endpoints.origin.effectiveLongitude,
    ],
    destination: [
      endpoints.destination.effectiveLatitude,
      endpoints.destination.effectiveLongitude,
    ],
    waypoints: waypoints.flatMap((waypoint) =>
      waypoint.selected
        ? [[waypoint.selected.lat, waypoint.selected.lon]]
        : [],
    ),
    departureTimeLocal,
    timeZone,
  });
}

function describeEndpointPrecision(
  endpoint: RouteEndpointSelection,
  role: "starting point" | "destination",
) {
  if (endpoint.usesCityFallback) {
    return `${role} uses an approximate city location in ${endpoint.city.cityName}`;
  }

  switch (endpoint.place?.precision) {
    case "rooftop":
    case "entrance":
      return null;
    case "parcel":
      return `${role} is mapped at property level`;
    case "street":
      return `${role} is mapped at street level`;
    case "intersection":
      return `${role} is mapped to an intersection`;
    case "postal":
      return `${role} uses a postal-area point`;
    default:
      return `${role} uses an approximate provider-mapped point`;
  }
}

export function AnalyzeTripShell() {
  const [locations, dispatchLocations] = useReducer(
    routeLocationReducer,
    undefined,
    createInitialRouteLocationState,
  );
  const [waypoints, setWaypoints] = useState<EditableStop[]>([]);
  const [departureTimeLocal, setDepartureTimeLocal] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [timeZoneManuallySet, setTimeZoneManuallySet] = useState(false);
  const [originTimeZoneSuggestion, setOriginTimeZoneSuggestion] = useState<string | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<RouteAnalysisResponse | null>(null);
  const [analyzedEndpoints, setAnalyzedEndpoints] = useState<{
    origin: RouteEndpointSelection;
    destination: RouteEndpointSelection;
  } | null>(null);
  const [analyzedDeparture, setAnalyzedDeparture] = useState<{
    departureTimeLocal: string;
    timeZone: string;
  } | null>(null);
  const [analyzedInputSignature, setAnalyzedInputSignature] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<TripStage>("input");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RouteFormFieldErrors>({});
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  const [isPlannerReady, setIsPlannerReady] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [showDetailedEvidence, setShowDetailedEvidence] = useState(false);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const stageContentRef = useRef<HTMLElement | null>(null);
  const hasRestoredDraftRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const restoredTrip = consumeGuestTripRestore();
      const launchedTrip = consumeTripLaunch();
      const draft = loadTripDraft();
      let freshDepartureTimeZone = getBrowserTimeZone();

      if (restoredTrip) {
        if (restoredTrip.originEndpoint && restoredTrip.destinationEndpoint) {
          dispatchLocations({
            type: "LOAD_ROUTE_LOCATIONS",
            state: routeStateFromEndpoints(
              restoredTrip.originEndpoint,
              restoredTrip.destinationEndpoint,
              restoredTrip.sameCity,
            ),
          });
        } else {
          const legacyState = createInitialRouteLocationState();
          legacyState.start.cityQuery = restoredTrip.legacyOrigin?.label ?? "";
          legacyState.destination.cityQuery = restoredTrip.legacyDestination?.label ?? "";
          dispatchLocations({ type: "LOAD_ROUTE_LOCATIONS", state: legacyState });
        }
        setWaypoints(
          restoredTrip.waypoints.map((waypoint, index) => ({
            id: `waypoint-restored-${index + 1}`,
            query: waypoint.label,
            selected: waypoint,
          })),
        );
        setTimeZone(restoredTrip.timeZone);
        freshDepartureTimeZone = restoredTrip.timeZone;
        setTimeZoneManuallySet(true);
        setRestoreNotice(
          restoredTrip.requiresCityConfirmation
            ? "This older trip was preserved, but its cities must be reconfirmed before a new analysis. SnowRoute did not reuse unverifiable address coordinates as city centers."
            : "Route restored from trip history. A fresh departure time was selected so the next analysis uses current forecasts.",
        );
      } else if (launchedTrip) {
        dispatchLocations({
          type: "LOAD_ROUTE_LOCATIONS",
          state: launchedTrip.locations,
        });
        setWaypoints(launchedTrip.waypoints);
        setTimeZone(launchedTrip.timeZone);
        freshDepartureTimeZone = launchedTrip.timeZone;
        setTimeZoneManuallySet(launchedTrip.timeZoneManuallySet);
        setDepartureTimeLocal(launchedTrip.departureTimeLocal);
        setRestoreNotice(
          launchedTrip.requiresLocationConfirmation
            ? "The older route text was preserved. Confirm each city before searching an optional exact place."
            : "Trip details carried over from the homepage. Review the route and departure before analyzing.",
        );
      } else if (draft) {
        dispatchLocations({ type: "LOAD_ROUTE_LOCATIONS", state: draft.locations });
        setWaypoints(draft.waypoints);
        setTimeZone(draft.timeZone);
        freshDepartureTimeZone = draft.timeZone;
        setTimeZoneManuallySet(draft.timeZoneManuallySet);
        if (draft.requiresLocationConfirmation) {
          setRestoreNotice(
            "A previous route draft was preserved. Confirm each city before adding an exact address or place.",
          );
        }
      } else {
        setTimeZone(freshDepartureTimeZone);
      }

      // A deliberate same-session homepage launch keeps its selected time. Drafts and
      // history restores use a fresh +1 hour departure so stale plans never become active.
      if (!launchedTrip || restoredTrip) {
        setDepartureTimeLocal(
          getDefaultDepartureTimeLocal(freshDepartureTimeZone),
        );
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

    saveTripDraft({
      version: 3,
      locations,
      waypoints,
      timeZone,
      timeZoneManuallySet,
    });
  }, [locations, timeZone, timeZoneManuallySet, waypoints]);

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
    setActiveStage(nextStage);
    window.requestAnimationFrame(() => {
      document.getElementById(`trip-stage-${nextStage}`)?.focus();
    });
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

  function handleLocationAction(action: RouteLocationAction) {
    dispatchLocations(action);
    if (action.type === "EDIT_START_CITY" || action.type === "CLEAR_START_CITY") {
      setOriginTimeZoneSuggestion(null);
    }
    setFieldErrors((current) =>
      current.departure ? { departure: current.departure } : {},
    );
    setAnalysisError(null);
  }

  function handleStartCitySelected(city: CitySelection) {
    const inferredTimeZone = city.timezone ?? inferTimeZoneFromLocation({
      country: city.countryName,
      detail: [city.regionName, city.countryName].filter(Boolean).join(", "),
      label: city.displayName,
      lon: city.longitude,
      region: city.regionName ?? null,
    });

    if (inferredTimeZone && !timeZoneManuallySet) {
      setTimeZone(inferredTimeZone);
      setDepartureTimeLocal(getDefaultDepartureTimeLocal(inferredTimeZone));
    }
    setOriginTimeZoneSuggestion(null);
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
      setDepartureTimeLocal(
        getDefaultDepartureTimeLocal(originTimeZoneSuggestion),
      );
      setTimeZoneManuallySet(true);
      setOriginTimeZoneSuggestion(null);
    }
  }

  function handleClearTrip() {
    analyzeAbortRef.current?.abort();
    clearTripDraft();
    dispatchLocations({ type: "RESET_ROUTE_LOCATIONS" });
    setWaypoints([]);
    const browserTimeZone = getBrowserTimeZone();
    setDepartureTimeLocal(getDefaultDepartureTimeLocal(browserTimeZone));
    setTimeZone(browserTimeZone);
    setTimeZoneManuallySet(false);
    setOriginTimeZoneSuggestion(null);
    setAnalysis(null);
    setAnalyzedEndpoints(null);
    setAnalyzedDeparture(null);
    setAnalyzedInputSignature(null);
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
    const destinationCity = getDestinationCity(locations);
    const endpoints = getRouteEndpointSelections(locations);
    const localFieldErrors: RouteFormFieldErrors = {
      ...(!locations.start.city
        ? {
            startCity:
              "Choose a starting city. Select a city from the suggestions before analyzing the route.",
          }
        : {}),
      ...(locations.start.placeQuery.trim() && !locations.start.place
        ? {
            startPlace: `Choose a starting address or leave it blank. Select a suggestion${locations.start.city ? ` in ${locations.start.city.cityName}` : ""}, or clear the field to use the city.`,
          }
        : {}),
      ...(!destinationCity
        ? {
            destinationCity:
              "Choose a destination city. Select a city from the suggestions before analyzing the route.",
          }
        : {}),
      ...(locations.destination.placeQuery.trim() && !locations.destination.place
        ? {
            destinationPlace: `Choose a destination address or leave it blank. Select a suggestion${destinationCity ? ` in ${destinationCity.cityName}` : ""}, or clear the field to use the city.`,
          }
        : {}),
      ...(!departureTimeLocal
        ? { departure: "Choose a complete departure date and time." }
        : {}),
      ...(hasIncompleteWaypoint
        ? { waypoints: "Choose a verified suggestion for every added stop, or remove it." }
        : {}),
    };

    if (Object.keys(localFieldErrors).length > 0 || !endpoints) {
      setFieldErrors(localFieldErrors);
      setAnalysisError(null);
      trackLocationEvent("route_form_validation_failed", {
        errorCode: !locations.start.city
          ? "START_CITY_UNRESOLVED"
          : !destinationCity
            ? "DESTINATION_CITY_UNRESOLVED"
            : hasIncompleteWaypoint
              ? "WAYPOINT_UNRESOLVED"
              : "PLACE_UNRESOLVED",
      });
      return;
    }

    if (routeEndpointsAreEffectivelyIdentical(endpoints.origin, endpoints.destination)) {
      setFieldErrors({});
      setAnalysisError(
        "The starting point and destination are the same. Choose two different addresses or places.",
      );
      trackLocationEvent("route_form_validation_failed", {
        errorCode: "SAME_EFFECTIVE_LOCATION",
      });
      return;
    }

    const departureDate = fromZonedTime(departureTimeLocal, timeZone);

    if (Number.isNaN(departureDate.getTime())) {
      setFieldErrors({ departure: "Choose a complete, valid departure date and time." });
      setAnalysisError(null);
      return;
    }

    setIsSubmitting(true);
    setAnalysisError(null);
    setFieldErrors({});
    setRestoreNotice(null);
    analyzeAbortRef.current?.abort();
    const abortController = new AbortController();
    analyzeAbortRef.current = abortController;
    trackLocationEvent("route_analysis_started", {
      usesCityFallback:
        endpoints.origin.usesCityFallback || endpoints.destination.usesCityFallback,
    });

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          origin: {
            label: endpoints.origin.effectiveDisplayName,
            lat: endpoints.origin.effectiveLatitude,
            lon: endpoints.origin.effectiveLongitude,
          },
          destination: {
            label: endpoints.destination.effectiveDisplayName,
            lat: endpoints.destination.effectiveLatitude,
            lon: endpoints.destination.effectiveLongitude,
          },
          effectiveEndpoints: {
            origin: toEffectiveRouteEndpoint(endpoints.origin),
            destination: toEffectiveRouteEndpoint(endpoints.destination),
          },
          sameCity: locations.sameCity,
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
          originEndpoint: endpoints.origin,
          destinationEndpoint: endpoints.destination,
          sameCity: locations.sameCity,
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
          geocoderProvider: nextAnalysis.metadata.geocoderProvider,
          distanceKm: nextAnalysis.route.distanceKm,
          durationMinutes: nextAnalysis.route.durationMinutes,
        }, {
          analyzedAt: new Date(nextAnalysis.metadata.analyzedAt),
        }),
      ).catch(() => undefined);

      startTransition(() => {
        setAnalysis(nextAnalysis);
        setAnalyzedEndpoints(endpoints);
        setAnalyzedDeparture({ departureTimeLocal, timeZone });
        setAnalyzedInputSignature(
          createAnalysisInputSignature({
            endpoints,
            waypoints,
            departureTimeLocal,
            timeZone,
          }),
        );
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

  const latestRouteName = analyzedEndpoints
    ? `${analyzedEndpoints.origin.effectiveDisplayName} to ${analyzedEndpoints.destination.effectiveDisplayName}`
    : "Latest analyzed route";
  const routePrecisionNote = analyzedEndpoints
    ? [
        describeEndpointPrecision(analyzedEndpoints.origin, "starting point"),
        describeEndpointPrecision(analyzedEndpoints.destination, "destination"),
      ]
        .filter(Boolean)
        .join("; ") || null
    : null;
  const currentEndpoints = getRouteEndpointSelections(locations);
  const analysisIsStale = Boolean(
    analysis &&
      analyzedInputSignature &&
      (!currentEndpoints ||
        createAnalysisInputSignature({
          endpoints: currentEndpoints,
          waypoints,
          departureTimeLocal,
          timeZone,
        }) !== analyzedInputSignature),
  );
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
                locations={locations}
                waypoints={waypoints}
                departureTimeLocal={departureTimeLocal}
                timeZone={timeZone}
                originTimeZoneSuggestion={originTimeZoneSuggestion}
                isSubmitting={isSubmitting}
                fieldErrors={fieldErrors}
                onLocationAction={handleLocationAction}
                onStartCitySelected={handleStartCitySelected}
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
                  clearFieldError("waypoints");
                }}
                onWaypointSelect={(id, suggestion) => {
                  setWaypoints((currentWaypoints) =>
                    currentWaypoints.map((waypoint) =>
                      waypoint.id === id
                        ? { ...waypoint, query: suggestion.label, selected: suggestion }
                        : waypoint,
                    ),
                  );
                  clearFieldError("waypoints");
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
              {analysisIsStale ? (
                <section
                  role="status"
                  className="rounded-2xl border border-amber-200/25 bg-amber-200/[0.07] px-5 py-4 text-sm leading-6 text-amber-50"
                >
                  <p className="font-semibold">These results reflect the previous trip details.</p>
                  <p className="mt-1 text-amber-50/80">
                    Your current route, stop, departure, or time zone changed after this
                    analysis. Return to Trip details and analyze again for updated guidance.
                  </p>
                </section>
              ) : null}

              <DecisionCard decision={analysis.tripDecision} />

              <section className="glass-panel rounded-2xl p-5 sm:p-6 lg:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="eyebrow">Analyzed route</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {latestRouteName}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      Departure: {analyzedDeparture?.departureTimeLocal.replace("T", " at ")} • {analyzedDeparture?.timeZone}
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
                    </dl>
                    {routePrecisionNote ? (
                      <p className="mt-3 max-w-3xl text-xs leading-5 text-amber-100/85">
                        Endpoint precision note: {routePrecisionNote}.
                      </p>
                    ) : null}
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

              <SaferDepartureCard
                decision={analysis.tripDecision}
                onUseDeparture={handleUseSuggestedDeparture}
              />

              <DangerWindows decision={analysis.tripDecision} />

              <details
                id="route-details"
                className="group scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.025]"
                onToggle={(event) => setShowDetailedEvidence(event.currentTarget.open)}
              >
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 px-5 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-100 sm:px-6">
                  <span>
                    <span className="eyebrow block">Detailed route evidence</span>
                    <span className="mt-1 block text-sm text-slate-300">
                      Map, departure comparison, checkpoints, timeline, and model details
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-xl text-cyan-100 transition group-open:rotate-45">+</span>
                </summary>
                {showDetailedEvidence ? (
                  <div className="space-y-6 border-t border-white/10 p-5 sm:p-6">
                    <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                      <div className="flex gap-1.5">
                        <dt className="font-semibold text-slate-300">Risk model</dt>
                        <dd>{analysis.metadata.riskModelVersion}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="font-semibold text-slate-300">Route provider</dt>
                        <dd>{analysis.metadata.routeProvider}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="font-semibold text-slate-300">Weather provider</dt>
                        <dd>{analysis.metadata.weatherProvider}</dd>
                      </div>
                    </dl>

                    <MapErrorBoundary>
                      <RouteMap
                        analysis={analysis}
                        activeSampleId={activeSampleId}
                        onSelectSample={setActiveSampleId}
                      />
                    </MapErrorBoundary>

                    <DepartureTimeOptimizer optimization={analysis.departureOptimization} />

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                      <SegmentTable
                        samples={analysis.samples}
                        activeSampleId={activeSampleId}
                        onSelectSample={setActiveSampleId}
                      />
                      <RiskTimeline samples={analysis.samples} activeSampleId={activeSampleId} />
                    </div>
                  </div>
                ) : null}
              </details>

              <ForecastLimitations decision={analysis.tripDecision} />
            </section>
          ) : null}

          {activeStage === "strategy" && analysis ? <StrategySuggestions analysis={analysis} /> : null}
        </main>

        <div className="mt-6">
          <HowItWorks />
        </div>
      </div>
    </div>
  );
}
