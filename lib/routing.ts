import "server-only";

import { PublicHttpError, createBoundedCache, fetchJsonWithTimeout } from "@/lib/server-security";
import type { Coordinate, LocationSuggestion } from "@/lib/types";

const ORS_BASE_URL = "https://api.openrouteservice.org";
const ROUTE_TTL_MS = 1000 * 60 * 10;
const UPSTREAM_TIMEOUT_MS = 8000;

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

const routeCache = createBoundedCache<{
  encodedPolyline: string;
  distanceKm: number;
  durationMinutes: number;
}>(80);

function getOrsApiKey() {
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ORS_API_KEY. Add it to your local environment.");
  }

  return apiKey;
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

  const params = new URLSearchParams({
    text: query.trim(),
    size: "5",
    api_key: getOrsApiKey(),
  });

  const response = await fetchJsonWithTimeout<GeocodeResponse>(
    `${ORS_BASE_URL}/geocode/search?${params}`,
    {
      timeoutMs: UPSTREAM_TIMEOUT_MS,
      publicErrorMessage: "The geocoding provider took too long to respond.",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    if (response.status === 429) {
      throw new PublicHttpError(
        503,
        "Place search is temporarily busy. Please try again shortly.",
        "GEOCODE_RATE_LIMITED",
      );
    }

    throw new PublicHttpError(
      502,
      "Place search is temporarily unavailable.",
      "GEOCODE_UPSTREAM_FAILED",
    );
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

  return suggestions;
}

export async function getRouteDirections(stops: Coordinate[]) {
  if (stops.length < 2) {
    throw new Error("A route needs at least an origin and a destination.");
  }

  const cacheKey = JSON.stringify(stops);
  const cached = routeCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await fetchJsonWithTimeout<DirectionsResponse>(
    `${ORS_BASE_URL}/v2/directions/driving-car/json`,
    {
      method: "POST",
      timeoutMs: UPSTREAM_TIMEOUT_MS,
      publicErrorMessage: "The routing provider took too long to respond.",
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
    },
  );

  if (!response.ok) {
    if (response.status === 429) {
      throw new PublicHttpError(
        503,
        "Routing is temporarily busy. Please try again shortly.",
        "ROUTING_RATE_LIMITED",
      );
    }

    throw new PublicHttpError(
      502,
      "Route analysis is temporarily unavailable.",
      "ROUTING_UPSTREAM_FAILED",
    );
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

  routeCache.set(cacheKey, normalizedRoute, ROUTE_TTL_MS);

  return normalizedRoute;
}
