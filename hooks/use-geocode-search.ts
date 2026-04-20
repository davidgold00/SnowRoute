"use client";

import { useEffect, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { LocationSuggestion } from "@/lib/types";

const searchCache = new Map<string, LocationSuggestion[]>();

export function useGeocodeSearch(query: string, enabled = true) {
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(normalizedQuery, 300);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isActiveQuery = enabled && debouncedQuery.length >= 2;
  const cacheKey = debouncedQuery.toLowerCase();
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
        setSuggestions(payload);
      } catch (fetchError) {
        if (abortController.signal.aborted) {
          return;
        }

        setSuggestions([]);
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

  return {
    suggestions: isActiveQuery ? cachedSuggestions ?? suggestions : [],
    isLoading: isActiveQuery && !cachedSuggestions ? isLoading : false,
    error: isActiveQuery && !cachedSuggestions ? error : null,
  };
}
