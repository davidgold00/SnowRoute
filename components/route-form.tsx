"use client";

import { useId, type FormEvent } from "react";

import { DeparturePicker } from "@/components/departure-picker";
import { LocationInput } from "@/components/location-input";
import {
  RouteLocationFields,
  type RouteLocationFieldErrors,
} from "@/components/route-location-fields";
import { TimeZoneSelector } from "@/components/time-zone-selector";
import {
  getDestinationCity,
  getRouteEndpointSelections,
  type RouteLocationAction,
  type RouteLocationState,
} from "@/lib/route-location-state";
import { MAX_WAYPOINTS } from "@/lib/time-zones";
import type {
  CitySelection,
  LocationSuggestion,
  PlaceSelection,
} from "@/lib/types";

export type EditableStop = {
  id: string;
  query: string;
  selected: LocationSuggestion | null;
};

export type RouteFormFieldErrors = RouteLocationFieldErrors & {
  departure?: string;
  waypoints?: string;
};

type RouteFormProps = {
  locations: RouteLocationState;
  waypoints: EditableStop[];
  departureTimeLocal: string;
  timeZone: string;
  originTimeZoneSuggestion: string | null;
  isSubmitting: boolean;
  fieldErrors?: RouteFormFieldErrors;
  onLocationAction: React.Dispatch<RouteLocationAction>;
  onStartCitySelected: (city: CitySelection) => void;
  onWaypointChange: (id: string, value: string) => void;
  onWaypointSelect: (id: string, suggestion: LocationSuggestion) => void;
  onWaypointAdd: () => void;
  onWaypointRemove: (id: string) => void;
  onDepartureTimeChange: (value: string) => void;
  onTimeZoneChange: (value: string) => void;
  onUseOriginTimeZone: () => void;
  onDismissOriginTimeZone: () => void;
  onClearTrip: () => void;
  onCancelAnalysis: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

function describeSelectedPlace(
  place: PlaceSelection,
  endpoint: "starting" | "destination",
) {
  switch (place.precision) {
    case "rooftop":
    case "entrance":
      return `Exact ${endpoint} place`;
    case "parcel":
      return `Property-level ${endpoint} place`;
    case "street":
      return `Street-level ${endpoint} place`;
    case "intersection":
      return `${endpoint === "starting" ? "Starting" : "Destination"} intersection`;
    case "postal":
      return `Postal-area ${endpoint} point`;
    default:
      return `Approximate ${endpoint} place`;
  }
}

export function RouteForm({
  locations,
  waypoints,
  departureTimeLocal,
  timeZone,
  originTimeZoneSuggestion,
  isSubmitting,
  fieldErrors = {},
  onLocationAction,
  onStartCitySelected,
  onWaypointChange,
  onWaypointSelect,
  onWaypointAdd,
  onWaypointRemove,
  onDepartureTimeChange,
  onTimeZoneChange,
  onUseOriginTimeZone,
  onDismissOriginTimeZone,
  onClearTrip,
  onCancelAnalysis,
  onSubmit,
}: RouteFormProps) {
  const destinationCity = getDestinationCity(locations);
  const endpoints = getRouteEndpointSelections(locations);
  const hasIncompleteWaypoint = waypoints.some(
    (waypoint) => waypoint.query.trim().length > 0 && !waypoint.selected,
  );
  const hasUnresolvedPlace =
    (locations.start.placeQuery.trim().length > 0 && !locations.start.place) ||
    (locations.destination.placeQuery.trim().length > 0 && !locations.destination.place);
  const isReady = Boolean(
    endpoints &&
      departureTimeLocal &&
      !hasUnresolvedPlace &&
      !hasIncompleteWaypoint,
  );
  const waypointLimitReached = waypoints.length >= MAX_WAYPOINTS;
  const departureErrorId = useId();

  return (
    <form
      onSubmit={onSubmit}
      className="feature-surface route-builder-panel space-y-6 p-5 sm:p-7 lg:p-8"
      noValidate
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d9ddd6] pb-5">
        <div>
          <p className="eyebrow">Trip details</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#202927]">
            Where and when are you driving?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#596762]">
            Start with each city. Exact addresses and places are optional.
          </p>
        </div>
        <span className="text-xs font-semibold text-[#6d7a76]">
          No account required
        </span>
      </div>

      <RouteLocationFields
        state={locations}
        dispatch={onLocationAction}
        disabled={isSubmitting}
        errors={fieldErrors}
        onStartCitySelected={onStartCitySelected}
      />

      <section className="space-y-4 border-t border-[#d9ddd6] pt-6" aria-labelledby="departure-heading">
        <div className="flex items-center gap-3">
          <span className="shrink-0 font-mono text-xs font-semibold text-[#176c68]">
            04
          </span>
          <div>
            <h3 id="departure-heading" className="text-sm font-semibold text-[#202927]">
              Departure
            </h3>
            <p className="mt-0.5 text-xs leading-5 text-[#6d7a76]">
              Defaults to today, about one hour from now.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <DeparturePicker
            value={departureTimeLocal}
            timeZone={timeZone}
            disabled={isSubmitting}
            errorId={fieldErrors.departure ? departureErrorId : undefined}
            invalid={Boolean(fieldErrors.departure)}
            onChange={onDepartureTimeChange}
          />
          {fieldErrors.departure ? (
            <p id={departureErrorId} role="alert" className="text-xs leading-5 text-[#b33a32]">
              {fieldErrors.departure}
            </p>
          ) : null}
        </div>
      </section>

      <details className="group rounded-lg border border-[#d9ddd6] bg-[#fafaf7]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-[#202927]">
          <span>
            Trip options
            <span className="ml-2 text-xs font-normal text-[#6d7a76]">
              Stops and time zone
            </span>
          </span>
          <span aria-hidden="true" className="text-lg text-[#176c68] transition group-open:rotate-45">+</span>
        </summary>
        <div className="space-y-6 border-t border-[#d9ddd6] p-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#202927]">Stops on the way</p>
                <p className="mt-1 text-xs leading-5 text-[#6d7a76]">
                  Add only a stop that changes the route or timing.
                </p>
              </div>
              <button
                type="button"
                disabled={isSubmitting || waypointLimitReached}
                onClick={onWaypointAdd}
                className="button-secondary min-h-11 shrink-0 gap-1.5 px-3 text-xs text-[#176c68] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span aria-hidden="true" className="text-base leading-none">+</span>
                Add stop
              </button>
            </div>

            {waypoints.length > 0 ? (
              <div className="grid gap-3">
                {waypoints.map((waypoint, index) => (
                  <div key={waypoint.id} className="rounded-lg border border-[#d9ddd6] bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#202927]">Stop {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => onWaypointRemove(waypoint.id)}
                        className="min-h-11 rounded-md px-3 text-xs font-semibold text-[#596762] transition hover:bg-[#eceee9] hover:text-[#202927]"
                      >
                        Remove
                      </button>
                    </div>
                    <LocationInput
                      label={`Stop ${index + 1}`}
                      placeholder="Full address, place, or city"
                      value={waypoint.query}
                      selectedLocation={waypoint.selected}
                      onValueChange={(value) => onWaypointChange(waypoint.id, value)}
                      onSelect={(suggestion) => onWaypointSelect(waypoint.id, suggestion)}
                      disabled={isSubmitting}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {fieldErrors.waypoints ? (
              <p role="alert" className="text-xs leading-5 text-[#b33a32]">
                {fieldErrors.waypoints}
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-[#d9ddd6] bg-white p-4">
            <TimeZoneSelector
              value={timeZone}
              disabled={isSubmitting}
              originTimeZoneSuggestion={originTimeZoneSuggestion}
              onChange={onTimeZoneChange}
              onUseOriginTimeZone={onUseOriginTimeZone}
              onDismissOriginTimeZone={onDismissOriginTimeZone}
            />
          </section>
        </div>
      </details>

      <div className="space-y-3 border-t border-[#d9ddd6] pt-6">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="button-primary h-13 w-full px-5"
          >
            {isSubmitting ? "Checking driving hazards…" : "Analyze route"}
          </button>
          <button
            type="button"
            onClick={isSubmitting ? onCancelAnalysis : onClearTrip}
            className={`min-h-13 rounded-md border px-4 text-sm font-semibold transition ${
              isSubmitting
                ? "border-[#d7bd7c] bg-[#fbf7ed] text-[#796027] hover:bg-[#f4ead0]"
                : "border-[#aeb8b1] bg-white text-[#384641] hover:bg-[#eceee9]"
            }`}
          >
            {isSubmitting ? "Cancel" : "Clear trip"}
          </button>
        </div>
        {!isSubmitting && !isReady ? (
          <p className="text-xs leading-5 text-[#6d7a76]">
            Confirm both cities. Optional place text must be selected from suggestions or cleared.
          </p>
        ) : null}
        {isSubmitting ? (
          <div role="status" className="rounded-md border-l-3 border-[#176c68] bg-[#e3f0ee] px-4 py-3">
            <p className="text-sm font-semibold text-[#155d59]">
              Building the route, checking driving hazards, and preparing the recommendation.
            </p>
            <p className="mt-1 text-xs leading-5 text-[#50605b]">
              This can take a few moments. Your trip details will remain available if you cancel.
            </p>
          </div>
        ) : null}
        {locations.start.city && destinationCity ? (
          <p className="text-xs leading-5 text-[#6d7a76]">
            {locations.start.place
              ? describeSelectedPlace(locations.start.place, "starting")
              : `Approximate point in ${locations.start.city.cityName}`}
            {" → "}
            {locations.destination.place
              ? describeSelectedPlace(locations.destination.place, "destination")
              : `Approximate point in ${destinationCity.cityName}`}
          </p>
        ) : null}
      </div>
    </form>
  );
}
