import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import {
  AppError,
  mapProviderException,
  mapProviderResponseError,
} from "@/lib/app-error";
import {
  buildQualifiedPlaceQuery,
  distanceBetweenLocationsKm,
  extractPostalCode,
  isAddressLikeQuery,
  normalizeCitySuggestions,
  normalizeGeocodeSuggestions,
  normalizeLocationIdentity,
  normalizeLocationQuery,
  normalizePlaceSuggestions,
  stripAddressUnit,
  type GeocodeFeature,
} from "@/lib/location";
import type {
  CitySearchRequest,
  CitySearchResponseData,
  LocationSearchCacheStatus,
  LocationSuggestion,
  PlaceSearchRequest,
  PlaceSearchResponseData,
  PlaceSelection,
} from "@/lib/types";

const ORS_BASE_URL = "https://api.openrouteservice.org";
const PROVIDER_TIMEOUT_MS = 8_000;
const MAX_PROVIDER_ATTEMPTS = 2;
const CITY_POSITIVE_TTL_MS = 12 * 60 * 60 * 1_000;
const CITY_NEGATIVE_TTL_MS = 60 * 1_000;
const PLACE_POSITIVE_TTL_MS = 15 * 60 * 1_000;
const PLACE_NEGATIVE_TTL_MS = 30 * 1_000;
const LEGACY_POSITIVE_TTL_MS = 30 * 60 * 1_000;
const LEGACY_NEGATIVE_TTL_MS = 30 * 1_000;
const CITY_CACHE_MAX_ENTRIES = 250;
const PLACE_CACHE_MAX_ENTRIES = 500;
const LEGACY_CACHE_MAX_ENTRIES = 250;
const MAX_PLACE_RESULTS = 10;
const MAX_NEARBY_RESULTS = 5;

const peliasFeatureSchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  geometry: z
    .object({
      coordinates: z.tuple([z.number(), z.number()]).optional(),
    })
    .passthrough()
    .optional(),
  properties: z
    .object({
      id: z.string().optional(),
      gid: z.string().optional(),
      label: z.string().optional(),
      source: z.string().optional(),
      source_id: z.string().optional(),
      country: z.string().optional(),
      country_a: z.string().optional(),
      region: z.string().optional(),
      region_a: z.string().optional(),
      county: z.string().optional(),
      locality: z.string().optional(),
      localadmin: z.string().optional(),
      borough: z.string().optional(),
      neighbourhood: z.string().optional(),
      name: z.string().optional(),
      housenumber: z.union([z.string(), z.number().transform(String)]).optional(),
      street: z.string().optional(),
      postalcode: z.union([z.string(), z.number().transform(String)]).optional(),
      layer: z.string().optional(),
      confidence: z.number().optional(),
      match_type: z.string().optional(),
      accuracy: z.string().optional(),
      category: z.union([z.string(), z.array(z.string())]).optional(),
    })
    .passthrough()
    .optional(),
});

const peliasResponseSchema = z.object({
  features: z.array(peliasFeatureSchema),
});

type SearchOptions = {
  signal?: AbortSignal;
};

export type LocationSearchOutcome<T> = {
  data: T;
  cacheStatus: LocationSearchCacheStatus;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type PeliasEndpoint =
  | "/geocode/search"
  | "/geocode/autocomplete"
  | "/geocode/search/structured";

const cityCache = new Map<string, CacheEntry<CitySearchResponseData>>();
const placeCache = new Map<string, CacheEntry<PlaceSearchResponseData>>();
const legacyCache = new Map<string, CacheEntry<LocationSuggestion[]>>();
const cityInFlight = new Map<string, Promise<CitySearchResponseData>>();
const placeInFlight = new Map<string, Promise<PlaceSearchResponseData>>();
const legacyInFlight = new Map<string, Promise<LocationSuggestion[]>>();

function getOrsApiKey() {
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    throw new AppError("CONFIGURATION_ERROR", {
      technicalContext: { configurationKey: "ORS_API_KEY" },
    });
  }

  return apiKey;
}

function createPrivateCacheKey(parts: Array<string | number | boolean | null | undefined>) {
  return createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("\u001f"))
    .digest("hex");
}

function getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
  maxEntries: number,
) {
  if (!cache.has(key) && cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value as string | undefined;

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function awaitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal) {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException("The request was aborted.", "AbortError"),
    );
  }

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => {
      reject(signal.reason ?? new DOMException("The request was aborted.", "AbortError"));
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", handleAbort);
    });
  });
}

async function runCachedSearch<T>({
  cache,
  inFlight,
  key,
  load,
  getTtlMs,
  maxEntries,
  signal,
}: {
  cache: Map<string, CacheEntry<T>>;
  inFlight: Map<string, Promise<T>>;
  key: string;
  load: () => Promise<T>;
  getTtlMs: (value: T) => number;
  maxEntries: number;
  signal?: AbortSignal;
}): Promise<LocationSearchOutcome<T>> {
  const cached = getCachedValue(cache, key);

  if (cached !== null) {
    return { data: cached, cacheStatus: "hit" };
  }

  const existingRequest = inFlight.get(key);

  if (existingRequest) {
    return {
      data: await awaitWithSignal(existingRequest, signal),
      cacheStatus: "coalesced",
    };
  }

  const pendingRequest = load()
    .then((value) => {
      setCachedValue(cache, key, value, getTtlMs(value), maxEntries);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, pendingRequest);

  return {
    data: await awaitWithSignal(pendingRequest, signal),
    cacheStatus: "miss",
  };
}

async function parseProviderError(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string } | string;
      message?: string;
    };

    if (typeof payload.error === "string") {
      return payload.error;
    }

    return payload.error?.message ?? payload.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function isTransientProviderStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function getRetryDelayMs(response?: Response) {
  const retryAfter = Number(response?.headers.get("retry-after"));

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(1_000, retryAfter * 1_000);
  }

  return 100 + Math.floor(Math.random() * 100);
}

async function waitBeforeRetry(response?: Response) {
  await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(response)));
}

async function requestPelias(
  endpoint: PeliasEndpoint,
  params: URLSearchParams,
): Promise<GeocodeFeature[]> {
  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(`${ORS_BASE_URL}${endpoint}?${params}`, {
        headers: {
          Accept: "application/json",
          Authorization: getOrsApiKey(),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt < MAX_PROVIDER_ATTEMPTS) {
        await waitBeforeRetry();
        continue;
      }

      throw mapProviderException("geocoding", error);
    }

    if (!response.ok) {
      if (attempt < MAX_PROVIDER_ATTEMPTS && isTransientProviderStatus(response.status)) {
        await waitBeforeRetry(response);
        continue;
      }

      throw mapProviderResponseError(
        "geocoding",
        response.status,
        await parseProviderError(response),
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch (error) {
      throw new AppError("GEOCODER_INVALID_RESPONSE", {
        cause: error,
        technicalContext: { providerStatus: response.status, stage: "geocoding" },
      });
    }

    const parsedPayload = peliasResponseSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw new AppError("GEOCODER_INVALID_RESPONSE", {
        technicalContext: {
          providerStatus: response.status,
          stage: "geocoding",
          issueCount: parsedPayload.error.issues.length,
        },
      });
    }

    return parsedPayload.data.features as GeocodeFeature[];
  }

  throw new AppError("GEOCODER_UNAVAILABLE");
}

function addCityFocus(params: URLSearchParams, request: PlaceSearchRequest) {
  params.set("focus.point.lon", String(request.city.longitude));
  params.set("focus.point.lat", String(request.city.latitude));
  params.set("boundary.country", request.city.countryCode);
}

function addCityBounds(params: URLSearchParams, request: PlaceSearchRequest) {
  const bounds = request.city.boundingBox;

  if (!bounds || bounds.west > bounds.east) {
    return;
  }

  params.set("boundary.rect.min_lon", String(bounds.west));
  params.set("boundary.rect.min_lat", String(bounds.south));
  params.set("boundary.rect.max_lon", String(bounds.east));
  params.set("boundary.rect.max_lat", String(bounds.north));
}

function partitionPlaceResults(places: PlaceSelection[], request: PlaceSearchRequest) {
  return {
    results: places.filter(
      (place) => place.cityRelationship !== "OUTSIDE_SELECTED_CITY",
    ),
    nearbyResults: places.filter(
      (place) =>
        place.cityRelationship === "OUTSIDE_SELECTED_CITY" &&
        distanceBetweenLocationsKm(request.city, place) <= 150,
    ),
  };
}

async function loadCities(request: CitySearchRequest): Promise<CitySearchResponseData> {
  const query = normalizeLocationQuery(request.query);
  const params = new URLSearchParams({
    text: query,
    layers: "locality,localadmin",
  });

  if (request.countryCode) {
    params.set("boundary.country", request.countryCode);
  }

  const features = await requestPelias("/geocode/autocomplete", params);

  return {
    results: normalizeCitySuggestions(features, query).slice(0, 10),
  };
}

export function searchCities(
  request: CitySearchRequest,
  options: SearchOptions = {},
): Promise<LocationSearchOutcome<CitySearchResponseData>> {
  const normalizedQuery = normalizeLocationIdentity(request.query);
  const key = createPrivateCacheKey([
    "city",
    normalizedQuery,
    request.countryCode?.toUpperCase(),
  ]);

  return runCachedSearch({
    cache: cityCache,
    inFlight: cityInFlight,
    key,
    load: () => loadCities(request),
    getTtlMs: (value) =>
      value.results.length > 0 ? CITY_POSITIVE_TTL_MS : CITY_NEGATIVE_TTL_MS,
    maxEntries: CITY_CACHE_MAX_ENTRIES,
    signal: options.signal,
  });
}

async function requestStructuredPlaceFeatures({
  address,
  postalCode,
  request,
}: {
  address: string;
  postalCode: string | null;
  request: PlaceSearchRequest;
}) {
  const params = new URLSearchParams({
    address,
    locality: request.city.cityName,
    country: request.city.countryCode,
  });

  if (request.city.regionName) {
    params.set("region", request.city.regionName);
  }

  if (postalCode) {
    params.set("postalcode", postalCode);
  }

  return requestPelias("/geocode/search/structured", params);
}

async function requestFocusedPlaceFeatures({
  query,
  request,
  bounded,
  autocomplete,
}: {
  query: string;
  request: PlaceSearchRequest;
  bounded: boolean;
  autocomplete: boolean;
}) {
  const params = new URLSearchParams({
    text: query,
    layers: "address,venue,street,postalcode",
  });

  addCityFocus(params, request);
  if (bounded) {
    addCityBounds(params, request);
  }
  if (!autocomplete) {
    params.set("size", "12");
  }

  return requestPelias(
    autocomplete ? "/geocode/autocomplete" : "/geocode/search",
    params,
  );
}

async function loadPlaces(request: PlaceSearchRequest): Promise<PlaceSearchResponseData> {
  const normalizedQuery = normalizeLocationQuery(request.query);
  const originalPostal = extractPostalCode(normalizedQuery, request.city.countryCode);
  const { baseQuery, unitText } = stripAddressUnit(
    originalPostal.queryWithoutPostalCode,
  );
  const addressLike = isAddressLikeQuery(normalizedQuery);
  const features: GeocodeFeature[] = [];
  let usedUnitFallback = false;

  if (addressLike && originalPostal.queryWithoutPostalCode) {
    const structuredFeatures = await requestStructuredPlaceFeatures({
      address: originalPostal.queryWithoutPostalCode,
      postalCode: originalPostal.postalCode,
      request,
    });
    features.push(...structuredFeatures);

    const structuredPlaces = normalizePlaceSuggestions(
      structuredFeatures,
      request.city,
      normalizedQuery,
    );
    const structuredPrimaryCount = partitionPlaceResults(
      structuredPlaces,
      request,
    ).results.length;

    if (unitText && structuredPrimaryCount === 0) {
      usedUnitFallback = true;
      features.push(
        ...(await requestStructuredPlaceFeatures({
          address: baseQuery,
          postalCode: originalPostal.postalCode,
          request,
        })),
      );
    }
  } else {
    features.push(
      ...(await requestFocusedPlaceFeatures({
        query: normalizedQuery,
        request,
        bounded: true,
        autocomplete: true,
      })),
    );
  }

  let places = normalizePlaceSuggestions(features, request.city, normalizedQuery);
  let partitioned = partitionPlaceResults(places, request);

  if (partitioned.results.length < 5) {
    const searchQuery = usedUnitFallback ? baseQuery : normalizedQuery;
    features.push(
      ...(await requestFocusedPlaceFeatures({
        query: buildQualifiedPlaceQuery(searchQuery, request.city),
        request,
        bounded: partitioned.results.length > 0,
        autocomplete: false,
      })),
    );
    places = normalizePlaceSuggestions(features, request.city, normalizedQuery);
    partitioned = partitionPlaceResults(places, request);
  }

  return {
    results: partitioned.results.slice(0, MAX_PLACE_RESULTS),
    nearbyResults: request.includeNearby !== false
      ? partitioned.nearbyResults.slice(0, MAX_NEARBY_RESULTS)
      : [],
    normalizedQuery,
    unitRoutingNote:
      unitText
        ? `Routing uses the building address because ${unitText} is not a separate routable point.`
        : null,
  };
}

export function searchPlaces(
  request: PlaceSearchRequest,
  options: SearchOptions = {},
): Promise<LocationSearchOutcome<PlaceSearchResponseData>> {
  const bounds = request.city.boundingBox;
  const key = createPrivateCacheKey([
    "place",
    normalizeLocationIdentity(request.query),
    request.city.providerId,
    normalizeLocationIdentity(request.city.cityName),
    normalizeLocationIdentity(request.city.regionName ?? ""),
    normalizeLocationIdentity(request.city.countryName),
    request.city.countryCode,
    request.city.latitude,
    request.city.longitude,
    bounds?.west,
    bounds?.south,
    bounds?.east,
    bounds?.north,
    request.includeNearby !== false,
  ]);

  return runCachedSearch({
    cache: placeCache,
    inFlight: placeInFlight,
    key,
    load: () => loadPlaces(request),
    getTtlMs: (value) =>
      value.results.length > 0 || value.nearbyResults.length > 0
        ? PLACE_POSITIVE_TTL_MS
        : PLACE_NEGATIVE_TTL_MS,
    maxEntries: PLACE_CACHE_MAX_ENTRIES,
    signal: options.signal,
  });
}

async function loadLegacyLocations(query: string) {
  const normalizedQuery = normalizeLocationQuery(query);
  const params = new URLSearchParams({
    text: normalizedQuery,
    size: "10",
    layers: [
      "address",
      "venue",
      "street",
      "locality",
      "localadmin",
      "county",
      "region",
    ].join(","),
  });
  const features = await requestPelias("/geocode/search", params);

  return normalizeGeocodeSuggestions(features);
}

export function searchLegacyLocations(query: string, options: SearchOptions = {}) {
  const normalizedQuery = normalizeLocationQuery(query);

  if (normalizedQuery.length < 2) {
    return Promise.resolve({
      data: [],
      cacheStatus: "miss" as const,
    });
  }

  const key = createPrivateCacheKey(["legacy", normalizeLocationIdentity(query)]);

  return runCachedSearch({
    cache: legacyCache,
    inFlight: legacyInFlight,
    key,
    load: () => loadLegacyLocations(normalizedQuery),
    getTtlMs: (value) =>
      value.length > 0 ? LEGACY_POSITIVE_TTL_MS : LEGACY_NEGATIVE_TTL_MS,
    maxEntries: LEGACY_CACHE_MAX_ENTRIES,
    signal: options.signal,
  });
}
