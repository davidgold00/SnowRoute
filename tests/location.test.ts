import { describe, expect, it } from "vitest";

import {
  normalizeGeocodeSuggestions,
  normalizeLocationQuery,
  type GeocodeFeature,
} from "../lib/location";

function createAddressFeature(overrides: Partial<GeocodeFeature> = {}): GeocodeFeature {
  return {
    geometry: { coordinates: [-79.3832, 43.6532] },
    properties: {
      gid: "openstreetmap:address:123",
      layer: "address",
      name: "Royal Ontario Museum",
      housenumber: "100",
      street: "Queens Park",
      locality: "Toronto",
      region: "Ontario",
      postalcode: "M5S 2C6",
      country: "Canada",
      country_a: "CAN",
      confidence: 0.93,
    },
    ...overrides,
  };
}

describe("location normalization", () => {
  it("normalizes pasted whitespace without changing the search terms", () => {
    expect(normalizeLocationQuery("  100   Queens Park\n Toronto  ")).toBe(
      "100 Queens Park Toronto",
    );
  });

  it("preserves structured address context and classifies precision conservatively", () => {
    const [suggestion] = normalizeGeocodeSuggestions([createAddressFeature()]);

    expect(suggestion).toMatchObject({
      providerId: "openstreetmap:address:123",
      primaryLabel: "100 Queens Park",
      formattedAddress: "100 Queens Park, Toronto, Ontario, M5S 2C6, Canada",
      locality: "Toronto",
      region: "Ontario",
      postalCode: "M5S 2C6",
      country: "Canada",
      countryCode: "CAN",
      locationType: "address",
      precision: "street",
      isApproximate: false,
      providerConfidence: 0.93,
    });
  });

  it("marks city results as approximate instead of presenting them as exact", () => {
    const [suggestion] = normalizeGeocodeSuggestions([
      {
        geometry: { coordinates: [-73.5674, 45.5019] },
        properties: {
          gid: "whosonfirst:locality:montreal",
          layer: "locality",
          name: "Montréal",
          label: "Montréal, Quebec, Canada",
          locality: "Montréal",
          region: "Quebec",
          country: "Canada",
        },
      },
    ]);

    expect(suggestion).toMatchObject({
      locationType: "city",
      precision: "city",
      isApproximate: true,
    });
  });

  it("drops invalid coordinates and duplicate provider results", () => {
    const feature = createAddressFeature();
    const invalid = createAddressFeature({
      geometry: { coordinates: [-79, 143] },
      properties: { ...feature.properties, gid: "invalid" },
    });

    const suggestions = normalizeGeocodeSuggestions([feature, feature, invalid]);

    expect(suggestions).toHaveLength(1);
  });

  it("does not collapse distinct provider records that share a mapped point", () => {
    const first = createAddressFeature({
      properties: {
        ...createAddressFeature().properties,
        gid: "openstreetmap:address:first-unit",
        label: "100 Queens Park, Unit 1, Toronto, Ontario, Canada",
      },
    });
    const second = createAddressFeature({
      properties: {
        ...createAddressFeature().properties,
        gid: "openstreetmap:address:second-unit",
        label: "100 Queens Park, Unit 2, Toronto, Ontario, Canada",
      },
    });

    expect(normalizeGeocodeSuggestions([first, second])).toHaveLength(2);
  });
});
