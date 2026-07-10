"use client";

import { useId, type FormEvent } from "react";

import { DeparturePicker } from "@/components/departure-picker";
import { LocationInput } from "@/components/location-input";
import { TimeZoneSelector } from "@/components/time-zone-selector";
import { MAX_WAYPOINTS } from "@/lib/time-zones";
import type { LocationSuggestion } from "@/lib/types";

export type EditableStop = {
  id: string;
  query: string;
  selected: LocationSuggestion | null;
};

export type RouteFormFieldErrors = {
  origin?: string;
  destination?: string;
  departure?: string;
};

type RouteFormProps = {
  origin: EditableStop;
  destination: EditableStop;
  waypoints: EditableStop[];
  departureTimeLocal: string;
  timeZone: string;
  originTimeZoneSuggestion: string | null;
  isSubmitting: boolean;
  fieldErrors?: RouteFormFieldErrors;
  onOriginChange: (value: string) => void;
  onOriginSelect: (suggestion: LocationSuggestion) => void;
  onDestinationChange: (value: string) => void;
  onDestinationSelect: (suggestion: LocationSuggestion) => void;
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

export function RouteForm({
  origin,
  destination,
  waypoints,
  departureTimeLocal,
  timeZone,
  originTimeZoneSuggestion,
  isSubmitting,
  fieldErrors = {},
  onOriginChange,
  onOriginSelect,
  onDestinationChange,
  onDestinationSelect,
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
  const hasIncompleteWaypoint = waypoints.some(
    (waypoint) => waypoint.query.trim().length > 0 && !waypoint.selected,
  );
  const isReady =
    Boolean(origin.selected) &&
    Boolean(destination.selected) &&
    Boolean(departureTimeLocal) &&
    !hasIncompleteWaypoint &&
    !isSubmitting;
  const waypointLimitReached = waypoints.length >= MAX_WAYPOINTS;
  const departureErrorId = useId();

  return (
    <form
      onSubmit={onSubmit}
      className="glass-panel route-builder-panel space-y-6 rounded-2xl p-5 sm:p-6 lg:p-7"
    >
      <div className="route-builder-header flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Step 1 · Route hazard check
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Check the drive before you leave
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            SnowRoute estimates the conditions you&apos;ll meet at each part of the route, then
            recommends whether to go, delay, hold, or avoid the selected timing.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
            isReady
              ? "border-emerald-200/25 bg-emerald-300/10 text-emerald-50"
              : "border-white/12 bg-white/[0.035] text-slate-300"
          }`}
        >
          {isReady ? "Ready" : "Needs review"}
        </span>
      </div>

      <section className="route-builder-locations grid gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 lg:grid-cols-2">
        <LocationInput
          label="Origin"
          placeholder="Exact origin address, place, or city"
          value={origin.query}
          selectedLocation={origin.selected}
          onValueChange={onOriginChange}
          onSelect={onOriginSelect}
          disabled={isSubmitting}
          fieldError={fieldErrors.origin}
          focusOnError={Boolean(fieldErrors.origin)}
        />
        <LocationInput
          label="Destination"
          placeholder="Exact destination address, place, or city"
          value={destination.query}
          selectedLocation={destination.selected}
          onValueChange={onDestinationChange}
          onSelect={onDestinationSelect}
          disabled={isSubmitting}
          fieldError={fieldErrors.destination}
          focusOnError={Boolean(fieldErrors.destination && !fieldErrors.origin)}
        />
      </section>

      <section className="route-builder-waypoints space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">Stops on the way</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Optional — add only a stop that changes the route or timing.
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting || waypointLimitReached}
            onClick={onWaypointAdd}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-cyan-200/25 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-50 transition hover:border-cyan-100/45 hover:bg-cyan-300/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200/55 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden="true" className="text-base leading-none">
              +
            </span>
            Add stop
          </button>
        </div>

        {waypoints.length > 0 ? (
          <div className="grid gap-3">
            {waypoints.map((waypoint, index) => (
              <div
                key={waypoint.id}
                className="relative rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">Stop {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => onWaypointRemove(waypoint.id)}
                    aria-label={`Remove stop ${index + 1}`}
                    className="min-h-8 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200/45"
                  >
                    Remove
                  </button>
                </div>
                <LocationInput
                  label={`Stop ${index + 1}`}
                  placeholder="Address, place, or route stop"
                  value={waypoint.query}
                  selectedLocation={waypoint.selected}
                  onValueChange={(nextValue) => onWaypointChange(waypoint.id, nextValue)}
                  onSelect={(suggestion) => onWaypointSelect(waypoint.id, suggestion)}
                  disabled={isSubmitting}
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="route-builder-actions grid gap-4 border-t border-white/10 pt-6">
        <div>
          <p className="text-sm font-semibold text-slate-100">When are you leaving?</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            The default is today, one hour from now. Forecast availability is limited to the next 15 days.
          </p>
        </div>
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
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
              <p id={departureErrorId} role="alert" className="text-xs leading-5 text-rose-200">
                {fieldErrors.departure}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <TimeZoneSelector
              value={timeZone}
              disabled={isSubmitting}
              originTimeZoneSuggestion={originTimeZoneSuggestion}
              onChange={onTimeZoneChange}
              onUseOriginTimeZone={onUseOriginTimeZone}
              onDismissOriginTimeZone={onDismissOriginTimeZone}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="flex h-14 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#b7f0ff,#5bd0f2_52%,#8be8c7)] px-5 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-[0_14px_34px_rgba(91,208,242,0.22)] transition duration-200 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
            >
              {isSubmitting ? "Analyzing route..." : "Analyze route risk"}
            </button>
            <button
              type="button"
              onClick={isSubmitting ? onCancelAnalysis : onClearTrip}
              className={`min-h-14 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 ${
                isSubmitting
                  ? "border-amber-200/25 bg-amber-200/[0.06] text-amber-50 hover:bg-amber-200/[0.1]"
                  : "border-white/12 bg-white/[0.035] text-slate-100 hover:border-cyan-100/25 hover:bg-white/[0.07]"
              }`}
            >
              {isSubmitting ? "Cancel analysis" : "Clear trip"}
            </button>
          </div>
          {isSubmitting ? (
            <div role="status" className="rounded-xl border border-cyan-100/15 bg-cyan-300/[0.05] px-4 py-3">
              <p className="text-sm font-semibold text-cyan-50">
                Building the route and matching forecast conditions
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                SnowRoute is checking route checkpoints, driving hazards, and alternate
                departure windows. No completion percentage is estimated.
              </p>
            </div>
          ) : null}
          <p className="text-xs leading-5 text-slate-400">
            SnowRoute matches forecast conditions to each route checkpoint&apos;s estimated arrival
            time, then explains the road-weather hazards behind its recommendation.
          </p>
        </div>
      </section>
    </form>
  );
}
