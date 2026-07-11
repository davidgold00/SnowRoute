import { describe, expect, it } from "vitest";

import {
  MAX_WAYPOINTS,
  canAddWaypoint,
  filterTimeZoneOptions,
  getBrowserTimeZone,
  getDefaultDepartureTimeLocal,
  inferTimeZoneFromLocation,
  shouldOfferOriginTimeZoneSwitch,
} from "../lib/time-zones";
import type { LocationSuggestion } from "../lib/types";

function createLocation(
  overrides: Partial<LocationSuggestion> = {},
): LocationSuggestion {
  return {
    id: "test-location",
    providerId: "test-location",
    label: "Toronto, ON, Canada",
    formattedAddress: "Toronto, ON, Canada",
    primaryLabel: "Toronto",
    lat: 43.6532,
    lon: -79.3832,
    locality: "Toronto",
    country: "Canada",
    countryCode: "CAN",
    region: "Ontario",
    postalCode: null,
    detail: "Ontario • Canada",
    placeType: "City",
    locationType: "city",
    precision: "city",
    isApproximate: true,
    providerConfidence: 0.9,
    ...overrides,
  };
}

describe("trip planning helpers", () => {
  it("caps waypoints at the product maximum", () => {
    expect(MAX_WAYPOINTS).toBe(2);
    expect(canAddWaypoint(0)).toBe(true);
    expect(canAddWaypoint(1)).toBe(true);
    expect(canAddWaypoint(2)).toBe(false);
  });

  it("uses the browser time zone when available", () => {
    expect(getBrowserTimeZone("America/Toronto")).toBe("America/Toronto");
    expect(getBrowserTimeZone("", "UTC")).toBe("UTC");
  });

  it("creates a fresh one-hour-ahead default in the selected origin time zone", () => {
    const now = new Date("2026-07-11T07:50:00.000Z");

    expect(getDefaultDepartureTimeLocal("America/New_York", now)).toBe(
      "2026-07-11T05:00",
    );
    expect(getDefaultDepartureTimeLocal("America/Los_Angeles", now)).toBe(
      "2026-07-11T02:00",
    );
  });

  it("searches time zones by city and region", () => {
    expect(filterTimeZoneOptions("vancouver").map((option) => option.value)).toContain(
      "America/Vancouver",
    );
    expect(filterTimeZoneOptions("central").map((option) => option.value)).toContain(
      "America/Chicago",
    );
  });

  it("infers an origin time zone from location metadata", () => {
    expect(inferTimeZoneFromLocation(createLocation())).toBe("America/Toronto");
    expect(
      inferTimeZoneFromLocation(
        createLocation({
          label: "Vancouver, BC, Canada",
          lon: -123.1207,
          region: "British Columbia",
          detail: "British Columbia • Canada",
        }),
      ),
    ).toBe("America/Vancouver");
  });

  it("only offers origin time zone switching when the user has not manually overridden", () => {
    expect(
      shouldOfferOriginTimeZoneSwitch({
        currentTimeZone: "America/Los_Angeles",
        originTimeZone: "America/Toronto",
        manualOverride: false,
      }),
    ).toBe(true);

    expect(
      shouldOfferOriginTimeZoneSwitch({
        currentTimeZone: "America/Los_Angeles",
        originTimeZone: "America/Toronto",
        manualOverride: true,
      }),
    ).toBe(false);
  });
});
