import { describe, expect, it } from "vitest";

import {
  createGuestTripHistoryEntry,
  deserializeGuestTripHistory,
  mergeGuestTripHistory,
  normalizeGuestTripHistory,
  serializeGuestTripHistory,
  type NewGuestTripHistoryEntry,
} from "../lib/guest-trip-history";
import type { LocationSuggestion } from "../lib/types";

function location(id: string, lat: number, lon: number, label = id): LocationSuggestion {
  return {
    id,
    label,
    lat,
    lon,
    country: "US",
    region: "Michigan",
    detail: null,
    placeType: "City",
  };
}

function historyInput(index: number, overrides: Partial<NewGuestTripHistoryEntry> = {}): NewGuestTripHistoryEntry {
  return {
    origin: location(`origin-${index}`, 42 + index / 100, -83, `Origin ${index}`),
    destination: location(`destination-${index}`, 43 + index / 100, -84, `Destination ${index}`),
    waypoints: [],
    departureTimeLocal: "2026-01-05T12:00",
    departureTimeUtc: "2026-01-05T17:00:00.000Z",
    timeZone: "America/Detroit",
    decision: "CAUTION",
    decisionLabel: "Use caution",
    decisionSummary: "Some winter hazards are expected along this route.",
    overallRisk: "Moderate",
    confidence: "High",
    mainHazards: ["Snow"],
    worstSegmentRisk: "Moderate",
    worstSegmentLocationLabel: "near Brighton, Michigan",
    worstSegmentArrivalTime: "Jan 5, 1:30 PM EST",
    riskModelVersion: "driving-hazard-v2.0.0",
    distanceKm: 220,
    durationMinutes: 155,
    ...overrides,
  };
}

function entry(index: number, analyzedAt = new Date(`2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`)) {
  return createGuestTripHistoryEntry(historyInput(index), {
    id: `trip-${index}`,
    analyzedAt,
  });
}

describe("guest trip history", () => {
  it("serializes and restores valid bounded history", () => {
    const trips = [entry(0), entry(1)];
    const restored = deserializeGuestTripHistory(serializeGuestTripHistory(trips));

    expect(restored).toHaveLength(2);
    expect(restored[0].id).toBe("trip-1");
    expect(restored[1]).toMatchObject({
      id: "trip-0",
      decision: "CAUTION",
      timeZone: "America/Detroit",
    });
  });

  it("returns an empty collection for malformed or unsupported data", () => {
    expect(deserializeGuestTripHistory("not-json")).toEqual([]);
    expect(deserializeGuestTripHistory(JSON.stringify({ version: 99, entries: [entry(0)] }))).toEqual([]);
    expect(normalizeGuestTripHistory([{ version: 1, id: "partial" }])).toEqual([]);
  });

  it("keeps only the 20 most recent unique analyses", () => {
    const trips = Array.from({ length: 25 }, (_, index) => entry(index));
    const normalized = normalizeGuestTripHistory(trips);

    expect(normalized).toHaveLength(20);
    expect(normalized[0].id).toBe("trip-24");
    expect(normalized.at(-1)?.id).toBe("trip-5");
  });

  it("deduplicates the same route and retains its newest analysis", () => {
    const older = createGuestTripHistoryEntry(historyInput(0), {
      id: "older",
      analyzedAt: new Date("2026-01-01T12:00:00.000Z"),
    });
    const newer = createGuestTripHistoryEntry(
      historyInput(0, {
        origin: location("renamed-origin", 42, -83, "A newer display label"),
        decision: "DELAY",
        decisionLabel: "Delay recommended",
      }),
      { id: "newer", analyzedAt: new Date("2026-01-02T12:00:00.000Z") },
    );

    const merged = mergeGuestTripHistory([older], newer);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: "newer", decision: "DELAY" });
  });
});
