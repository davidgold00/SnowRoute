import { describe, expect, it } from "vitest";

import { buildDepartureOptimization } from "../lib/departure-optimization";
import type { DepartureTimeOption, RiskLabel } from "../lib/types";

function createOption(
  hour: number,
  overrides: Partial<DepartureTimeOption> = {},
): DepartureTimeOption {
  const overallScore = overrides.overallScore ?? 20;
  const label = overrides.label ?? ("Low" as RiskLabel);

  return {
    id: `departure-${String(hour).padStart(2, "0")}`,
    hour,
    departureTimeUtc: `2026-01-05T${String(hour).padStart(2, "0")}:00:00.000Z`,
    departureTimeDisplay: `${hour}:00`,
    hourLabel: `${hour}`,
    safetyScore: 100 - overallScore,
    overallScore,
    averageScore: overrides.averageScore ?? overallScore,
    maxScore: overrides.maxScore ?? overallScore,
    label,
    recommendation: overrides.recommendation ?? "Safe",
    hazardWindowCount: overrides.hazardWindowCount ?? 0,
    severeWindowCount: overrides.severeWindowCount ?? 0,
    forecastCoverageRatio: overrides.forecastCoverageRatio ?? 1,
    dataQuality: overrides.dataQuality ?? {
      missingSnowfallSamples: 0,
      missingVisibilitySamples: 0,
      fallbackMatches: 0,
      unmatchedSamples: 0,
      incompleteWeatherSamples: 0,
    },
    isSelectedHour: overrides.isSelectedHour ?? false,
    guidance: overrides.guidance ?? {
      headline: `${label} risk`,
      impact: "Synthetic impact",
      gamePlan: "Synthetic plan",
    },
    ...overrides,
  };
}

describe("departure optimization", () => {
  it("selects the lowest risk departure time", () => {
    const optimization = buildDepartureOptimization({
      travelDateDisplay: "Mon, Jan 5",
      options: [
        createOption(8, { overallScore: 31, maxScore: 44 }),
        createOption(9, { overallScore: 18, maxScore: 30 }),
        createOption(10, { overallScore: 25, maxScore: 25 }),
      ],
    });

    expect(optimization.bestOptionIds).toEqual(["departure-09"]);
    expect(optimization.summary).toContain("9:00 is the safest");
    expect(optimization.isEquallySafe).toBe(false);
  });

  it("uses max score and hazard windows as tie breakers", () => {
    const optimization = buildDepartureOptimization({
      travelDateDisplay: "Mon, Jan 5",
      options: [
        createOption(8, { overallScore: 20, maxScore: 35, hazardWindowCount: 0 }),
        createOption(9, { overallScore: 20, maxScore: 26, hazardWindowCount: 1 }),
        createOption(10, { overallScore: 20, maxScore: 26, hazardWindowCount: 0 }),
      ],
    });

    expect(optimization.bestOptionIds).toEqual(["departure-10"]);
  });

  it("describes an all-day tie when every checked option has the same risk profile", () => {
    const optimization = buildDepartureOptimization({
      travelDateDisplay: "Mon, Jan 5",
      options: [
        createOption(0, { overallScore: 12, maxScore: 18 }),
        createOption(1, { overallScore: 12, maxScore: 18 }),
        createOption(2, { overallScore: 12, maxScore: 18 }),
      ],
    });

    expect(optimization.isEquallySafe).toBe(true);
    expect(optimization.bestOptionIds).toEqual([
      "departure-00",
      "departure-01",
      "departure-02",
    ]);
    expect(optimization.summary).toContain("effectively equal");
  });

  it("does not promote incomplete forecast windows when complete options exist", () => {
    const optimization = buildDepartureOptimization({
      travelDateDisplay: "Mon, Jan 5",
      options: [
        createOption(8, {
          overallScore: 0,
          forecastCoverageRatio: 0.5,
          dataQuality: {
            missingSnowfallSamples: 2,
            missingVisibilitySamples: 2,
            fallbackMatches: 0,
            unmatchedSamples: 2,
            incompleteWeatherSamples: 2,
          },
        }),
        createOption(9, { overallScore: 18 }),
        createOption(10, { overallScore: 24 }),
      ],
    });

    expect(optimization.bestOptionIds).toEqual(["departure-09"]);
    expect(optimization.summary).toContain("fully matched forecast windows");
  });
});
