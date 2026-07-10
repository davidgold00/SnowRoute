import { describe, expect, it } from "vitest";

import {
  buildHazardWindows,
  buildTripSummary,
  getRiskLabel,
  scoreRouteSampleRisk,
} from "../lib/risk";
import type {
  NormalizedWeatherSnapshot,
  RiskGuidance,
  RouteSample,
  RouteSegment,
} from "../lib/types";

function createWeather(
  overrides: Partial<NormalizedWeatherSnapshot> = {},
): NormalizedWeatherSnapshot {
  return {
    temperatureC: -1,
    precipitationMm: 0,
    snowfallCm: 0,
    visibilityKm: 10,
    windSpeedKph: 10,
    windGustKph: 15,
    weatherCode: 0,
    isDay: true,
    condition: "Clear skies",
    summary: "Clear skies • -1C",
    matchedHourUtc: "2026-01-05T12:00:00.000Z",
    matchDistanceMinutes: 0,
    source: "exact",
    ...overrides,
  };
}

function createGuidance(score: number): RiskGuidance {
  return {
    headline: `Synthetic risk ${score}`,
    impact: "Synthetic impact for tests.",
    gamePlan: "Synthetic plan for tests.",
  };
}

function createSample(
  score: number,
  overrides: Partial<RouteSample> = {},
): RouteSample {
  const factors = overrides.factors ?? [];

  return {
    id: overrides.id ?? `sample-${score}`,
    coordinate: overrides.coordinate ?? { lat: 43.65, lon: -79.38 },
    distanceKm: overrides.distanceKm ?? score,
    etaUtc:
      overrides.etaUtc ??
      `2026-01-05T${String((score % 24) + 1).padStart(2, "0")}:00:00.000Z`,
    etaDisplay:
      overrides.etaDisplay ??
      `Jan 5, ${String((score % 24) + 1).padStart(2, "0")}:00 EST`,
    pointTimeZone: overrides.pointTimeZone ?? "America/Toronto",
    weather: overrides.weather ?? createWeather(),
    score,
    label: overrides.label ?? getRiskLabel(score),
    explanationFactors:
      overrides.explanationFactors ?? factors.slice(0, 3).map((factor) => factor.label),
    factors,
    guidance: overrides.guidance ?? createGuidance(score),
  };
}

function createSegment(score: number, id: string): RouteSegment {
  return {
    id,
    coordinates: [
      { lat: 43.65, lon: -79.38 },
      { lat: 43.66, lon: -79.2 },
    ],
    score,
    label: getRiskLabel(score),
    fromSampleId: `${id}-from`,
    toSampleId: `${id}-to`,
  };
}

describe("risk scoring", () => {
  it("assigns labels at the documented score thresholds", () => {
    expect(getRiskLabel(24)).toBe("Low");
    expect(getRiskLabel(25)).toBe("Moderate");
    expect(getRiskLabel(50)).toBe("High");
    expect(getRiskLabel(75)).toBe("Severe");
  });

  it("elevates risk when precipitation arrives near freezing", () => {
    const risk = scoreRouteSampleRisk({
      etaUtc: "2026-01-05T12:15:00.000Z",
      pointTimeZone: "UTC",
      weather: createWeather({
        temperatureC: -0.5,
        precipitationMm: 1.8,
        snowfallCm: null,
        weatherCode: 67,
      }),
    });

    expect(risk.score).toBeGreaterThanOrEqual(75);
    expect(risk.label).toBe("Severe");
    expect(risk.explanationFactors).toContain(
      "Freezing precipitation creates a high-loss-of-control risk",
    );
    expect(risk.guidance.gamePlan).toContain("Avoid travel");
  });

  it("adds visibility and wind penalties on top of baseline winter factors", () => {
    const risk = scoreRouteSampleRisk({
      etaUtc: "2026-01-05T17:00:00.000Z",
      pointTimeZone: "UTC",
      weather: createWeather({
        visibilityKm: 0.8,
        windGustKph: 70,
        weatherCode: 45,
      }),
    });

    expect(risk.score).toBeGreaterThanOrEqual(50);
    expect(risk.label).toBe("High");
    expect(risk.explanationFactors).toContain("Low visibility conditions");
    expect(
      risk.explanationFactors.some((factor) => factor.includes("wind")),
    ).toBe(true);
  });

  it("adds a night-driving penalty when winter precipitation is present", () => {
    const daytimeRisk = scoreRouteSampleRisk({
      etaUtc: "2026-01-05T12:00:00.000Z",
      pointTimeZone: "UTC",
      weather: createWeather({ snowfallCm: 0.5, weatherCode: 71 }),
    });
    const overnightRisk = scoreRouteSampleRisk({
      etaUtc: "2026-01-05T23:00:00.000Z",
      pointTimeZone: "UTC",
      weather: createWeather({ snowfallCm: 0.5, weatherCode: 71 }),
    });

    expect(overnightRisk.score).toBeGreaterThan(daytimeRisk.score);
    expect(overnightRisk.explanationFactors).toContain(
      "Night driving lowers visibility and reaction time",
    );
  });

  it("surfaces severe weather codes even when snowfall and visibility are missing", () => {
    const risk = scoreRouteSampleRisk({
      etaUtc: "2026-01-05T23:00:00.000Z",
      pointTimeZone: "UTC",
      weather: createWeather({
        snowfallCm: null,
        visibilityKm: null,
        weatherCode: 96,
      }),
    });

    expect(risk.score).toBeGreaterThan(0);
    expect(risk.explanationFactors[0]).toBe("Thunderstorm with hail can make travel erratic");
    expect(risk.guidance.impact).toContain("road-weather hazards");
  });

  it("treats snow, wind, and near-whiteout visibility as severe", () => {
    const risk = scoreRouteSampleRisk({
      etaUtc: "2026-01-05T23:00:00.000Z",
      pointTimeZone: "UTC",
      weather: createWeather({
        snowfallCm: 1.2,
        visibilityKm: 0.3,
        windGustKph: 62,
        weatherCode: 73,
      }),
    });

    expect(risk.score).toBeGreaterThanOrEqual(75);
    expect(risk.label).toBe("Severe");
    expect(risk.explanationFactors).toContain("Near-whiteout or dense fog visibility");
    expect(
      risk.factors.some((factor) =>
        factor.label.includes("Wind and snow can create blowing snow"),
      ),
    ).toBe(true);
  });
});

describe("hazard windows and trip summary", () => {
  it("merges hazardous periods across a single lower-risk checkpoint gap", () => {
    const samples = [
      createSample(20),
      createSample(58, {
        factors: [{ key: "snow", label: "Heavy snowfall expected", contribution: 20 }],
      }),
      createSample(35),
      createSample(62, {
        factors: [
          {
            key: "ice",
            label: "Temperature near freezing increases ice risk",
            contribution: 18,
          },
        ],
      }),
      createSample(15),
    ];

    const windows = buildHazardWindows(samples, "UTC");

    expect(windows).toHaveLength(1);
    expect(windows[0].sampleIds).toEqual(["sample-58", "sample-35", "sample-62"]);
  });

  it("recommends delaying travel when a brief severe pocket appears", () => {
    const samples = [
      createSample(18),
      createSample(28),
      createSample(82, {
        factors: [{ key: "snow", label: "Heavy snowfall expected", contribution: 26 }],
      }),
      createSample(22),
      createSample(16),
      createSample(14),
    ];
    const windows = buildHazardWindows(samples, "UTC");
    const summary = buildTripSummary(samples, windows, [
      createSegment(28, "segment-1"),
      createSegment(82, "segment-2"),
    ]);

    expect(summary.recommendation).toBe("Delay recommended");
    expect(summary.worstSegmentId).toBe("segment-2");
  });
});
