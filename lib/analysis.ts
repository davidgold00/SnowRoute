import { formatInTimeZone } from "date-fns-tz";

import { decodePolyline } from "@/lib/polyline";
import { buildHazardWindows, buildTripSummary, scoreRouteSampleRisk } from "@/lib/risk";
import { getRouteDirections } from "@/lib/routing";
import { buildRiskSegments, sampleRoute } from "@/lib/sampling";
import type { AnalyzeRouteInput, RouteAnalysisResponse, RouteSample } from "@/lib/types";
import { resolveWeatherForSamples } from "@/lib/weather";

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

  const weatherMatches = await resolveWeatherForSamples(
    sampledPoints.map((sample) => ({
      coordinate: sample.coordinate,
      etaUtc: sample.etaUtc,
    })),
  );

  const samples: RouteSample[] = sampledPoints.map((sample, index) => {
    const weatherMatch = weatherMatches[index];
    const risk = scoreRouteSampleRisk({
      etaUtc: sample.etaUtc,
      pointTimeZone: weatherMatch.pointTimeZone,
      weather: weatherMatch.weather,
    });

    return {
      id: `sample-${index + 1}`,
      coordinate: sample.coordinate,
      distanceKm: Number(sample.distanceKm.toFixed(1)),
      etaUtc: sample.etaUtc,
      etaDisplay: formatInTimeZone(
        new Date(sample.etaUtc),
        input.clientTimeZone,
        "MMM d, HH:mm zzz",
      ),
      pointTimeZone: weatherMatch.pointTimeZone,
      weather: weatherMatch.weather,
      score: risk.score,
      label: risk.label,
      explanationFactors: risk.explanationFactors,
      factors: risk.factors,
    };
  });

  const routeSegments = buildRiskSegments(routeCoordinates, samples);
  const hazardWindows = buildHazardWindows(samples, input.clientTimeZone);
  const summary = buildTripSummary(samples, hazardWindows, routeSegments);

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
  };
}
