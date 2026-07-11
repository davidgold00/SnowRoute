import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { searchCitiesMock, searchPlacesMock } = vi.hoisted(() => ({
  searchCitiesMock: vi.fn(),
  searchPlacesMock: vi.fn(),
}));

vi.mock("@/lib/geocoding", () => ({
  searchCities: searchCitiesMock,
  searchPlaces: searchPlacesMock,
}));

import { POST as searchCityRoute } from "../app/api/locations/cities/route";
import { POST as searchPlaceRoute } from "../app/api/locations/places/route";
import type { CitySelection, PlaceSelection } from "../lib/types";

const city: CitySelection = {
  providerId: "whosonfirst:locality:detroit",
  displayName: "Detroit, Michigan, United States",
  cityName: "Detroit",
  regionName: "Michigan",
  regionCode: "MI",
  countryName: "United States",
  countryCode: "USA",
  postalCode: null,
  latitude: 42.3314,
  longitude: -83.0458,
  boundingBox: {
    west: -83.287803,
    south: 42.25496,
    east: -82.910427,
    north: 42.45023,
  },
  timezone: null,
  precision: "locality",
  providerConfidence: 1,
};

const place: PlaceSelection = {
  providerId: "openstreetmap:address:woodward",
  displayName: "100 Woodward Avenue",
  formattedAddress: "100 Woodward Avenue, Detroit, Michigan, United States",
  primaryText: "100 Woodward Avenue",
  secondaryText: "Detroit, Michigan, United States · Address",
  latitude: 42.329,
  longitude: -83.043,
  placeType: "address",
  precision: "street",
  cityName: "Detroit",
  regionName: "Michigan",
  countryCode: "USA",
  postalCode: "48226",
  cityRelationship: "WITHIN_SELECTED_CITY",
  providerConfidence: 1,
  matchType: "exact",
  source: "openstreetmap",
};

function postRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("city-first location API contracts", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    searchCitiesMock.mockReset();
    searchPlacesMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns normalized city results with safe cache metadata", async () => {
    searchCitiesMock.mockResolvedValue({
      data: { results: [city] },
      cacheStatus: "hit",
    });

    const response = await searchCityRoute(
      postRequest("/api/locations/cities", { query: "Detroit", countryCode: "us" }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(payload).toMatchObject({
      ok: true,
      data: { results: [{ cityName: "Detroit", countryCode: "USA" }] },
      meta: {
        cache: "hit",
        provider: "openrouteservice-pelias",
      },
    });
    expect(searchCitiesMock).toHaveBeenCalledWith(
      { query: "Detroit", countryCode: "US" },
      { signal: expect.any(AbortSignal) },
    );
  });

  it("rejects malformed city input before calling the provider", async () => {
    const response = await searchCityRoute(
      postRequest("/api/locations/cities", { query: "D", countryCode: "not-a-code" }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST", retryable: false },
    });
    expect(searchCitiesMock).not.toHaveBeenCalled();
  });

  it("returns in-city and nearby place groups without echoing the query in metadata", async () => {
    searchPlacesMock.mockResolvedValue({
      data: {
        results: [place],
        nearbyResults: [],
        normalizedQuery: "100 Woodward Avenue",
        unitRoutingNote: null,
      },
      cacheStatus: "miss",
    });

    const response = await searchPlaceRoute(
      postRequest("/api/locations/places", {
        query: "100 Woodward Avenue",
        city,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      data: {
        results: [{ primaryText: "100 Woodward Avenue" }],
        nearbyResults: [],
      },
      meta: {
        cache: "miss",
        provider: "openrouteservice-pelias",
      },
    });
    expect(payload.meta).not.toHaveProperty("query");
  });
});
