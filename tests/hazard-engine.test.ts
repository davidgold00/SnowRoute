import { describe, expect, it } from "vitest";

import {
  ANALYSIS_VERSION,
  HAZARD_THRESHOLDS,
  RISK_MODEL_VERSION,
  analyzeWeatherHazards,
  buildAnalysisMetadata,
} from "../lib/hazard-engine";
import type { NormalizedWeatherSnapshot } from "../lib/types";

function weather(
  overrides: Partial<NormalizedWeatherSnapshot> = {},
): NormalizedWeatherSnapshot {
  return {
    temperatureC: 8,
    precipitationMm: 0,
    snowfallCm: 0,
    visibilityKm: 16,
    windSpeedKph: 10,
    windGustKph: 16,
    weatherCode: 0,
    isDay: true,
    condition: "Clear skies",
    summary: "Clear skies • 8C",
    matchedHourUtc: "2026-03-05T15:00:00.000Z",
    matchDistanceMinutes: 0,
    source: "exact",
    ...overrides,
  };
}

function analyze(
  overrides: Partial<NormalizedWeatherSnapshot> = {},
  etaUtc = "2026-03-05T15:00:00.000Z",
) {
  return analyzeWeatherHazards({
    etaUtc,
    pointTimeZone: "UTC",
    weather: weather(overrides),
  });
}

describe("multi-hazard engine", () => {
  it("keeps thresholds and model identifiers centralized and versioned", () => {
    expect(RISK_MODEL_VERSION).toBe("risk-model-2.0.0");
    expect(ANALYSIS_VERSION).toBe("route-analysis-2.0.0");
    expect(HAZARD_THRESHOLDS.rainMmPerHour.heavy).toBe(7.5);

    const metadata = buildAnalysisMetadata(new Date("2026-03-05T15:00:00.000Z"));
    expect(metadata).toMatchObject({
      analyzedAt: "2026-03-05T15:00:00.000Z",
      riskModelVersion: RISK_MODEL_VERSION,
      analysisVersion: ANALYSIS_VERSION,
      weatherProvider: "Open-Meteo Forecast API",
      routeProvider: "openrouteservice Directions API",
      geocoderProvider: "openrouteservice Geocoding API",
    });
  });

  it("returns a low score and high confidence for a complete quiet forecast", () => {
    const result = analyze();

    expect(result.riskLevel).toBe("Low");
    expect(result.riskScore).toBe(0);
    expect(result.confidence).toBe("HIGH");
    expect(result.hazards).toEqual([]);
  });

  it("labels near-freezing rain as an inferred icing proxy, not confirmed black ice", () => {
    const result = analyze({
      temperatureC: -0.5,
      precipitationMm: 1.6,
      weatherCode: 61,
    });
    const icing = result.hazards.find((item) => item.type === "possible_icing");

    expect(icing).toMatchObject({
      observedOrForecast: "INFERRED",
      confidence: "MEDIUM",
    });
    expect(icing?.explanation).toContain("proxy");
    expect(JSON.stringify(result)).not.toContain("confirmed black ice");
  });

  it("escalates freezing rain without requiring another hazard field", () => {
    const result = analyze({
      temperatureC: null,
      precipitationMm: null,
      snowfallCm: null,
      visibilityKm: null,
      windSpeedKph: null,
      windGustKph: null,
      weatherCode: 67,
    });

    expect(result.riskScore).toBeGreaterThanOrEqual(75);
    expect(result.riskLevel).toBe("Severe");
    expect(result.hazards.some((item) => item.type === "freezing_rain")).toBe(true);
  });

  it("detects heavy rain and a hydroplaning proxy without claiming flooding", () => {
    const result = analyze({
      temperatureC: 17,
      precipitationMm: 12,
      visibilityKm: 1.2,
      weatherCode: 65,
    });

    expect(result.riskScore).toBeGreaterThanOrEqual(50);
    expect(result.hazards.some((item) => item.type === "heavy_rain")).toBe(true);
    expect(result.hazards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "hydroplaning_risk",
          observedOrForecast: "INFERRED",
        }),
      ]),
    );
    expect(JSON.stringify(result)).toContain("does not confirm roadway flooding");
  });

  it("makes severe thunderstorm and hail codes severe without claiming an official alert", () => {
    const result = analyze({ weatherCode: 99 });
    const storm = result.hazards.find((item) => item.type === "severe_thunderstorm");

    expect(result.riskLevel).toBe("Severe");
    expect(storm?.observedOrForecast).toBe("FORECAST");
    expect(storm?.explanation).toContain("No official warning");
  });

  it("models snow, wind, and very low visibility as a severe interaction", () => {
    const result = analyze({
      temperatureC: -4,
      snowfallCm: 1.3,
      visibilityKm: 0.3,
      windSpeedKph: 40,
      windGustKph: 68,
      weatherCode: 73,
    });

    expect(result.riskScore).toBe(90);
    expect(result.riskLevel).toBe("Severe");
    expect(result.hazards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "blowing_snow", observedOrForecast: "INFERRED" }),
        expect.objectContaining({ type: "compound_hazard" }),
      ]),
    );
  });

  it("treats temperature extremes as exposure, not an automatic avoid decision", () => {
    const cold = analyze({ temperatureC: -42 });
    const heat = analyze({ temperatureC: 46 });

    expect(cold.riskScore).toBeLessThan(50);
    expect(heat.riskScore).toBeLessThan(50);
    expect(cold.hazards[0]?.type).toBe("extreme_cold");
    expect(heat.hazards[0]?.type).toBe("extreme_heat");
  });

  it("does not let darkness create risk without an underlying hazard", () => {
    const quietNight = analyze({ isDay: false }, "2026-03-05T23:00:00.000Z");
    const snowyNight = analyze(
      { isDay: false, snowfallCm: 0.5, weatherCode: 71 },
      "2026-03-05T23:00:00.000Z",
    );

    expect(quietNight.riskScore).toBe(0);
    expect(quietNight.hazards.some((item) => item.type === "night_compounding")).toBe(false);
    expect(snowyNight.hazards.some((item) => item.type === "night_compounding")).toBe(true);
    expect(snowyNight.riskScore).toBeGreaterThan(analyze({ snowfallCm: 0.5, weatherCode: 71 }).riskScore);
  });

  it("lowers confidence for fallback and unavailable forecast matches", () => {
    const nearest = analyze({ source: "nearest", matchDistanceMinutes: 75 });
    const unavailable = analyze({
      source: "unavailable",
      matchedHourUtc: null,
      matchDistanceMinutes: null,
      temperatureC: null,
      precipitationMm: null,
      snowfallCm: null,
      visibilityKm: null,
      windSpeedKph: null,
      windGustKph: null,
      weatherCode: null,
      isDay: null,
    });

    expect(nearest.confidence).toBe("MEDIUM");
    expect(unavailable.confidence).toBe("LOW");
    expect(unavailable.hazards).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "data_uncertainty" })]),
    );
    expect(unavailable.riskScore).toBe(0);
  });
});
