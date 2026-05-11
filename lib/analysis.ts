import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { buildDepartureOptimization } from "@/lib/departure-optimization";
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
import { resolveWeatherForSamples } from "@/lib/weather";

type SampledPoint = ReturnType<typeof sampleRoute>[number];
type WeatherMatch = Awaited<ReturnType<typeof resolveWeatherForSamples>>[number];

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
      guidance: risk.guidance,
    };
  });
}

function buildHourlyDeparturesForTravelDay({
  departureTimeUtc,
  clientTimeZone,
}: {
  departureTimeUtc: string;
  clientTimeZone: string;
}) {
  const selectedDeparture = new Date(departureTimeUtc);
  const travelDate = formatInTimeZone(selectedDeparture, clientTimeZone, "yyyy-MM-dd");
  const selectedHour = Number(
    formatInTimeZone(selectedDeparture, clientTimeZone, "H"),
  );

  return Array.from({ length: 24 }, (_, hour) => {
    const localDateTime = `${travelDate}T${String(hour).padStart(2, "0")}:00:00`;
    const departureDate = fromZonedTime(localDateTime, clientTimeZone);

    return {
      hour,
      departureTimeUtc: departureDate.toISOString(),
      departureTimeDisplay: formatInTimeZone(departureDate, clientTimeZone, "h a"),
      hourLabel: formatInTimeZone(departureDate, clientTimeZone, "haaa"),
      isSelectedHour: hour === selectedHour,
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

export async function analyzeRoute(input: AnalyzeRouteInput): Promise<RouteAnalysisResponse> {
  const orderedStops = [input.origin, ...input.waypoints, input.destination];
  const directions = await getRouteDirections(orderedStops);
  const routeCoordinates = decodePolyline(directions.encodedPolyline);

  if (routeCoordinates.length < 2) {
    throw new Error("The route provider did not return a drivable path.");
  }

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

  const allWeatherMatches = await resolveWeatherForSamples(
    [...sampledPoints, ...departureSamples].map((sample) => ({
      coordinate: sample.coordinate,
      etaUtc: sample.etaUtc,
    })),
  );
  const weatherMatches = allWeatherMatches.slice(0, sampledPoints.length);
  const departureWeatherMatches = allWeatherMatches.slice(sampledPoints.length);

  const samples = createRouteSamples({
    sampledPoints,
    weatherMatches,
    displayTimeZone: input.clientTimeZone,
    idPrefix: "sample",
  });

  const routeSegments = buildRiskSegments(routeCoordinates, samples);
  const hazardWindows = buildHazardWindows(samples, input.clientTimeZone);
  const summary = buildTripSummary(samples, hazardWindows, routeSegments);
  const departureOptimization = buildDepartureOptimizationForDay({
    routeCoordinates,
    input,
    departures: departureCandidates,
    sampledGroups: departureSampleGroups,
    weatherMatches: departureWeatherMatches,
  });

  return {
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
  };
}
