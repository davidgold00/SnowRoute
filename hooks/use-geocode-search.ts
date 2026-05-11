"use client";

import { useEffect, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { LocationSuggestion } from "@/lib/types";

const searchCache = new Map<string, LocationSuggestion[]>();

export function useGeocodeSearch(query: string, enabled = true) {
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(normalizedQuery, 300);
  const [searchResult, setSearchResult] = useState<{
    cacheKey: string;
    suggestions: LocationSuggestion[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = debouncedQuery.toLowerCase();
  const isSettledQuery = normalizedQuery.toLowerCase() === cacheKey;
  const isActiveQuery = enabled && isSettledQuery && debouncedQuery.length >= 2;
  const cachedSuggestions = isActiveQuery ? searchCache.get(cacheKey) ?? null : null;

  useEffect(() => {
    if (!isActiveQuery || cachedSuggestions) {
      return;
    }

    const abortController = new AbortController();

    async function loadSuggestions() {
      setIsLoading(true);
      setError(null);

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

        if (!response.ok) {
          throw new Error("Place search is temporarily unavailable.");
        }

        const payload = (await response.json()) as LocationSuggestion[];
        searchCache.set(cacheKey, payload);
        setSearchResult({
          cacheKey,
          suggestions: payload,
        });
      } catch (fetchError) {
        if (abortController.signal.aborted) {
          return;
        }

        setSearchResult({
          cacheKey,
          suggestions: [],
        });
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Place search is temporarily unavailable.",
        );
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
  }, [cacheKey, cachedSuggestions, debouncedQuery, isActiveQuery]);

  const activeSuggestions =
    cachedSuggestions ??
    (searchResult?.cacheKey === cacheKey ? searchResult.suggestions : []);

  return {
    suggestions: isActiveQuery ? activeSuggestions : [],
    isLoading: isActiveQuery && !cachedSuggestions ? isLoading : false,
    error: isActiveQuery && !cachedSuggestions ? error : null,
  };
}
