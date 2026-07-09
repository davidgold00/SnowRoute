import { describe, expect, it } from "vitest";

import { buildWeatherHoldStrategies } from "../lib/strategy";
import type { RouteAnalysisResponse, RouteSample } from "../lib/types";

function sample(id: string, score: number, distanceKm: number): RouteSample {
  return {
    id,
    coordinate: { lat: 43.6, lon: -79.4 },
    distanceKm,
    etaUtc: "2026-01-05T14:00:00.000Z",
    etaDisplay: "Jan 5, 14:00 EST",
    pointTimeZone: "America/Toronto",
    weather: {
      temperatureC: -1,
      precipitationMm: 1.2,
      snowfallCm: 1.1,
      visibilityKm: 0.6,
      windSpeedKph: 42,
      windGustKph: 58,
      weatherCode: 73,
      isDay: true,
      condition: "Snow",
      summary: "Snow",
      matchedHourUtc: "2026-01-05T14:00:00.000Z",
      matchDistanceMinutes: 0,
      source: "exact",
    },
    score,
    label: score >= 75 ? "Severe" : score >= 50 ? "High" : "Low",
    explanationFactors: ["Heavy snow", "Low visibility"],
    factors: [],
    guidance: { headline: "Test", impact: "Test", gamePlan: "Test" },
  };
}

function createAnalysis(): RouteAnalysisResponse {
  const samples = [sample("sample-1", 20, 0), sample("sample-2", 90, 45)];

  return {
    route: { coordinates: [], distanceKm: 45, durationMinutes: 60, segments: [] },
    samples,
    hazardWindows: [
      {
        id: "hazard-1",
        startEtaUtc: samples[1].etaUtc,
        endEtaUtc: samples[1].etaUtc,
        startEtaDisplay: samples[1].etaDisplay,
        endEtaDisplay: samples[1].etaDisplay,
        maxScore: 90,
        label: "Severe",
        dominantFactors: ["Heavy snow"],
        guidance: samples[1].guidance,
        sampleIds: ["sample-2"],
      },
    ],
    summary: {
      overallScore: 70,
      overallLabel: "High",
      recommendation: "Delay recommended",
      worstSegmentId: null,
      averageScore: 55,
      maxScore: 90,
      dataQuality: {
        missingSnowfallSamples: 0,
        missingVisibilitySamples: 0,
        fallbackMatches: 0,
        unmatchedSamples: 0,
        incompleteWeatherSamples: 0,
      },
      guidance: samples[1].guidance,
    },
    departureOptimization: {
      travelDateDisplay: "Jan 5",
      summary: "Test",
      isEquallySafe: false,
      bestOptionIds: [],
      bestDepartureTimeDisplays: [],
      options: [],
    },
  };
}

describe("weather-hold strategies", () => {
  it("places a hold decision before a hazardous stretch and explains the forecast evidence", () => {
    const [strategy] = buildWeatherHoldStrategies(createAnalysis());

    expect(strategy.holdPoint.id).toBe("sample-1");
    expect(strategy.hazardStart.id).toBe("sample-2");
    expect(strategy.likelihood).toBeGreaterThanOrEqual(75);
    expect(strategy.likelihoodLabel).toBe("High");
    expect(strategy.evidence).toContain("0.6 km forecast visibility");
  });

  it("returns no stop points when the analysis has no sustained high-risk windows", () => {
    const analysis = createAnalysis();
    analysis.hazardWindows = [];

    expect(buildWeatherHoldStrategies(analysis)).toEqual([]);
  });
});
