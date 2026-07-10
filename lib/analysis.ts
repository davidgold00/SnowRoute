import { formatInTimeZone } from "date-fns-tz";

import { buildDepartureOptimization } from "@/lib/departure-optimization";
import { buildHourlyDeparturesForTravelDay } from "@/lib/departure-candidates";
import { buildTripDecision } from "@/lib/decision-engine";
import { buildAnalysisMetadata } from "@/lib/hazard-engine";
import { decodePolyline } from "@/lib/polyline";
import { buildHazardWindows, buildTripSummary, scoreRouteSampleRisk } from "@/lib/risk";
import { getRouteDirections } from "@/lib/routing";
import { buildRiskSegments, sampleRoute } from "@/lib/sampling";
import type {
  AnalyzeRouteInput,
  DepartureOptimization,
  DepartureTimeOption,
  RouteAnalysisResponse,
  RouteSample,
} from "@/lib/types";
import { resolveWeatherForSamples, WeatherProviderError } from "@/lib/weather";

type SampledPoint = ReturnType<typeof sampleRoute>[number];
type WeatherMatch = Awaited<ReturnType<typeof resolveWeatherForSamples>>[number];

export type AnalysisTimingSummary = {
  routingMs: number;
  samplingMs: number;
  forecastMs: number;
  riskAnalysisMs: number;
  departureComparisonMs: number;
  totalMs: number;
};

function createRouteSamples({
  sampledPoints,
  weatherMatches,
  displayTimeZone,
  idPrefix,
}: {
  sampledPoints: SampledPoint[];
  weatherMatches: WeatherMatch[];
  displayTimeZone: string;
  idPrefix: string;
}): RouteSample[] {
  return sampledPoints.map((sample, index) => {
    const weatherMatch = weatherMatches[index];
    const risk = scoreRouteSampleRisk({
      etaUtc: sample.etaUtc,
      pointTimeZone: weatherMatch.pointTimeZone,
      weather: weatherMatch.weather,
    });

    return {
      id: `${idPrefix}-${index + 1}`,
      coordinate: sample.coordinate,
      distanceKm: Number(sample.distanceKm.toFixed(1)),
      etaUtc: sample.etaUtc,
      etaDisplay: formatInTimeZone(
        new Date(sample.etaUtc),
        displayTimeZone,
        "MMM d, HH:mm zzz",
      ),
      pointTimeZone: weatherMatch.pointTimeZone,
      weather: weatherMatch.weather,
      score: risk.score,
      label: risk.label,
      explanationFactors: risk.explanationFactors,
      factors: risk.factors,
      hazards: risk.hazards,
      hazardConfidence: risk.hazardConfidence,
      hazardConfidenceReasons: risk.hazardConfidenceReasons,
      guidance: risk.guidance,
    };
  });
}

function buildDepartureOptimizationForDay({
  routeCoordinates,
  input,
  departures,
  sampledGroups,
  weatherMatches,
}: {
  routeCoordinates: Array<{ lat: number; lon: number }>;
  input: AnalyzeRouteInput;
  departures: ReturnType<typeof buildHourlyDeparturesForTravelDay>;
  sampledGroups: SampledPoint[][];
  weatherMatches: WeatherMatch[];
}): DepartureOptimization {
  const travelDateDisplay = formatInTimeZone(
    new Date(input.departureTimeUtc),
    input.clientTimeZone,
    "EEE, MMM d",
  );
  let matchCursor = 0;

  const options: DepartureTimeOption[] = departures.map((departure, index) => {
    const sampledPoints = sampledGroups[index];
    const groupWeatherMatches = weatherMatches.slice(
      matchCursor,
      matchCursor + sampledPoints.length,
    );
    matchCursor += sampledPoints.length;

    const samples = createRouteSamples({
      sampledPoints,
      weatherMatches: groupWeatherMatches,
      displayTimeZone: input.clientTimeZone,
      idPrefix: `departure-${String(departure.hour).padStart(2, "0")}`,
    });
    const routeSegments = buildRiskSegments(routeCoordinates, samples);
    const hazardWindows = buildHazardWindows(samples, input.clientTimeZone);
    const summary = buildTripSummary(samples, hazardWindows, routeSegments);
    const severeWindowCount = hazardWindows.filter(
      (window) => window.label === "Severe",
    ).length;

    return {
      id: `departure-${String(departure.hour).padStart(2, "0")}`,
      hour: departure.hour,
      departureTimeUtc: departure.departureTimeUtc,
      departureTimeDisplay: departure.departureTimeDisplay,
      hourLabel: departure.hourLabel,
      safetyScore: 100 - summary.overallScore,
      overallScore: summary.overallScore,
      averageScore: summary.averageScore,
      maxScore: summary.maxScore,
      label: summary.overallLabel,
      recommendation: summary.recommendation,
      hazardWindowCount: hazardWindows.length,
      severeWindowCount,
      forecastCoverageRatio:
        samples.length === 0
          ? 0
          : (samples.length - summary.dataQuality.unmatchedSamples) / samples.length,
      dataQuality: summary.dataQuality,
      isSelectedHour: departure.isSelectedHour,
      guidance: summary.guidance,
    };
  });

  return buildDepartureOptimization({
    travelDateDisplay,
    options,
  });
}

export async function analyzeRoute(
  input: AnalyzeRouteInput,
  options: {
    signal?: AbortSignal;
    onTimings?: (timings: AnalysisTimingSummary) => void;
  } = {},
): Promise<RouteAnalysisResponse> {
  const analysisStartedAt = Date.now();
  const routingStartedAt = Date.now();
  const orderedStops = [input.origin, ...input.waypoints, input.destination];
  const directions = await getRouteDirections(orderedStops, options.signal);
  const routingMs = Date.now() - routingStartedAt;
  const routeCoordinates = decodePolyline(directions.encodedPolyline);

  if (routeCoordinates.length < 2) {
    throw new Error("The route provider did not return a drivable path.");
  }

  const samplingStartedAt = Date.now();
  const sampledPoints = sampleRoute({
    coordinates: routeCoordinates,
    departureTimeUtc: input.departureTimeUtc,
    durationMinutes: directions.durationMinutes,
  });
  const departureCandidates = buildHourlyDeparturesForTravelDay({
    departureTimeUtc: input.departureTimeUtc,
    clientTimeZone: input.clientTimeZone,
  });
  const departureSampleGroups = departureCandidates.map((departure) =>
    sampleRoute({
      coordinates: routeCoordinates,
      departureTimeUtc: departure.departureTimeUtc,
      durationMinutes: directions.durationMinutes,
    }),
  );
  const departureSamples = departureSampleGroups.flat();
  const samplingMs = Date.now() - samplingStartedAt;

  const forecastStartedAt = Date.now();
  const allWeatherMatches = await resolveWeatherForSamples(
    [...sampledPoints, ...departureSamples].map((sample) => ({
      coordinate: sample.coordinate,
      etaUtc: sample.etaUtc,
    })),
    options.signal,
  );
  const forecastMs = Date.now() - forecastStartedAt;
  const weatherMatches = allWeatherMatches.slice(0, sampledPoints.length);
  const departureWeatherMatches = allWeatherMatches.slice(sampledPoints.length);
  const selectedCoverageCount = weatherMatches.filter(
    (match) => match.weather.source !== "unavailable",
  ).length;
  const selectedCoverageRatio =
    weatherMatches.length === 0 ? 0 : selectedCoverageCount / weatherMatches.length;

  if (selectedCoverageCount === 0) {
    throw new WeatherProviderError(
      "FORECAST_UNAVAILABLE",
      "No supported forecast hours matched the selected route timing.",
    );
  }

  if (selectedCoverageRatio < 0.6) {
    throw new WeatherProviderError(
      "FORECAST_PARTIALLY_UNAVAILABLE",
      "Too little of the selected route has supported forecast coverage.",
    );
  }

  const primaryRiskStartedAt = Date.now();
  const samples = createRouteSamples({
    sampledPoints,
    weatherMatches,
    displayTimeZone: input.clientTimeZone,
    idPrefix: "sample",
  });

  const routeSegments = buildRiskSegments(routeCoordinates, samples);
  const hazardWindows = buildHazardWindows(samples, input.clientTimeZone);
  const summary = buildTripSummary(samples, hazardWindows, routeSegments);
  const primaryRiskMs = Date.now() - primaryRiskStartedAt;
  const departureComparisonStartedAt = Date.now();
  const departureOptimization = buildDepartureOptimizationForDay({
    routeCoordinates,
    input,
    departures: departureCandidates,
    sampledGroups: departureSampleGroups,
    weatherMatches: departureWeatherMatches,
  });
  const departureComparisonMs = Date.now() - departureComparisonStartedAt;
  const decisionStartedAt = Date.now();
  const tripDecision = buildTripDecision({
    samples,
    hazardWindows,
    summary,
    departureOptimization,
  });
  const decisionMs = Date.now() - decisionStartedAt;
  const totalMs = Date.now() - analysisStartedAt;

  options.onTimings?.({
    routingMs,
    samplingMs,
    forecastMs,
    riskAnalysisMs: primaryRiskMs + decisionMs,
    departureComparisonMs,
    totalMs,
  });

  return {
    metadata: buildAnalysisMetadata(),
    route: {
      coordinates: routeCoordinates,
      distanceKm: Number(directions.distanceKm.toFixed(1)),
      durationMinutes: Math.round(directions.durationMinutes),
      segments: routeSegments,
    },
    samples,
    hazardWindows,
    summary,
    departureOptimization,
    tripDecision,
  };
}
