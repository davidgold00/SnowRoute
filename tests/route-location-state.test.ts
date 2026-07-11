import { describe, expect, it } from "vitest";

import {
  createInitialRouteLocationState,
  createRouteEndpointSelection,
  getDestinationCity,
  getRouteEndpointSelections,
  placeBelongsToCity,
  routeEndpointsAreEffectivelyIdentical,
  routeLocationReducer,
  toEffectiveRouteEndpoint,
} from "../lib/route-location-state";
import type { CitySelection, PlaceSelection } from "../lib/types";

function city(
  cityName: string,
  regionName: string,
  latitude: number,
  longitude: number,
): CitySelection {
  return {
    providerId: `city:${cityName}`,
    displayName: `${cityName}, ${regionName}, United States`,
    cityName,
    regionName,
    regionCode: null,
    countryName: "United States",
    countryCode: "USA",
    postalCode: null,
    latitude,
    longitude,
    boundingBox: {
      west: longitude - 0.2,
      south: latitude - 0.2,
      east: longitude + 0.2,
      north: latitude + 0.2,
    },
    timezone: null,
    precision: "city",
    providerConfidence: 0.95,
  };
}

function place(
  displayName: string,
  cityName: string,
  latitude: number,
  longitude: number,
): PlaceSelection {
  return {
    providerId: `place:${displayName}`,
    displayName,
    formattedAddress: `${displayName}, ${cityName}`,
    primaryText: displayName,
    secondaryText: cityName,
    latitude,
    longitude,
    placeType: "address",
    precision: "street",
    cityName,
    regionName: cityName === "Detroit" ? "Michigan" : "Illinois",
    countryCode: "USA",
    postalCode: null,
    cityRelationship: "WITHIN_SELECTED_CITY",
    providerConfidence: 1,
    matchType: "exact",
    source: "openstreetmap",
  };
}

const detroit = city("Detroit", "Michigan", 42.3314, -83.0458);
const chicago = city("Chicago", "Illinois", 41.8781, -87.6298);
const detroitStart = place("2211 Woodward Avenue", "Detroit", 42.3385, -83.0525);
const detroitDestination = place("100 Renaissance Center", "Detroit", 42.3289, -83.0397);
const chicagoDestination = place("233 South Wacker Drive", "Chicago", 41.8789, -87.6359);

function differentCityState() {
  let state = createInitialRouteLocationState();
  state = routeLocationReducer(state, { type: "SELECT_START_CITY", city: detroit });
  state = routeLocationReducer(state, { type: "SELECT_START_PLACE", place: detroitStart });
  state = routeLocationReducer(state, {
    type: "SELECT_DESTINATION_CITY",
    city: chicago,
  });
  state = routeLocationReducer(state, {
    type: "SELECT_DESTINATION_PLACE",
    place: chicagoDestination,
  });
  return state;
}

describe("route location state", () => {
  it("defaults to different-city travel and derives place-backed endpoints", () => {
    const state = differentCityState();
    const endpoints = getRouteEndpointSelections(state);

    expect(state.sameCity).toBe(false);
    expect(endpoints?.origin).toMatchObject({
      effectiveDisplayName: "2211 Woodward Avenue, Detroit",
      usesCityFallback: false,
    });
    expect(endpoints?.destination).toMatchObject({
      effectiveDisplayName: "233 South Wacker Drive, Chicago",
      usesCityFallback: false,
    });
  });

  it("clears only the dependent starting place when the starting city changes", () => {
    const state = routeLocationReducer(differentCityState(), {
      type: "SELECT_START_CITY",
      city: city("Ann Arbor", "Michigan", 42.2808, -83.743),
    });

    expect(state.start.place).toBeNull();
    expect(state.destination.city?.cityName).toBe("Chicago");
    expect(state.destination.place?.displayName).toBe("233 South Wacker Drive");
  });

  it("clears only the dependent destination place when its city changes", () => {
    const state = routeLocationReducer(differentCityState(), {
      type: "SELECT_DESTINATION_CITY",
      city: detroit,
    });

    expect(state.start.place?.displayName).toBe("2211 Woodward Avenue");
    expect(state.destination.city?.cityName).toBe("Detroit");
    expect(state.destination.place).toBeNull();
  });

  it("clears an out-of-city destination and restores it after same-city mode is disabled", () => {
    const sameCityState = routeLocationReducer(differentCityState(), {
      type: "SET_SAME_CITY",
      value: true,
    });

    expect(sameCityState.sameCity).toBe(true);
    expect(getDestinationCity(sameCityState)?.cityName).toBe("Detroit");
    expect(sameCityState.destination.city).toBeNull();
    expect(sameCityState.destination.place).toBeNull();
    expect(sameCityState.notice).toContain("cleared");

    const restored = routeLocationReducer(sameCityState, {
      type: "SET_SAME_CITY",
      value: false,
    });

    expect(restored.destination.city?.cityName).toBe("Chicago");
    expect(restored.destination.place?.displayName).toBe("233 South Wacker Drive");
  });

  it("retains a destination place that belongs to the shared city", () => {
    let state = differentCityState();
    state = {
      ...state,
      destination: {
        ...state.destination,
        city: detroit,
        cityQuery: detroit.displayName,
        place: detroitDestination,
        placeQuery: detroitDestination.displayName,
      },
    };

    const sameCityState = routeLocationReducer(state, {
      type: "SET_SAME_CITY",
      value: true,
    });

    expect(sameCityState.destination.place?.displayName).toBe(
      "100 Renaissance Center",
    );
  });

  it("clears stale structured coordinates whenever selected text is edited", () => {
    const edited = routeLocationReducer(differentCityState(), {
      type: "EDIT_START_PLACE",
      value: "2211 Woodward Ave, Suite 100",
    });

    expect(edited.start.place).toBeNull();
    expect(edited.start.placeQuery).toContain("Suite 100");
    expect(edited.start.city?.cityName).toBe("Detroit");
  });

  it("uses the city center explicitly when an optional place is absent", () => {
    const endpoint = createRouteEndpointSelection(detroit, null);
    const effective = toEffectiveRouteEndpoint(endpoint);

    expect(endpoint).toMatchObject({
      effectiveDisplayName: "Central Detroit",
      usesCityFallback: true,
    });
    expect(effective).toMatchObject({
      displayName: "Central Detroit",
      precision: "city",
      usesCityFallback: true,
    });
  });

  it("rejects effectively identical coordinates even when labels differ", () => {
    const origin = createRouteEndpointSelection(detroit, detroitStart);
    const nearlySame = createRouteEndpointSelection(detroit, {
      ...detroitStart,
      providerId: "another-entrance",
      displayName: "Another entrance",
      latitude: detroitStart.latitude + 0.00001,
    });

    expect(routeEndpointsAreEffectivelyIdentical(origin, nearlySame)).toBe(true);
    expect(
      routeEndpointsAreEffectivelyIdentical(
        origin,
        createRouteEndpointSelection(detroit, detroitDestination),
      ),
    ).toBe(false);
  });

  it("does not retain a same-named place from a different region", () => {
    const otherDetroit = {
      ...detroitStart,
      providerId: "place:detroit-oregon",
      latitude: 44.735,
      longitude: -122.152,
      regionName: "Oregon",
      cityRelationship: "OUTSIDE_SELECTED_CITY" as const,
    };

    expect(placeBelongsToCity(otherDetroit, detroit)).toBe(false);
  });
});
