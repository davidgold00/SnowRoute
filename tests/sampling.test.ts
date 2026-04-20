import { describe, expect, it } from "vitest";

import {
  buildCumulativeDistances,
  getSampleCount,
  interpolateAlongRoute,
  sampleRoute,
} from "../lib/sampling";

describe("sampling engine", () => {
  it("builds cumulative distance monotonically even with duplicate coordinates", () => {
    const coordinates = [
      { lat: 43.65, lon: -79.38 },
      { lat: 43.65, lon: -79.38 },
      { lat: 43.66, lon: -79.2 },
    ];

    const cumulative = buildCumulativeDistances(coordinates);

    expect(cumulative).toHaveLength(3);
    expect(cumulative[0]).toBe(0);
    expect(cumulative[1]).toBe(0);
    expect(cumulative[2]).toBeGreaterThan(cumulative[1]);
  });

  it("interpolates along a multi-segment route and preserves turn points", () => {
    const coordinates = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      { lat: 1, lon: 1 },
    ];
    const cumulative = buildCumulativeDistances(coordinates);
    const halfway = interpolateAlongRoute(
      coordinates,
      cumulative,
      (cumulative.at(-1) ?? 0) / 2,
    );

    expect(halfway.coordinate.lat).toBeCloseTo(0, 2);
    expect(halfway.coordinate.lon).toBeCloseTo(1, 2);
  });

  it("preserves route endpoints and increases ETAs across sampled points", () => {
    const route = sampleRoute({
      coordinates: [
        { lat: 43.65, lon: -79.38 },
        { lat: 43.68, lon: -79.12 },
      ],
      departureTimeUtc: "2026-01-05T12:00:00.000Z",
      durationMinutes: 120,
    });

    expect(route).toHaveLength(12);
    expect(route[0].coordinate).toEqual({ lat: 43.65, lon: -79.38 });
    expect(route.at(-1)?.coordinate).toEqual({ lat: 43.68, lon: -79.12 });
    expect(route[0].distanceKm).toBe(0);
    expect(route.at(-1)?.distanceKm ?? 0).toBeGreaterThan(route[0].distanceKm);

    const etaTimes = route.map((sample) => new Date(sample.etaUtc).getTime());
    expect(etaTimes).toEqual([...etaTimes].sort((left, right) => left - right));
  });

  it("keeps the sampling count inside the configured floor and cap", () => {
    expect(getSampleCount(5)).toBe(12);
    expect(getSampleCount(260)).toBe(13);
    expect(getSampleCount(1800)).toBe(48);
  });

  it("handles very short routes without losing the final coordinate", () => {
    const route = sampleRoute({
      coordinates: [
        { lat: 45.4215, lon: -75.6972 },
        { lat: 45.4217, lon: -75.6969 },
      ],
      departureTimeUtc: "2026-02-08T09:00:00.000Z",
      durationMinutes: 5,
    });

    expect(route).toHaveLength(12);
    expect(route.at(-1)?.coordinate).toEqual({ lat: 45.4217, lon: -75.6969 });
  });
});
