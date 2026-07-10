"use client";

import { useEffect, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  createPublicAppError,
  isApiFailure,
  isApiSuccess,
  type PublicAppError,
} from "@/lib/app-error";
import { normalizeLocationQuery } from "@/lib/location";
import type { LocationSuggestion } from "@/lib/types";

const searchCache = new Map<string, LocationSuggestion[]>();
const SEARCH_CACHE_MAX_ENTRIES = 100;

export type GeocodeSearchStatus =
  | "idle"
  | "typing"
  | "resolving"
  | "results"
  | "not-found"
  | "service-error";

type SearchResult = {
  cacheKey: string;
  suggestions: LocationSuggestion[];
  error: PublicAppError | null;
};

function isLocationSuggestionArray(value: unknown): value is LocationSuggestion[] {
  return (
    Array.isArray(value) &&
    value.every(
      (suggestion) =>
        suggestion &&
        typeof suggestion === "object" &&
        "id" in suggestion &&
        typeof suggestion.id === "string" &&
        "label" in suggestion &&
        typeof suggestion.label === "string" &&
        "lat" in suggestion &&
        typeof suggestion.lat === "number" &&
        Number.isFinite(suggestion.lat) &&
        "lon" in suggestion &&
        typeof suggestion.lon === "number" &&
        Number.isFinite(suggestion.lon),
    )
  );
}

export function useGeocodeSearch(query: string, enabled = true) {
  const normalizedQuery = normalizeLocationQuery(query);
  const debouncedQuery = useDebouncedValue(normalizedQuery, 300);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const cacheKey = debouncedQuery.toLocaleLowerCase();
  const isSettledQuery = normalizedQuery.toLocaleLowerCase() === cacheKey;
  const isActiveQuery = enabled && isSettledQuery && debouncedQuery.length >= 2;
  const hasCachedSuggestions = isActiveQuery && searchCache.has(cacheKey);
  const cachedSuggestions = hasCachedSuggestions ? searchCache.get(cacheKey) ?? [] : null;

  useEffect(() => {
    if (!isActiveQuery || hasCachedSuggestions) {
      return;
    }

    const abortController = new AbortController();

    async function loadSuggestions() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/geocode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: debouncedQuery,
          }),
          signal: abortController.signal,
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok || isApiFailure(payload)) {
          setSearchResult({
            cacheKey,
            suggestions: [],
            error: isApiFailure(payload)
              ? payload.error
              : createPublicAppError("GEOCODER_UNAVAILABLE"),
          });
          return;
        }

        if (!isApiSuccess<LocationSuggestion[]>(payload) || !isLocationSuggestionArray(payload.data)) {
          setSearchResult({
            cacheKey,
            suggestions: [],
            error: createPublicAppError("GEOCODER_INVALID_RESPONSE"),
          });
          return;
        }

        if (!searchCache.has(cacheKey) && searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
          const oldestKey = searchCache.keys().next().value as string | undefined;
          if (oldestKey) {
            searchCache.delete(oldestKey);
          }
        }
        searchCache.set(cacheKey, payload.data);
        setSearchResult({
          cacheKey,
          suggestions: payload.data,
          error: null,
        });
      } catch {
        if (abortController.signal.aborted) {
          return;
        }

        const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;

        setSearchResult({
          cacheKey,
          suggestions: [],
          error: createPublicAppError(isOffline ? "NETWORK_OFFLINE" : "GEOCODER_UNAVAILABLE"),
        });
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadSuggestions();

    return () => {
      abortController.abort();
    };
  }, [cacheKey, debouncedQuery, hasCachedSuggestions, isActiveQuery, retryNonce]);

  const activeResult = searchResult?.cacheKey === cacheKey ? searchResult : null;
  const activeSuggestions = cachedSuggestions ?? activeResult?.suggestions ?? [];
  const activeError = cachedSuggestions ? null : activeResult?.error ?? null;
  const isResolving =
    isActiveQuery &&
    !hasCachedSuggestions &&
    (isLoading || activeResult === null);
  let status: GeocodeSearchStatus = "idle";

  if (enabled && normalizedQuery.length >= 2 && !isSettledQuery) {
    status = "typing";
  } else if (isActiveQuery && isResolving) {
    status = "resolving";
  } else if (isActiveQuery && activeError) {
    status = "service-error";
  } else if (isActiveQuery && activeSuggestions.length > 0) {
    status = "results";
  } else if (isActiveQuery) {
    status = "not-found";
  }

  return {
    suggestions: isActiveQuery ? activeSuggestions : [],
    isLoading: status === "resolving",
    error: isActiveQuery ? activeError : null,
    status,
    retrySearch: () => setRetryNonce((current) => current + 1),
  };
}
