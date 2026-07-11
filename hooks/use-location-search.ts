"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  createPublicAppError,
  isApiFailure,
  isApiSuccess,
  type PublicAppError,
} from "@/lib/app-error";
import { trackLocationEvent } from "@/lib/location-analytics";
import { normalizeLocationQuery } from "@/lib/location";
import type {
  CitySearchResponseData,
  CitySelection,
  PlaceSearchResponseData,
} from "@/lib/types";

export type LocationSearchStatus =
  | "idle"
  | "typing"
  | "resolving"
  | "results"
  | "not-found"
  | "service-error";

type SearchMode = "city" | "place";

type CachedSearchResult = {
  expiresAt: number;
  value: CitySearchResponseData | PlaceSearchResponseData;
};

type ActiveSearchResult<T> = {
  cacheKey: string;
  data: T;
  error: PublicAppError | null;
};

const clientSearchCache = new Map<string, CachedSearchResult>();
const CLIENT_SEARCH_CACHE_MAX_ENTRIES = 150;
const CITY_POSITIVE_TTL_MS = 30 * 60 * 1000;
const PLACE_POSITIVE_TTL_MS = 10 * 60 * 1000;
const NEGATIVE_TTL_MS = 30 * 1000;

function getCachedSearch<T>(key: string) {
  const entry = clientSearchCache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    clientSearchCache.delete(key);
    return null;
  }

  return entry.value as T;
}

function setCachedSearch(
  key: string,
  value: CitySearchResponseData | PlaceSearchResponseData,
  mode: SearchMode,
) {
  if (!clientSearchCache.has(key) && clientSearchCache.size >= CLIENT_SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = clientSearchCache.keys().next().value as string | undefined;

    if (oldestKey) {
      clientSearchCache.delete(oldestKey);
    }
  }

  const resultCount =
    value.results.length +
    ("nearbyResults" in value ? value.nearbyResults.length : 0);
  const ttlMs = resultCount === 0
    ? NEGATIVE_TTL_MS
    : mode === "city"
      ? CITY_POSITIVE_TTL_MS
      : PLACE_POSITIVE_TTL_MS;

  clientSearchCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

function isCitySearchData(value: unknown): value is CitySearchResponseData {
  return Boolean(
    value &&
      typeof value === "object" &&
      "results" in value &&
      Array.isArray(value.results) &&
      value.results.every(
        (item) =>
          item &&
          typeof item === "object" &&
          "displayName" in item &&
          typeof item.displayName === "string" &&
          "cityName" in item &&
          typeof item.cityName === "string" &&
          "latitude" in item &&
          typeof item.latitude === "number" &&
          "longitude" in item &&
          typeof item.longitude === "number",
      ),
  );
}

function isPlaceSearchData(value: unknown): value is PlaceSearchResponseData {
  return Boolean(
    value &&
      typeof value === "object" &&
      "results" in value &&
      Array.isArray(value.results) &&
      "nearbyResults" in value &&
      Array.isArray(value.nearbyResults) &&
      "normalizedQuery" in value &&
      typeof value.normalizedQuery === "string" &&
      "unitRoutingNote" in value &&
      (typeof value.unitRoutingNote === "string" || value.unitRoutingNote === null),
  );
}

function cityContextKey(city: CitySelection) {
  const bounds = city.boundingBox;

  return [
    city.providerId ?? "city",
    city.cityName,
    city.regionName ?? "",
    city.countryName,
    city.countryCode,
    city.latitude,
    city.longitude,
    bounds?.west ?? "",
    bounds?.south ?? "",
    bounds?.east ?? "",
    bounds?.north ?? "",
  ]
    .join("|")
    .toLocaleLowerCase();
}

function useSearchRequest<T extends { results: unknown[] }>({
  mode,
  query,
  enabled,
  path,
  body,
  cacheContext,
  isData,
  debounceMs,
}: {
  mode: SearchMode;
  query: string;
  enabled: boolean;
  path: string;
  body: Record<string, unknown>;
  cacheContext: string;
  isData: (value: unknown) => value is T;
  debounceMs: number;
}) {
  const normalizedQuery = normalizeLocationQuery(query);
  const debouncedQuery = useDebouncedValue(normalizedQuery, debounceMs);
  const requestSequence = useRef(0);
  const [result, setResult] = useState<ActiveSearchResult<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const cacheKey = `${mode}|${debouncedQuery.toLocaleLowerCase()}|${cacheContext}`;
  const querySettled = normalizedQuery.toLocaleLowerCase() === debouncedQuery.toLocaleLowerCase();
  const active = enabled && querySettled && debouncedQuery.length >= 2;
  const cachedData = active ? getCachedSearch<T>(cacheKey) : null;

  useEffect(() => {
    if (!active || cachedData) {
      return;
    }

    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    const startedAt = performance.now();

    async function search() {
      setIsLoading(true);
      trackLocationEvent(`${mode}_search_started`, {
        mode,
        queryCharacterCount: debouncedQuery.length,
        provider: "openrouteservice-pelias",
      });

      try {
        const response = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, query: debouncedQuery }),
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);

        if (sequence !== requestSequence.current || controller.signal.aborted) {
          return;
        }

        if (!response.ok || isApiFailure(payload)) {
          const error = isApiFailure(payload)
            ? payload.error
            : createPublicAppError("GEOCODER_UNAVAILABLE");
          setResult({
            cacheKey,
            data: ({ results: [], nearbyResults: [], normalizedQuery: debouncedQuery, unitRoutingNote: null } as unknown) as T,
            error,
          });
          trackLocationEvent(`${mode}_search_failed`, {
            mode,
            queryCharacterCount: debouncedQuery.length,
            durationMs: Math.round(performance.now() - startedAt),
            provider: "openrouteservice-pelias",
            errorCode: error.code,
          });
          return;
        }

        if (!isApiSuccess<T>(payload) || !isData(payload.data)) {
          const error = createPublicAppError("GEOCODER_INVALID_RESPONSE");
          setResult({
            cacheKey,
            data: ({ results: [], nearbyResults: [], normalizedQuery: debouncedQuery, unitRoutingNote: null } as unknown) as T,
            error,
          });
          return;
        }

        setCachedSearch(
          cacheKey,
          payload.data as CitySearchResponseData | PlaceSearchResponseData,
          mode,
        );
        setResult({ cacheKey, data: payload.data, error: null });
        trackLocationEvent(
          payload.data.results.length > 0
            ? `${mode}_search_succeeded`
            : `${mode}_search_empty`,
          {
            mode,
            queryCharacterCount: debouncedQuery.length,
            resultCount: payload.data.results.length,
            durationMs: Math.round(performance.now() - startedAt),
            provider: "openrouteservice-pelias",
          },
        );
      } catch {
        if (controller.signal.aborted || sequence !== requestSequence.current) {
          return;
        }

        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        const error = createPublicAppError(
          offline ? "NETWORK_OFFLINE" : "GEOCODER_UNAVAILABLE",
        );
        setResult({
          cacheKey,
          data: ({ results: [], nearbyResults: [], normalizedQuery: debouncedQuery, unitRoutingNote: null } as unknown) as T,
          error,
        });
        trackLocationEvent(`${mode}_search_failed`, {
          mode,
          queryCharacterCount: debouncedQuery.length,
          durationMs: Math.round(performance.now() - startedAt),
          provider: "openrouteservice-pelias",
          errorCode: error.code,
        });
      } finally {
        if (!controller.signal.aborted && sequence === requestSequence.current) {
          setIsLoading(false);
        }
      }
    }

    void search();

    return () => {
      controller.abort();
      requestSequence.current += 1;
    };
  }, [
    active,
    body,
    cacheKey,
    cachedData,
    debouncedQuery,
    isData,
    mode,
    path,
    retryNonce,
  ]);

  const activeResult = result?.cacheKey === cacheKey ? result : null;
  const data = cachedData ?? activeResult?.data ?? null;
  const error = cachedData ? null : activeResult?.error ?? null;
  let status: LocationSearchStatus = "idle";

  if (enabled && normalizedQuery.length >= 2 && !querySettled) {
    status = "typing";
  } else if (active && !cachedData && (isLoading || !activeResult)) {
    status = "resolving";
  } else if (active && error) {
    status = "service-error";
  } else if (active && data && data.results.length > 0) {
    status = "results";
  } else if (active && data) {
    status = "not-found";
  }

  return {
    data,
    error: active ? error : null,
    isLoading: status === "resolving",
    status,
    retrySearch: () => {
      clientSearchCache.delete(cacheKey);
      setRetryNonce((current) => current + 1);
    },
  };
}

export function useCitySearch(
  query: string,
  enabled = true,
  countryCode?: string,
) {
  const body = useMemo(() => ({ countryCode }), [countryCode]);
  const result = useSearchRequest<CitySearchResponseData>({
    mode: "city",
    query,
    enabled,
    path: "/api/locations/cities",
    body,
    cacheContext: countryCode?.toLocaleLowerCase() ?? "global",
    isData: isCitySearchData,
    debounceMs: 250,
  });

  return {
    ...result,
    results: result.data?.results ?? [],
  };
}

export function usePlaceSearch(
  query: string,
  city: CitySelection | null,
  enabled = true,
) {
  const body = useMemo(() => ({ city, includeNearby: true }), [city]);
  const result = useSearchRequest<PlaceSearchResponseData>({
    mode: "place",
    query,
    enabled: enabled && Boolean(city),
    path: "/api/locations/places",
    body,
    cacheContext: city ? cityContextKey(city) : "no-city",
    isData: isPlaceSearchData,
    debounceMs: 300,
  });

  return {
    ...result,
    results: result.data?.results ?? [],
    nearbyResults: result.data?.nearbyResults ?? [],
    normalizedQuery: result.data?.normalizedQuery ?? "",
    unitRoutingNote: result.data?.unitRoutingNote ?? null,
  };
}
