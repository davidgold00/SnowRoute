"use client";

import type { FormEvent } from "react";

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

type RouteFormProps = {
  origin: EditableStop;
  destination: EditableStop;
  waypoints: EditableStop[];
  departureTimeLocal: string;
  timeZone: string;
  originTimeZoneSuggestion: string | null;
  isSubmitting: boolean;
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
  onSubmit,
}: RouteFormProps) {
  const hasIncompleteWaypoint = waypoints.some(
    (waypoint) => waypoint.query.trim().length > 0 && !waypoint.selected,
  );
  const canAnalyze =
    Boolean(origin.selected) &&
    Boolean(destination.selected) &&
    Boolean(departureTimeLocal) &&
    !hasIncompleteWaypoint &&
    !isSubmitting;
  const lockedRequiredStops = Number(Boolean(origin.selected)) + Number(Boolean(destination.selected));
  const selectedWaypoints = waypoints.filter((waypoint) => waypoint.selected).length;
  const waypointLimitReached = waypoints.length >= MAX_WAYPOINTS;
  const waypointHelperId = "waypoint-helper";

  return (
    <form
      onSubmit={onSubmit}
      className="glass-panel route-builder-panel space-y-6 rounded-2xl p-5 sm:p-6 lg:p-7"
    >
      <div className="route-builder-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Trip Builder
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Build a precise winter route
          </h2>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] text-center">
          {[
            { label: "Required stops", value: `${lockedRequiredStops}/2` },
            { label: "Waypoints", value: `${selectedWaypoints}/${MAX_WAYPOINTS}` },
            { label: "Status", value: canAnalyze ? "Ready" : "Draft" },
          ].map((item) => (
            <div key={item.label} className="border-l border-white/8 px-3 py-3 first:border-l-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="route-builder-locations grid gap-4 lg:grid-cols-2">
        <LocationInput
          label="Origin"
          placeholder="Exact origin address, place, or city"
          value={origin.query}
          selectedLocation={origin.selected}
          onValueChange={onOriginChange}
          onSelect={onOriginSelect}
          disabled={isSubmitting}
        />
        <LocationInput
          label="Destination"
          placeholder="Exact destination address, place, or city"
          value={destination.query}
          selectedLocation={destination.selected}
          onValueChange={onDestinationChange}
          onSelect={onDestinationSelect}
          disabled={isSubmitting}
        />
      </div>

      <div className="route-builder-waypoints space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
              Optional Waypoints
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Capture planned stops or route pivots without leaving the flow. Maximum{" "}
              {MAX_WAYPOINTS} waypoints supported.
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting || waypointLimitReached}
            onClick={onWaypointAdd}
            aria-describedby={waypointHelperId}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200/25 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/45 hover:bg-cyan-300/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200/55 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden="true" className="text-base leading-none">
              +
            </span>
            Add waypoint
          </button>
        </div>
        <p id={waypointHelperId} className="text-xs leading-5 text-slate-300">
          Waypoints are optional. Required stops are only origin and destination.
        </p>

        {waypoints.length > 0 ? (
          <div className="grid gap-4">
            {waypoints.map((waypoint, index) => (
              <div
                key={waypoint.id}
                className="relative rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">
                    Waypoint {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => onWaypointRemove(waypoint.id)}
                    aria-label={`Remove waypoint ${index + 1}`}
                    className="min-h-10 rounded-lg px-3 py-1 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200/45"
                  >
                    Remove
                  </button>
                </div>
                <LocationInput
                  label={`Waypoint ${index + 1}`}
                  placeholder="Optional address, place, or detour point"
                  value={waypoint.query}
                  selectedLocation={waypoint.selected}
                  onValueChange={(value) => onWaypointChange(waypoint.id, value)}
                  onSelect={(suggestion) => onWaypointSelect(waypoint.id, suggestion)}
                  disabled={isSubmitting}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.025] px-4 py-4 text-sm text-slate-400">
            Add stops only when they materially change the route or hazard timing.
          </div>
        )}
      </div>

      <div className="route-builder-actions grid gap-5 border-t border-white/10 pt-6">
        <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <DeparturePicker
            value={departureTimeLocal}
            timeZone={timeZone}
            disabled={isSubmitting}
            onChange={onDepartureTimeChange}
          />

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
              disabled={!canAnalyze}
              aria-busy={isSubmitting}
              className="flex h-14 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#b7f0ff,#5bd0f2_52%,#8be8c7)] px-5 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-[0_14px_34px_rgba(91,208,242,0.22)] transition duration-200 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
            >
              {isSubmitting ? "Analyzing route..." : "Analyze route risk"}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClearTrip}
              className="min-h-14 rounded-xl border border-white/12 bg-white/[0.035] px-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-100/25 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 disabled:cursor-not-allowed disabled:opacity-55"
            >
              Clear trip
            </button>
          </div>
          <p className="text-xs leading-5 text-slate-400">
            SnowRoute evaluates evenly spaced checkpoints, matches forecast time by ETA,
            and surfaces the most dangerous windows first.
          </p>
        </div>
      </div>
    </form>
  );
}
