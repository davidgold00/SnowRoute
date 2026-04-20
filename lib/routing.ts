import "server-only";

import type { Coordinate, LocationSuggestion } from "@/lib/types";

const ORS_BASE_URL = "https://api.openrouteservice.org";
const GEOCODE_TTL_MS = 1000 * 60 * 60 * 12;
const ROUTE_TTL_MS = 1000 * 60 * 10;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type GeocodeFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    gid?: string;
    label?: string;
    country?: string;
    region?: string;
    county?: string;
    locality?: string;
    name?: string;
  };
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
) {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

function getOrsApiKey() {
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ORS_API_KEY. Add it to your local environment.");
  }

  return apiKey;
}

async function parseApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function createSuggestionLabel(feature: GeocodeFeature) {
  const label = feature.properties?.label?.trim();

  if (label) {
    return label;
  }

  const parts = [
    feature.properties?.name,
    feature.properties?.locality,
    feature.properties?.region,
    feature.properties?.country,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return parts.join(", ");
}

export async function geocodeLocation(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const cached = getCachedValue(geocodeCache, normalizedQuery);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    text: query.trim(),
    size: "5",
    api_key: getOrsApiKey(),
  });

  const response = await fetch(`${ORS_BASE_URL}/geocode/search?${params}`, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 60 * 60 * 12,
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding request failed: ${await parseApiError(response)}`);
  }

  const payload = (await response.json()) as GeocodeResponse;
  const suggestions = (payload.features ?? [])
    .map((feature) => {
      const coordinates = feature.geometry?.coordinates;
      const label = createSuggestionLabel(feature);

      if (!coordinates || !label) {
        return null;
      }

      return {
        id:
          feature.properties?.gid ??
          `${label.toLowerCase().replace(/\s+/g, "-")}-${coordinates[1]}-${coordinates[0]}`,
        label,
        lat: coordinates[1],
        lon: coordinates[0],
        country: feature.properties?.country ?? null,
        region:
          feature.properties?.region ??
          feature.properties?.county ??
          feature.properties?.locality ??
          null,
      } satisfies LocationSuggestion;
    })
    .filter((suggestion): suggestion is LocationSuggestion => suggestion !== null);

  setCachedValue(geocodeCache, normalizedQuery, GEOCODE_TTL_MS, suggestions);

  return suggestions;
}

export async function getRouteDirections(stops: Coordinate[]) {
  if (stops.length < 2) {
    throw new Error("A route needs at least an origin and a destination.");
  }

  const cacheKey = JSON.stringify(stops);
  const cached = getCachedValue(routeCache, cacheKey);

  if (cached) {
    return cached;
  }

  const response = await fetch(`${ORS_BASE_URL}/v2/directions/driving-car/json`, {
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
  });

  if (!response.ok) {
    throw new Error(`Routing request failed: ${await parseApiError(response)}`);
  }

  const payload = (await response.json()) as DirectionsResponse;
  const route = payload.routes?.[0];
  const encodedPolyline = route?.geometry;
  const distanceMeters = route?.summary?.distance;
  const durationSeconds = route?.summary?.duration;

  if (!encodedPolyline || typeof distanceMeters !== "number" || typeof durationSeconds !== "number") {
    throw new Error("The routing provider returned an unexpected response.");
  }

  const normalizedRoute = {
    encodedPolyline,
    distanceKm: distanceMeters / 1000,
    durationMinutes: durationSeconds / 60,
  };

  setCachedValue(routeCache, cacheKey, ROUTE_TTL_MS, normalizedRoute);

  return normalizedRoute;
}
