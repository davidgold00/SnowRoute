import { afterEach, describe, expect, it } from "vitest";

import {
  consumeGuestTripRestore,
  createGuestTripHistoryEntry,
  deserializeGuestTripHistory,
  getGuestTripLocationLabel,
  mergeGuestTripHistory,
  normalizeGuestTripHistory,
  parseGuestTripHistoryEntry,
  queueGuestTripRestore,
  serializeGuestTripHistory,
  type NewGuestTripHistoryEntry,
} from "../lib/guest-trip-history";
import { createRouteEndpointSelection } from "../lib/route-location-state";
import type {
  CitySelection,
  LocationSuggestion,
  PlaceSelection,
  RouteEndpointSelection,
} from "../lib/types";

function city(
  id: string,
  latitude: number,
  longitude: number,
  cityName = id,
): CitySelection {
  return {
    providerId: `city:${id}`,
    displayName: `${cityName}, Michigan, United States`,
    cityName,
    regionName: "Michigan",
    regionCode: "MI",
    countryName: "United States",
    countryCode: "US",
    latitude,
    longitude,
    boundingBox: {
      west: longitude - 0.3,
      south: latitude - 0.3,
      east: longitude + 0.3,
      north: latitude + 0.3,
    },
    timezone: "America/Detroit",
    precision: "city",
    providerConfidence: 0.95,
  };
}

function place(
  id: string,
  selectedCity: CitySelection,
  latitude = selectedCity.latitude + 0.01,
  longitude = selectedCity.longitude + 0.01,
): PlaceSelection {
  return {
    providerId: `place:${id}`,
    displayName: `${id} address`,
    formattedAddress: `${id} address, ${selectedCity.displayName}`,
    primaryText: `${id} address`,
    secondaryText: selectedCity.displayName,
    latitude,
    longitude,
    placeType: "address",
    precision: "street",
    cityName: selectedCity.cityName,
    regionName: selectedCity.regionName,
    countryCode: selectedCity.countryCode,
    postalCode: "48201",
    cityRelationship: "WITHIN_SELECTED_CITY",
    providerConfidence: 0.9,
    source: "openrouteservice",
  };
}

function legacyLocation(
  id: string,
  lat: number,
  lon: number,
  label = id,
): LocationSuggestion {
  return {
    id,
    label,
    lat,
    lon,
    country: "United States",
    countryCode: "US",
    region: "Michigan",
    detail: null,
    placeType: "City",
    locationType: "city",
    precision: "city",
  };
}

function historyInput(
  index: number,
  overrides: Partial<NewGuestTripHistoryEntry> = {},
): NewGuestTripHistoryEntry {
  const originCity = city(
    `origin-${index}`,
    42 + index / 100,
    -83,
    `Origin ${index}`,
  );
  const destinationCity = city(
    `destination-${index}`,
    43 + index / 100,
    -84,
    `Destination ${index}`,
  );

  return {
    originEndpoint: createRouteEndpointSelection(originCity, place(`start-${index}`, originCity)),
    destinationEndpoint: createRouteEndpointSelection(destinationCity, null),
    sameCity: false,
    waypoints: [],
    geocoderProvider: "openrouteservice Geocoding API",
    departureTimeLocal: "2026-01-05T12:00",
    departureTimeUtc: "2026-01-05T17:00:00.000Z",
    timeZone: "America/Detroit",
    decision: "CAUTION",
    decisionLabel: "Use caution",
    decisionSummary: "Some driving hazards are expected along this route.",
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

function entry(
  index: number,
  analyzedAt = new Date(
    `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
  ),
) {
  return createGuestTripHistoryEntry(historyInput(index), {
    id: `trip-${index}`,
    analyzedAt,
  });
}

function versionOneEntry(index = 0) {
  return {
    version: 1,
    id: `legacy-${index}`,
    fingerprint: "untrusted-old-fingerprint",
    analyzedAt: "2026-01-01T12:00:00.000Z",
    origin: legacyLocation("old-origin", 42.3314, -83.0458, "Old Detroit address"),
    destination: legacyLocation("old-destination", 41.8781, -87.6298, "Old Chicago address"),
    waypoints: [],
    departureTimeLocal: "2026-01-05T12:00",
    departureTimeUtc: "2026-01-05T17:00:00.000Z",
    timeZone: "America/Detroit",
    decision: "CAUTION",
    decisionLabel: "Use caution",
    decisionSummary: "Legacy analysis summary.",
    overallRisk: "Moderate",
    confidence: "High",
    mainHazards: ["Snow"],
    worstSegmentRisk: "Moderate",
    worstSegmentLocationLabel: "near the prior route",
    worstSegmentArrivalTime: "Jan 5, 1:30 PM EST",
    riskModelVersion: "driving-hazard-v1",
    distanceKm: 450,
    durationMinutes: 300,
  };
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  constructor(private readonly blocked = false) {}

  get length() {
    return this.values.size;
  }

  clear() {
    this.assertAvailable();
    this.values.clear();
  }

  getItem(key: string) {
    this.assertAvailable();
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    this.assertAvailable();
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.assertAvailable();
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.assertAvailable();
    this.values.set(key, value);
  }

  private assertAvailable() {
    if (this.blocked) {
      throw new Error("Storage is blocked.");
    }
  }
}

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

function installWindowStorage(sessionStorage: Storage, localStorage: Storage) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage, localStorage },
  });
}

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

describe("guest trip history", () => {
  it("serializes and restores structured v2 history", () => {
    const trips = [entry(0), entry(1)];
    const restored = deserializeGuestTripHistory(serializeGuestTripHistory(trips));

    expect(restored).toHaveLength(2);
    expect(restored[0]).toMatchObject({
      version: 2,
      id: "trip-1",
      sameCity: false,
      requiresCityConfirmation: false,
      geocoderProvider: "openrouteservice Geocoding API",
      originEndpoint: {
        usesCityFallback: false,
        place: { providerId: "place:start-1" },
      },
      destinationEndpoint: { usesCityFallback: true },
    });
  });

  it("migrates v1 envelopes without fabricating city selections", () => {
    const restored = deserializeGuestTripHistory(
      JSON.stringify({ version: 1, entries: [versionOneEntry()] }),
    );

    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      version: 2,
      originEndpoint: null,
      destinationEndpoint: null,
      sameCity: false,
      requiresCityConfirmation: true,
      legacyOrigin: { label: "Old Detroit address" },
      legacyDestination: { label: "Old Chicago address" },
    });
    expect(getGuestTripLocationLabel(restored[0], "origin")).toBe("Old Detroit address");
    expect(restored[0].fingerprint).not.toBe("untrusted-old-fingerprint");
  });

  it("accepts a minimally flat legacy location and preserves its display text", () => {
    const legacy = versionOneEntry();
    legacy.origin = {
      label: "Preserved legacy origin",
      lat: 42.3,
      lon: -83.1,
    } as LocationSuggestion;

    const restored = parseGuestTripHistoryEntry(legacy);

    expect(restored?.legacyOrigin).toMatchObject({
      label: "Preserved legacy origin",
      lat: 42.3,
      lon: -83.1,
      placeType: "Place",
    });
    expect(restored?.requiresCityConfirmation).toBe(true);
  });

  it("canonicalizes effective endpoint fields from the selected city or place", () => {
    const saved = entry(0);
    const raw = JSON.parse(JSON.stringify(saved)) as {
      originEndpoint: RouteEndpointSelection;
    };
    raw.originEndpoint.effectiveLatitude = 0;
    raw.originEndpoint.effectiveLongitude = 0;
    raw.originEndpoint.usesCityFallback = true;

    const restored = parseGuestTripHistoryEntry(raw);

    expect(restored?.originEndpoint).toMatchObject({
      effectiveLatitude: saved.originEndpoint?.place?.latitude,
      effectiveLongitude: saved.originEndpoint?.place?.longitude,
      usesCityFallback: false,
    });
  });

  it("preserves stale provider IDs when valid saved coordinates remain", () => {
    const saved = entry(0);
    const raw = JSON.parse(JSON.stringify(saved)) as {
      originEndpoint: RouteEndpointSelection;
    };
    raw.originEndpoint.city.providerId = "expired-provider-city-id";
    raw.originEndpoint.place!.providerId = "expired-provider-place-id";

    const restored = parseGuestTripHistoryEntry(raw);

    expect(restored?.originEndpoint?.city.providerId).toBe("expired-provider-city-id");
    expect(restored?.originEndpoint?.place?.providerId).toBe("expired-provider-place-id");
  });

  it("rejects malformed, mixed, or unsupported records", () => {
    const mixed = entry(0);
    const mismatchedSameCity = entry(1);
    mismatchedSameCity.sameCity = true;

    expect(deserializeGuestTripHistory("not-json")).toEqual([]);
    expect(
      deserializeGuestTripHistory(JSON.stringify({ version: 99, entries: [entry(0)] })),
    ).toEqual([]);
    expect(normalizeGuestTripHistory([{ version: 2, id: "partial" }])).toEqual([]);
    expect(
      parseGuestTripHistoryEntry({
        ...mixed,
        legacyOrigin: legacyLocation("legacy", 42, -83),
        legacyDestination: legacyLocation("legacy-2", 43, -84),
      }),
    ).toBeNull();
    expect(parseGuestTripHistoryEntry(mismatchedSameCity)).toBeNull();
  });

  it("keeps only the 20 most recent unique analyses", () => {
    const trips = Array.from({ length: 25 }, (_, index) => entry(index));
    const normalized = normalizeGuestTripHistory(trips);

    expect(normalized).toHaveLength(20);
    expect(normalized[0].id).toBe("trip-24");
    expect(normalized.at(-1)?.id).toBe("trip-5");
  });

  it("deduplicates the same structured route and retains its newest analysis", () => {
    const older = createGuestTripHistoryEntry(historyInput(0), {
      id: "older",
      analyzedAt: new Date("2026-01-01T12:00:00.000Z"),
    });
    const newer = createGuestTripHistoryEntry(
      historyInput(0, {
        decision: "DELAY",
        decisionLabel: "Delay recommended",
      }),
      { id: "newer", analyzedAt: new Date("2026-01-02T12:00:00.000Z") },
    );

    const merged = mergeGuestTripHistory([older], newer);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: "newer", decision: "DELAY" });
  });

  it("does not collapse city fallback and exact-place routes at the same coordinates", () => {
    const sharedCity = city("shared", 42.3314, -83.0458, "Detroit");
    const exactPlace = place(
      "same-coordinate-place",
      sharedCity,
      sharedCity.latitude,
      sharedCity.longitude,
    );
    const fallbackEntry = createGuestTripHistoryEntry(
      historyInput(0, {
        originEndpoint: createRouteEndpointSelection(sharedCity, null),
      }),
      { id: "fallback", analyzedAt: new Date("2026-01-01T12:00:00.000Z") },
    );
    const exactEntry = createGuestTripHistoryEntry(
      historyInput(0, {
        originEndpoint: createRouteEndpointSelection(sharedCity, exactPlace),
      }),
      { id: "exact", analyzedAt: new Date("2026-01-02T12:00:00.000Z") },
    );

    expect(normalizeGuestTripHistory([fallbackEntry, exactEntry])).toHaveLength(2);
    expect(fallbackEntry.fingerprint).not.toBe(exactEntry.fingerprint);
  });

  it("queues and consumes structured and legacy restore payloads", () => {
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    installWindowStorage(sessionStorage, localStorage);

    expect(queueGuestTripRestore(entry(0))).toBe(true);
    expect(consumeGuestTripRestore()).toMatchObject({
      id: "trip-0",
      requiresCityConfirmation: false,
      originEndpoint: { place: { providerId: "place:start-0" } },
    });
    expect(consumeGuestTripRestore()).toBeNull();

    localStorage.setItem(
      "snowroute.tripHistoryRestore.v1",
      JSON.stringify(versionOneEntry(2)),
    );
    expect(consumeGuestTripRestore()).toMatchObject({
      id: "legacy-2",
      requiresCityConfirmation: true,
      originEndpoint: null,
    });
  });

  it("reports queue failure when browser storage is blocked", () => {
    installWindowStorage(new MemoryStorage(true), new MemoryStorage(true));
    expect(queueGuestTripRestore(entry(0))).toBe(false);
  });
});
