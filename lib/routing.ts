import "server-only";

import {
  AppError,
  mapProviderException,
  mapProviderResponseError,
} from "@/lib/app-error";
import {
  type GeocodeFeature,
  normalizeGeocodeSuggestions,
  normalizeLocationQuery,
} from "@/lib/location";
import type { Coordinate, LocationSuggestion } from "@/lib/types";

const ORS_BASE_URL = "https://api.openrouteservice.org";
const GEOCODE_TTL_MS = 1000 * 60 * 60 * 12;
const ROUTE_TTL_MS = 1000 * 60 * 10;
const GEOCODE_TIMEOUT_MS = 8000;
const ROUTE_TIMEOUT_MS = 12000;
const GEOCODE_CACHE_MAX_ENTRIES = 500;
const ROUTE_CACHE_MAX_ENTRIES = 250;
const MAX_ROUTE_DISTANCE_KM = 3_000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type GeocodeResponse = {
  features?: GeocodeFeature[];
  error?: {
    message?: string;
  };
};

type DirectionsResponse = {
  routes?: Array<{
    summary?: {
      distance?: number;
      duration?: number;
    };
    geometry?: string;
  }>;
  error?: {
    message?: string;
  };
};

const geocodeCache = new Map<string, CacheEntry<LocationSuggestion[]>>();
const routeCache = new Map<
  string,
  CacheEntry<{
    encodedPolyline: string;
    distanceKm: number;
    durationMinutes: number;
  }>
>();

function getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  ttlMs: number,
  value: T,
  maxEntries: number,
) {
  if (!cache.has(key) && cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value as string | undefined;

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

function getOrsApiKey() {
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    throw new AppError("CONFIGURATION_ERROR", {
      technicalContext: { configurationKey: "ORS_API_KEY" },
    });
  }

  return apiKey;
}

async function parseApiError(response: Response) {
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

export async function geocodeLocation(query: string, signal?: AbortSignal) {
  const cleanedQuery = normalizeLocationQuery(query);
  const normalizedQuery = cleanedQuery.toLocaleLowerCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const cached = getCachedValue(geocodeCache, normalizedQuery);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    text: cleanedQuery,
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
    api_key: getOrsApiKey(),
  });

  let response: Response;

  try {
    const timeoutSignal = AbortSignal.timeout(GEOCODE_TIMEOUT_MS);
    response = await fetch(`${ORS_BASE_URL}/geocode/search?${params}`, {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate: 60 * 60 * 12,
      },
      signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    });
  } catch (error) {
    throw mapProviderException("geocoding", error);
  }

  if (!response.ok) {
    throw mapProviderResponseError(
      "geocoding",
      response.status,
      await parseApiError(response),
    );
  }

  let payload: GeocodeResponse;

  try {
    payload = (await response.json()) as GeocodeResponse;
  } catch (error) {
    throw new AppError("GEOCODER_INVALID_RESPONSE", {
      cause: error,
      technicalContext: { providerStatus: response.status, stage: "geocoding" },
    });
  }

  if (!Array.isArray(payload.features)) {
    throw new AppError("GEOCODER_INVALID_RESPONSE", {
      technicalContext: { providerStatus: response.status, stage: "geocoding" },
    });
  }

  const suggestions = normalizeGeocodeSuggestions(payload.features);

  setCachedValue(
    geocodeCache,
    normalizedQuery,
    GEOCODE_TTL_MS,
    suggestions,
    GEOCODE_CACHE_MAX_ENTRIES,
  );

  return suggestions;
}

export async function getRouteDirections(stops: Coordinate[], signal?: AbortSignal) {
  if (stops.length < 2) {
    throw new AppError("INVALID_REQUEST");
  }

  const cacheKey = stops
    .map((stop) => `${stop.lat.toFixed(5)},${stop.lon.toFixed(5)}`)
    .join("|");
  const cached = getCachedValue(routeCache, cacheKey);

  if (cached) {
    return cached;
  }

  let response: Response;

  try {
    const timeoutSignal = AbortSignal.timeout(ROUTE_TIMEOUT_MS);
    response = await fetch(`${ORS_BASE_URL}/v2/directions/driving-car/json`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: getOrsApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: stops.map((stop) => [stop.lon, stop.lat]),
        instructions: false,
        geometry_simplify: false,
      }),
      signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    });
  } catch (error) {
    throw mapProviderException("routing", error);
  }

  if (!response.ok) {
    throw mapProviderResponseError("routing", response.status, await parseApiError(response));
  }

  let payload: DirectionsResponse;

  try {
    payload = (await response.json()) as DirectionsResponse;
  } catch (error) {
    throw new AppError("ROUTER_INVALID_RESPONSE", {
      cause: error,
      technicalContext: { providerStatus: response.status, stage: "routing" },
    });
  }

  const route = payload.routes?.[0];
  const encodedPolyline = route?.geometry;
  const distanceMeters = route?.summary?.distance;
  const durationSeconds = route?.summary?.duration;

  if (!encodedPolyline || typeof distanceMeters !== "number" || typeof durationSeconds !== "number") {
    throw new AppError("ROUTER_INVALID_RESPONSE", {
      technicalContext: { providerStatus: response.status, stage: "routing" },
    });
  }

  const normalizedRoute = {
    encodedPolyline,
    distanceKm: distanceMeters / 1000,
    durationMinutes: durationSeconds / 60,
  };

  if (normalizedRoute.distanceKm > MAX_ROUTE_DISTANCE_KM) {
    throw new AppError("ROUTE_TOO_LONG", {
      technicalContext: { distanceKm: Math.round(normalizedRoute.distanceKm) },
    });
  }

  setCachedValue(
    routeCache,
    cacheKey,
    ROUTE_TTL_MS,
    normalizedRoute,
    ROUTE_CACHE_MAX_ENTRIES,
  );

  return normalizedRoute;
}
