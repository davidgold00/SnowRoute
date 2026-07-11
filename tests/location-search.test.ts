import { describe, expect, it } from "vitest";

import {
  buildQualifiedPlaceQuery,
  classifyCityRelationship,
  createRouteEndpointSelection,
  extractPostalCode,
  normalizeCitySuggestions,
  normalizeLocationQuery,
  normalizePlaceSuggestions,
  stripAddressUnit,
  toEffectiveRouteEndpoint,
  type GeocodeFeature,
} from "../lib/location";
import {
  citySearchRequestSchema,
  placeSearchRequestSchema,
  type CitySelection,
} from "../lib/types";

const detroit: CitySelection = {
  providerId: "whosonfirst:locality:85951091",
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

function feature({
  gid,
  label,
  layer,
  latitude,
  longitude,
  locality,
  region = "Michigan",
  country = "United States",
  countryCode = "USA",
  name,
  housenumber,
  street,
  confidence = 1,
  bbox,
}: {
  gid: string;
  label: string;
  layer: string;
  latitude: number;
  longitude: number;
  locality?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  confidence?: number;
  bbox?: [number, number, number, number];
}): GeocodeFeature {
  return {
    bbox,
    geometry: { coordinates: [longitude, latitude] },
    properties: {
      gid,
      label,
      layer,
      locality,
      region,
      region_a: region === "Michigan" ? "MI" : undefined,
      country,
      country_a: countryCode,
      name,
      housenumber,
      street,
      confidence,
      match_type: "exact",
      accuracy: "point",
      source: "openstreetmap",
    },
  };
}

describe("city-first location search utilities", () => {
  it("normalizes pasted punctuation safely and separates apartment text", () => {
    expect(normalizeLocationQuery("  100   Queen’s Park ,  Toronto ")).toBe(
      "100 Queen's Park, Toronto",
    );
    expect(stripAddressUnit("123 Main Street, Apt. #4B")).toEqual({
      baseQuery: "123 Main Street",
      unitText: "Apt. #4B",
    });
    expect(stripAddressUnit("123 Main Street Suite 900")).toEqual({
      baseQuery: "123 Main Street",
      unitText: "Suite 900",
    });
    expect(stripAddressUnit("123 Main Street")).toEqual({
      baseQuery: "123 Main Street",
      unitText: null,
    });
  });

  it("extracts North American postal codes without removing house numbers", () => {
    expect(extractPostalCode("100 Queen's Park M5S2C6", "CAN")).toEqual({
      postalCode: "M5S 2C6",
      queryWithoutPostalCode: "100 Queen's Park",
    });
    expect(extractPostalCode("2100 Woodward Avenue, 48201", "USA")).toEqual({
      postalCode: "48201",
      queryWithoutPostalCode: "2100 Woodward Avenue",
    });
    expect(extractPostalCode("12345 Main Street", "USA")).toEqual({
      postalCode: null,
      queryWithoutPostalCode: "12345 Main Street",
    });
  });

  it("adds missing city context without duplicating context already in pasted text", () => {
    expect(buildQualifiedPlaceQuery("100 Woodward Avenue", detroit)).toBe(
      "100 Woodward Avenue, Detroit, Michigan, United States",
    );
    expect(
      buildQualifiedPlaceQuery(
        "100 Woodward Avenue, Detroit, Michigan, United States",
        detroit,
      ),
    ).toBe("100 Woodward Avenue, Detroit, Michigan, United States");
  });

  it("preserves city bounds and human context for duplicate city names", () => {
    const results = normalizeCitySuggestions(
      [
        feature({
          gid: "whosonfirst:locality:detroit-mi",
          label: "Detroit, MI, USA",
          layer: "locality",
          latitude: 42.3314,
          longitude: -83.0458,
          locality: "Detroit",
          name: "Detroit",
          bbox: [-83.287803, 42.25496, -82.910427, 42.45023],
        }),
        feature({
          gid: "whosonfirst:locality:detroit-tn",
          label: "Detroit, TN, USA",
          layer: "locality",
          latitude: 35.5889,
          longitude: -89.8137,
          locality: "Detroit",
          name: "Detroit",
          region: "Tennessee",
        }),
      ],
      "Detroit",
    );

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.displayName)).toEqual([
      "Detroit, MI, USA",
      "Detroit, TN, USA",
    ]);
    expect(results[0].boundingBox).toEqual(detroit.boundingBox);
    expect(results[0]).toMatchObject({
      cityName: "Detroit",
      regionName: "Michigan",
      regionCode: "MI",
      countryCode: "USA",
    });
  });

  it("classifies city membership using locality, bounds, and tolerant proximity", () => {
    expect(
      classifyCityRelationship(detroit, {
        latitude: 42.334,
        longitude: -83.047,
        cityName: "Detroit",
        regionName: "Michigan",
        countryCode: "USA",
      }),
    ).toBe("WITHIN_SELECTED_CITY");

    expect(
      classifyCityRelationship(detroit, {
        latitude: 42.2162,
        longitude: -83.3554,
        cityName: "Romulus",
        regionName: "Michigan",
        countryCode: "USA",
      }),
    ).toBe("NEAR_SELECTED_CITY");

    expect(
      classifyCityRelationship(detroit, {
        latitude: 41.8781,
        longitude: -87.6298,
        cityName: "Chicago",
        regionName: "Illinois",
        countryCode: "USA",
      }),
    ).toBe("OUTSIDE_SELECTED_CITY");

    expect(
      classifyCityRelationship(detroit, {
        latitude: 44.735,
        longitude: -122.152,
        cityName: "Detroit",
        regionName: "Oregon",
        countryCode: "USA",
      }),
    ).toBe("OUTSIDE_SELECTED_CITY");
  });

  it("keeps valid addresses while collapsing duplicate street segments", () => {
    const places = normalizePlaceSuggestions(
      [
        feature({
          gid: "osm:address:one",
          label: "100 Woodward Avenue, Detroit, MI, USA",
          layer: "address",
          latitude: 42.329,
          longitude: -83.043,
          locality: "Detroit",
          housenumber: "100",
          street: "Woodward Avenue",
        }),
        feature({
          gid: "osm:street:one",
          label: "Woodward Avenue, Detroit, MI, USA",
          layer: "street",
          latitude: 42.34,
          longitude: -83.05,
          locality: "Detroit",
          name: "Woodward Avenue",
          street: "Woodward Avenue",
        }),
        feature({
          gid: "osm:street:two",
          label: "Woodward Avenue, Detroit, MI, USA",
          layer: "street",
          latitude: 42.35,
          longitude: -83.06,
          locality: "Detroit",
          name: "Woodward Avenue",
          street: "Woodward Avenue",
        }),
      ],
      detroit,
      "100 Woodward Avenue",
    );

    expect(places).toHaveLength(2);
    expect(places[0]).toMatchObject({
      primaryText: "100 Woodward Avenue",
      placeType: "address",
      precision: "street",
      cityRelationship: "WITHIN_SELECTED_CITY",
    });
    expect(places.filter((place) => place.placeType === "street")).toHaveLength(1);
  });

  it("derives exact and city-fallback routing endpoints without provider leakage", () => {
    const [place] = normalizePlaceSuggestions(
      [
        feature({
          gid: "osm:address:one",
          label: "100 Woodward Avenue, Detroit, MI, USA",
          layer: "address",
          latitude: 42.329,
          longitude: -83.043,
          locality: "Detroit",
          housenumber: "100",
          street: "Woodward Avenue",
        }),
      ],
      detroit,
      "100 Woodward Avenue",
    );
    const exact = createRouteEndpointSelection(detroit, place);
    const fallback = createRouteEndpointSelection(detroit);

    expect(exact).toMatchObject({
      effectiveLatitude: place.latitude,
      effectiveDisplayName: "100 Woodward Avenue, Detroit, Michigan, United States",
      usesCityFallback: false,
    });
    expect(fallback).toMatchObject({
      effectiveDisplayName: "Central Detroit",
      usesCityFallback: true,
    });
    expect(toEffectiveRouteEndpoint(fallback)).toMatchObject({
      latitude: detroit.latitude,
      longitude: detroit.longitude,
      usesCityFallback: true,
    });
  });

  it("validates city and place API request contracts independently", () => {
    expect(citySearchRequestSchema.parse({ query: " Detroit ", countryCode: "us" })).toEqual({
      query: "Detroit",
      countryCode: "US",
    });
    expect(placeSearchRequestSchema.safeParse({ query: "100 Woodward", city: detroit }).success).toBe(true);
    expect(placeSearchRequestSchema.safeParse({ query: "100 Woodward" }).success).toBe(false);
  });
});
