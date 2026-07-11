import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { searchCities, searchPlaces } from "../lib/geocoding";
import type { CitySelection } from "../lib/types";

function peliasResponse(features: unknown[]) {
  return new Response(JSON.stringify({ features }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function cityFeature(name: string) {
  return {
    type: "Feature",
    bbox: [-83.287803, 42.25496, -82.910427, 42.45023],
    geometry: { type: "Point", coordinates: [-83.0458, 42.3314] },
    properties: {
      gid: `whosonfirst:locality:${name.toLowerCase()}`,
      layer: "locality",
      name,
      label: `${name}, MI, USA`,
      locality: name,
      region: "Michigan",
      region_a: "MI",
      country: "United States",
      country_a: "USA",
      confidence: 1,
    },
  };
}

const toronto: CitySelection = {
  providerId: "whosonfirst:locality:toronto",
  displayName: "Toronto, Ontario, Canada",
  cityName: "Toronto",
  regionName: "Ontario",
  regionCode: "ON",
  countryName: "Canada",
  countryCode: "CAN",
  postalCode: null,
  latitude: 43.6532,
  longitude: -79.3832,
  boundingBox: {
    west: -79.6393,
    south: 43.581,
    east: -79.115,
    north: 43.8555,
  },
  timezone: null,
  precision: "locality",
  providerConfidence: 1,
};

const queensParkFeature = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [-79.3926, 43.6677] },
  properties: {
    gid: "openstreetmap:address:queens-park",
    layer: "address",
    source: "openstreetmap",
    name: "100 Queen's Park",
    housenumber: "100",
    street: "Queen's Park",
    locality: "Toronto",
    region: "Ontario",
    region_a: "ON",
    postalcode: "M5S 2C6",
    country: "Canada",
    country_a: "CAN",
    label: "100 Queen's Park, Toronto, ON, Canada",
    confidence: 1,
    match_type: "exact",
    accuracy: "point",
  },
};

describe("openrouteservice city-first provider adapter", () => {
  beforeEach(() => {
    process.env.ORS_API_KEY = "test-only-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.ORS_API_KEY;
  });

  it("uses ORS autocomplete with city layers, country context, and a header-only key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(peliasResponse([cityFeature("Headercity")]));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await searchCities({
      query: "Headercity",
      countryCode: "USA",
    });

    expect(outcome.cacheStatus).toBe("miss");
    expect(outcome.data.results[0]).toMatchObject({
      cityName: "Headercity",
      countryCode: "USA",
      boundingBox: {
        west: -83.287803,
        east: -82.910427,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);

    expect(parsedUrl.pathname).toBe("/geocode/autocomplete");
    expect(parsedUrl.searchParams.get("layers")).toBe("locality,localadmin");
    expect(parsedUrl.searchParams.get("boundary.country")).toBe("USA");
    expect(parsedUrl.searchParams.has("api_key")).toBe(false);
    expect(init.headers).toMatchObject({ Authorization: "test-only-key" });
    expect(init.cache).toBe("no-store");
  });

  it("coalesces identical in-flight city requests", async () => {
    let resolveFetch: (value: Response) => void = () => {
      throw new Error("The mocked provider request did not start.");
    };
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = searchCities({ query: "Coalescetown" });
    const second = searchCities({ query: "Coalescetown" });

    resolveFetch(peliasResponse([cityFeature("Coalescetown")]));
    const [firstOutcome, secondOutcome] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstOutcome.cacheStatus).toBe("miss");
    expect(secondOutcome.cacheStatus).toBe("coalesced");
  });

  it("retries a transient provider failure only once", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "temporarily busy" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchCities({ query: "Retryonceville" })).rejects.toMatchObject({
      code: "GEOCODER_UNAVAILABLE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("expires empty city searches quickly instead of retaining stale negatives", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(peliasResponse([])));
    vi.stubGlobal("fetch", fetchMock);

    const first = await searchCities({ query: "Negativecacheville" });
    const cached = await searchCities({ query: "Negativecacheville" });

    expect(first.cacheStatus).toBe("miss");
    expect(cached.cacheStatus).toBe("hit");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    const refreshed = await searchCities({ query: "Negativecacheville" });

    expect(refreshed.cacheStatus).toBe("miss");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses structured city fields, strips a failed unit, and adds focused fallback", async () => {
    const fetchMock = vi.fn().mockImplementation((urlValue: string) => {
      const url = new URL(urlValue);

      if (url.pathname === "/geocode/search/structured") {
        return Promise.resolve(
          url.searchParams.get("address")?.includes("Apt")
            ? peliasResponse([])
            : peliasResponse([queensParkFeature]),
        );
      }

      return Promise.resolve(peliasResponse([queensParkFeature]));
    });
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await searchPlaces({
      query: "100 Queen's Park, Apt 4, M5S2C6",
      city: toronto,
    });

    expect(outcome.data.results[0]).toMatchObject({
      formattedAddress: "100 Queen's Park, Toronto, Ontario, M5S 2C6, Canada",
      cityRelationship: "WITHIN_SELECTED_CITY",
      placeType: "address",
    });
    expect(outcome.data.unitRoutingNote).toContain("Apt 4");

    const urls = fetchMock.mock.calls.map(([url]) => new URL(url as string));
    const structuredUrls = urls.filter(
      (url) => url.pathname === "/geocode/search/structured",
    );
    const focusedUrl = urls.find((url) => url.pathname === "/geocode/search");

    expect(structuredUrls).toHaveLength(2);
    expect(structuredUrls[0].searchParams.get("address")).toBe(
      "100 Queen's Park, Apt 4",
    );
    expect(structuredUrls[1].searchParams.get("address")).toBe("100 Queen's Park");
    expect(structuredUrls[1].searchParams.get("locality")).toBe("Toronto");
    expect(structuredUrls[1].searchParams.get("region")).toBe("Ontario");
    expect(structuredUrls[1].searchParams.get("postalcode")).toBe("M5S 2C6");
    expect(structuredUrls[1].searchParams.get("country")).toBe("CAN");
    expect(focusedUrl?.searchParams.get("focus.point.lon")).toBe("-79.3832");
    expect(focusedUrl?.searchParams.get("boundary.country")).toBe("CAN");
    expect(focusedUrl?.searchParams.get("boundary.rect.min_lon")).toBe("-79.6393");
  });

  it("separates place caches when client-supplied city context changes", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(peliasResponse([])),
    );
    vi.stubGlobal("fetch", fetchMock);
    const firstCity = {
      ...toronto,
      providerId: "whosonfirst:locality:cache-context-test",
    };
    const secondCity = {
      ...firstCity,
      cityName: "Ottawa",
      displayName: "Ottawa, Ontario, Canada",
      latitude: 45.4215,
      longitude: -75.6972,
    };

    const first = await searchPlaces({
      query: "98765 Cache Context Street",
      city: firstCity,
    });
    const second = await searchPlaces({
      query: "98765 Cache Context Street",
      city: secondCity,
    });

    expect(first.cacheStatus).toBe("miss");
    expect(second.cacheStatus).toBe("miss");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const structuredLocalities = fetchMock.mock.calls
      .map(([url]) => new URL(url as string))
      .filter((url) => url.pathname === "/geocode/search/structured")
      .map((url) => url.searchParams.get("locality"));
    expect(structuredLocalities).toEqual(["Toronto", "Ottawa"]);
  });
});
