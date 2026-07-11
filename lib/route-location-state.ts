import type {
  CitySelection,
  PlaceSelection,
  RouteEndpointSelection,
} from "@/lib/types";
import { citySelectionSchema, placeSelectionSchema } from "@/lib/types";
import {
  classifyCityRelationship,
  createRouteEndpointSelection,
  toEffectiveRouteEndpoint,
} from "@/lib/location";

export { createRouteEndpointSelection, toEffectiveRouteEndpoint };

export type RouteEndpointDraft = {
  cityQuery: string;
  city: CitySelection | null;
  placeQuery: string;
  place: PlaceSelection | null;
};

export type RouteLocationState = {
  start: RouteEndpointDraft;
  destination: RouteEndpointDraft;
  sameCity: boolean;
  savedDifferentCityDestination: RouteEndpointDraft | null;
  notice: string | null;
};

export type RouteLocationAction =
  | { type: "EDIT_START_CITY"; value: string }
  | { type: "SELECT_START_CITY"; city: CitySelection }
  | { type: "CLEAR_START_CITY" }
  | { type: "EDIT_START_PLACE"; value: string }
  | { type: "SELECT_START_PLACE"; place: PlaceSelection }
  | { type: "CLEAR_START_PLACE" }
  | { type: "SET_SAME_CITY"; value: boolean }
  | { type: "EDIT_DESTINATION_CITY"; value: string }
  | { type: "SELECT_DESTINATION_CITY"; city: CitySelection }
  | { type: "CLEAR_DESTINATION_CITY" }
  | { type: "EDIT_DESTINATION_PLACE"; value: string }
  | { type: "SELECT_DESTINATION_PLACE"; place: PlaceSelection }
  | { type: "CLEAR_DESTINATION_PLACE" }
  | { type: "LOAD_ROUTE_LOCATIONS"; state: RouteLocationState }
  | { type: "DISMISS_LOCATION_NOTICE" }
  | { type: "RESET_ROUTE_LOCATIONS" };

export function createEmptyRouteEndpointDraft(): RouteEndpointDraft {
  return {
    cityQuery: "",
    city: null,
    placeQuery: "",
    place: null,
  };
}

export function createInitialRouteLocationState(): RouteLocationState {
  return {
    start: createEmptyRouteEndpointDraft(),
    destination: createEmptyRouteEndpointDraft(),
    sameCity: false,
    savedDifferentCityDestination: null,
    notice: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseStoredEndpoint(value: unknown): RouteEndpointDraft {
  if (!isRecord(value)) {
    return createEmptyRouteEndpointDraft();
  }

  const parsedCity = citySelectionSchema.safeParse(value.city);
  const city = parsedCity.success ? parsedCity.data : null;
  const parsedPlace = placeSelectionSchema.safeParse(value.place);
  const place = city && parsedPlace.success && placeBelongsToCity(parsedPlace.data, city)
    ? parsedPlace.data
    : null;

  return {
    cityQuery: city
      ? city.displayName
      : typeof value.cityQuery === "string"
        ? value.cityQuery.slice(0, 120)
        : "",
    city,
    placeQuery: place
      ? place.displayName
      : typeof value.placeQuery === "string"
        ? value.placeQuery.slice(0, 160)
        : "",
    place,
  };
}

export function normalizeStoredRouteLocationState(value: unknown): RouteLocationState | null {
  if (!isRecord(value) || typeof value.sameCity !== "boolean") {
    return null;
  }

  const start = parseStoredEndpoint(value.start);
  let destination = parseStoredEndpoint(value.destination);
  const savedDifferentCityDestination = isRecord(value.savedDifferentCityDestination)
    ? parseStoredEndpoint(value.savedDifferentCityDestination)
    : null;

  if (value.sameCity) {
    destination = {
      ...destination,
      cityQuery: "",
      city: null,
      place:
        start.city && destination.place && placeBelongsToCity(destination.place, start.city)
          ? destination.place
          : null,
    };
    if (!destination.place) {
      destination.placeQuery = "";
    }
  }

  return {
    start,
    destination,
    sameCity: value.sameCity,
    savedDifferentCityDestination,
    notice: null,
  };
}

function normalizeComparable(value: string | null | undefined) {
  return value
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "") ?? "";
}

function sameCountry(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  if (!left || !right) {
    return true;
  }

  return left.toLocaleUpperCase() === right.toLocaleUpperCase();
}

export function citiesAreEquivalent(
  left: CitySelection | null | undefined,
  right: CitySelection | null | undefined,
) {
  if (!left || !right) {
    return false;
  }

  if (left.providerId && right.providerId && left.providerId === right.providerId) {
    return true;
  }

  return (
    normalizeComparable(left.cityName) === normalizeComparable(right.cityName) &&
    normalizeComparable(left.regionName) === normalizeComparable(right.regionName) &&
    sameCountry(left.countryCode, right.countryCode)
  );
}

export function placeBelongsToCity(place: PlaceSelection, city: CitySelection) {
  const relationship = classifyCityRelationship(city, place);

  return (
    relationship === "WITHIN_SELECTED_CITY" ||
    relationship === "NEAR_SELECTED_CITY"
  );
}

function clearPlace(endpoint: RouteEndpointDraft): RouteEndpointDraft {
  return {
    ...endpoint,
    placeQuery: "",
    place: null,
  };
}

function selectedCityEndpoint(city: CitySelection): RouteEndpointDraft {
  return {
    cityQuery: city.displayName,
    city,
    placeQuery: "",
    place: null,
  };
}

export function routeLocationReducer(
  state: RouteLocationState,
  action: RouteLocationAction,
): RouteLocationState {
  switch (action.type) {
    case "EDIT_START_CITY":
      return {
        ...state,
        start: {
          cityQuery: action.value,
          city: null,
          placeQuery: "",
          place: null,
        },
        destination: state.sameCity ? clearPlace(state.destination) : state.destination,
        notice: state.sameCity && state.destination.place
          ? "City-dependent starting and destination places were cleared."
          : null,
      };
    case "SELECT_START_CITY": {
      const startChanged = !citiesAreEquivalent(state.start.city, action.city);
      const keepDestinationPlace = Boolean(
        state.sameCity &&
          state.destination.place &&
          placeBelongsToCity(state.destination.place, action.city),
      );

      return {
        ...state,
        start: startChanged
          ? selectedCityEndpoint(action.city)
          : { ...state.start, cityQuery: action.city.displayName, city: action.city },
        destination: state.sameCity && !keepDestinationPlace
          ? clearPlace(state.destination)
          : state.destination,
        notice:
          state.sameCity && state.destination.place && !keepDestinationPlace
            ? "The previous destination was cleared because it is outside the selected city."
            : null,
      };
    }
    case "CLEAR_START_CITY":
      return {
        ...state,
        start: createEmptyRouteEndpointDraft(),
        destination: state.sameCity ? clearPlace(state.destination) : state.destination,
        notice:
          state.sameCity && state.destination.place
            ? "The destination place was cleared because the shared city changed."
            : null,
      };
    case "EDIT_START_PLACE":
      return {
        ...state,
        start: { ...state.start, placeQuery: action.value, place: null },
        notice: null,
      };
    case "SELECT_START_PLACE":
      return {
        ...state,
        start: {
          ...state.start,
          placeQuery: action.place.displayName,
          place: action.place,
        },
        notice: null,
      };
    case "CLEAR_START_PLACE":
      return { ...state, start: clearPlace(state.start), notice: null };
    case "SET_SAME_CITY": {
      if (action.value === state.sameCity) {
        return state;
      }

      if (action.value) {
        const keepDestinationPlace = Boolean(
          state.start.city &&
            state.destination.place &&
            placeBelongsToCity(state.destination.place, state.start.city),
        );

        return {
          ...state,
          sameCity: true,
          savedDifferentCityDestination: state.destination.city
            ? state.destination
            : state.savedDifferentCityDestination,
          destination: {
            cityQuery: "",
            city: null,
            placeQuery: keepDestinationPlace ? state.destination.placeQuery : "",
            place: keepDestinationPlace ? state.destination.place : null,
          },
          notice:
            state.destination.place && !keepDestinationPlace
              ? "The previous destination was cleared because it is outside the selected city."
              : state.start.city
                ? `Both points will now be searched within ${state.start.city.cityName}.`
                : "Choose the shared city before searching either place.",
        };
      }

      return {
        ...state,
        sameCity: false,
        destination:
          state.savedDifferentCityDestination ?? createEmptyRouteEndpointDraft(),
        savedDifferentCityDestination: null,
        notice: "Choose a separate destination city.",
      };
    }
    case "EDIT_DESTINATION_CITY":
      if (state.sameCity) {
        return state;
      }
      return {
        ...state,
        destination: {
          cityQuery: action.value,
          city: null,
          placeQuery: "",
          place: null,
        },
        notice: null,
      };
    case "SELECT_DESTINATION_CITY":
      if (state.sameCity) {
        return state;
      }
      return {
        ...state,
        destination: citiesAreEquivalent(state.destination.city, action.city)
          ? { ...state.destination, cityQuery: action.city.displayName, city: action.city }
          : selectedCityEndpoint(action.city),
        notice: null,
      };
    case "CLEAR_DESTINATION_CITY":
      if (state.sameCity) {
        return state;
      }
      return {
        ...state,
        destination: createEmptyRouteEndpointDraft(),
        notice: null,
      };
    case "EDIT_DESTINATION_PLACE":
      return {
        ...state,
        destination: {
          ...state.destination,
          placeQuery: action.value,
          place: null,
        },
        notice: null,
      };
    case "SELECT_DESTINATION_PLACE":
      return {
        ...state,
        destination: {
          ...state.destination,
          placeQuery: action.place.displayName,
          place: action.place,
        },
        notice: null,
      };
    case "CLEAR_DESTINATION_PLACE":
      return { ...state, destination: clearPlace(state.destination), notice: null };
    case "LOAD_ROUTE_LOCATIONS":
      return action.state;
    case "DISMISS_LOCATION_NOTICE":
      return { ...state, notice: null };
    case "RESET_ROUTE_LOCATIONS":
      return createInitialRouteLocationState();
  }
}

export function getDestinationCity(state: RouteLocationState) {
  return state.sameCity ? state.start.city : state.destination.city;
}

export function getRouteEndpointSelections(state: RouteLocationState) {
  const destinationCity = getDestinationCity(state);

  if (!state.start.city || !destinationCity) {
    return null;
  }

  return {
    origin: createRouteEndpointSelection(state.start.city, state.start.place),
    destination: createRouteEndpointSelection(
      destinationCity,
      state.destination.place,
    ),
  };
}

function haversineDistanceMeters(
  left: RouteEndpointSelection,
  right: RouteEndpointSelection,
) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(
    right.effectiveLatitude - left.effectiveLatitude,
  );
  const longitudeDelta = toRadians(
    right.effectiveLongitude - left.effectiveLongitude,
  );
  const leftLatitude = toRadians(left.effectiveLatitude);
  const rightLatitude = toRadians(right.effectiveLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

export function routeEndpointsAreEffectivelyIdentical(
  origin: RouteEndpointSelection,
  destination: RouteEndpointSelection,
  toleranceMeters = 25,
) {
  return haversineDistanceMeters(origin, destination) <= toleranceMeters;
}
