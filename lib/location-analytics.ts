export type LocationAnalyticsEvent =
  | "city_search_started"
  | "city_search_succeeded"
  | "city_search_empty"
  | "city_search_failed"
  | "city_selected"
  | "place_search_started"
  | "place_search_succeeded"
  | "place_search_empty"
  | "place_search_failed"
  | "place_selected"
  | "place_outside_city_warning"
  | "city_fallback_used"
  | "same_city_enabled"
  | "same_city_disabled"
  | "route_form_validation_failed"
  | "route_analysis_started";

export type SafeLocationAnalyticsMetadata = {
  mode?: "city" | "place";
  endpoint?: "start" | "destination";
  queryCharacterCount?: number;
  countryCode?: string;
  resultCount?: number;
  durationMs?: number;
  cache?: "hit" | "miss" | "negative-hit";
  provider?: "openrouteservice-pelias";
  errorCode?: string;
  precision?: string;
  placeType?: string;
  usesCityFallback?: boolean;
};

export const LOCATION_ANALYTICS_EVENT_NAME = "snowroute:location-analytics";

/**
 * Emits a privacy-bounded browser event for an optional analytics adapter.
 * Exact query text, address labels, coordinates, and provider IDs are deliberately
 * absent from the metadata type and are never transmitted by SnowRoute itself.
 */
export function trackLocationEvent(
  event: LocationAnalyticsEvent,
  metadata: SafeLocationAnalyticsMetadata = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(LOCATION_ANALYTICS_EVENT_NAME, {
      detail: {
        event,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    }),
  );
}
