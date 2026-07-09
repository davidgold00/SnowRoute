import { describe, expect, it } from "vitest";

import { buildTripDecision } from "../lib/decision-engine";
import type {
  DepartureOptimization,
  DepartureTimeOption,
  HazardWindow,
  RouteSample,
  RouteSummary,
} from "../lib/types";

function sample(id: string, score: number, distanceKm: number): RouteSample {
  const label = score >= 75 ? "Severe" : score >= 50 ? "High" : score >= 25 ? "Moderate" : "Low";

  return {
    id,
    coordinate: { lat: 40 + distanceKm / 1000, lon: -105 },
    distanceKm,
    etaUtc: `2026-01-05T${String(12 + distanceKm / 100).padStart(2, "0")}:00:00.000Z`,
    etaDisplay: `Jan 5, ${12 + distanceKm / 100}:00 MST`,
    pointTimeZone: "America/Denver",
    weather: {
      temperatureC: -2,
      precipitationMm: score >= 50 ? 1.2 : 0,
      snowfallCm: score >= 50 ? 1.1 : 0,
      visibilityKm: score >= 50 ? 0.8 : 10,
      windSpeedKph: 15,
      windGustKph: score >= 50 ? 60 : 20,
      weatherCode: score >= 50 ? 73 : 0,
      isDay: true,
      condition: score >= 50 ? "Snow" : "Clear skies",
      summary: score >= 50 ? "Snow" : "Clear skies",
      matchedHourUtc: "2026-01-05T12:00:00.000Z",
      matchDistanceMinutes: 0,
      source: "exact",
    },
    score,
    label,
    explanationFactors:
      score >= 50 ? ["Steady snowfall expected", "Low visibility conditions"] : [],
    factors:
      score >= 50
        ? [
            { key: "snowfall", label: "Steady snowfall expected", contribution: 22 },
            { key: "visibility", label: "Low visibility conditions", contribution: 20 },
          ]
        : [],
    guidance: { headline: "Test", impact: "Test", gamePlan: "Test" },
  };
}

function summary(samples: RouteSample[]): RouteSummary {
  const maxScore = Math.max(...samples.map((item) => item.score));
  const overallScore = Math.round(samples.reduce((total, item) => total + item.score, 0) / samples.length);

  return {
    overallScore,
    overallLabel: overallScore >= 75 ? "Severe" : overallScore >= 50 ? "High" : overallScore >= 25 ? "Moderate" : "Low",
    recommendation: "Safe",
    worstSegmentId: null,
    averageScore: overallScore,
    maxScore,
    dataQuality: {
      missingSnowfallSamples: 0,
      missingVisibilitySamples: 0,
      fallbackMatches: 0,
      unmatchedSamples: 0,
      incompleteWeatherSamples: 0,
    },
    guidance: { headline: "Test", impact: "Test", gamePlan: "Test" },
  };
}

function option(id: string, label: DepartureTimeOption["label"], isSelectedHour: boolean): DepartureTimeOption {
  const overallScore = label === "Severe" ? 82 : label === "High" ? 62 : label === "Moderate" ? 35 : 12;

  return {
    id,
    hour: id === "selected" ? 14 : 8,
    departureTimeUtc: id === "selected" ? "2026-01-05T21:00:00.000Z" : "2026-01-05T15:00:00.000Z",
    departureTimeDisplay: id === "selected" ? "2 PM" : "8 AM",
    hourLabel: id === "selected" ? "2pm" : "8am",
    safetyScore: 100 - overallScore,
    overallScore,
    averageScore: overallScore,
    maxScore: overallScore + 5,
    label,
    recommendation: label === "Low" ? "Safe" : label === "Moderate" ? "Use caution" : "Delay recommended",
    hazardWindowCount: label === "Low" ? 0 : 1,
    severeWindowCount: label === "Severe" ? 1 : 0,
    forecastCoverageRatio: 1,
    dataQuality: summary([sample("quality", 10, 0)]).dataQuality,
    isSelectedHour,
    guidance: { headline: "Test option", impact: "Test", gamePlan: "Test" },
  };
}

function optimization(options: DepartureTimeOption[]): DepartureOptimization {
  const best = [...options].sort((left, right) => left.overallScore - right.overallScore)[0];
  return {
    travelDateDisplay: "Mon, Jan 5",
    summary: "Test optimization",
    isEquallySafe: false,
    bestOptionIds: [best.id],
    bestDepartureTimeDisplays: [best.departureTimeDisplay],
    options,
  };
}

function window(startSampleIndex: number, endSampleIndex: number, samples: RouteSample[]): HazardWindow {
  const start = samples[startSampleIndex];
  const end = samples[endSampleIndex];
  const maxScore = Math.max(...samples.slice(startSampleIndex, endSampleIndex + 1).map((item) => item.score));

  return {
    id: "danger-1",
    startEtaUtc: start.etaUtc,
    endEtaUtc: end.etaUtc,
    startEtaDisplay: start.etaDisplay,
    endEtaDisplay: end.etaDisplay,
    maxScore,
    label: maxScore >= 75 ? "Severe" : "High",
    dominantFactors: ["Steady snowfall expected", "Low visibility conditions"],
    guidance: { headline: "Test", impact: "Test", gamePlan: "Test" },
    sampleIds: samples.slice(startSampleIndex, endSampleIndex + 1).map((item) => item.id),
    startSampleIndex,
    endSampleIndex,
    approximateLocationLabel: `near route km ${start.distanceKm}`,
    summary: "High winter risk from snow and low visibility.",
  };
}

describe("trip decision engine", () => {
  it("returns GO for a fully matched low-risk route", () => {
    const samples = [sample("one", 8, 0), sample("two", 12, 40), sample("three", 10, 80)];
    const decision = buildTripDecision({
      samples,
      hazardWindows: [],
      summary: summary(samples),
      departureOptimization: optimization([option("selected", "Low", true)]),
    });

    expect(decision.decision).toBe("GO");
    expect(decision.confidence).toBe("High");
  });

  it("recommends DELAY when an hourly alternative materially lowers route risk", () => {
    const samples = [sample("one", 25, 0), sample("two", 68, 40), sample("three", 62, 80)];
    const decision = buildTripDecision({
      samples,
      hazardWindows: [window(1, 2, samples)],
      summary: summary(samples),
      departureOptimization: optimization([option("selected", "High", true), option("better", "Moderate", false)]),
    });

    expect(decision.decision).toBe("DELAY");
    expect(decision.saferDepartureWindows[0]?.departureTime).toBe("8 AM");
  });

  it("recommends HOLD when a later high-risk stretch follows manageable checkpoints", () => {
    const samples = [sample("one", 12, 0), sample("two", 18, 35), sample("three", 66, 70), sample("four", 68, 105)];
    const decision = buildTripDecision({
      samples,
      hazardWindows: [window(2, 3, samples)],
      summary: summary(samples),
      departureOptimization: optimization([option("selected", "High", true)]),
    });

    expect(decision.decision).toBe("HOLD");
    expect(decision.holdRecommendation?.holdBeforeSegmentIndex).toBe(1);
  });

  it("recommends AVOID for sustained severe risk with no safer departure", () => {
    const samples = [sample("one", 80, 0), sample("two", 86, 40), sample("three", 84, 80)];
    const decision = buildTripDecision({
      samples,
      hazardWindows: [window(0, 2, samples)],
      summary: summary(samples),
      departureOptimization: optimization([option("selected", "Severe", true)]),
    });

    expect(decision.decision).toBe("AVOID");
  });
});
