"use client";

import type { FormEvent } from "react";

import { LocationInput } from "@/components/location-input";
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
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function RouteForm({
  origin,
  destination,
  waypoints,
  departureTimeLocal,
  timeZone,
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

  return (
    <form onSubmit={onSubmit} className="glass-panel space-y-6 rounded-[28px] p-6 lg:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Trip Builder
          </p>
          <h2 className="display-type text-3xl text-white">Route-level winter intelligence</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-slate-300">
          SnowRoute samples weather along the full drive, lines it up with ETA, and
          explains why specific segments become risky.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LocationInput
          label="Origin"
          placeholder="Start city, address, or landmark"
          value={origin.query}
          selectedLocation={origin.selected}
          onValueChange={onOriginChange}
          onSelect={onOriginSelect}
          disabled={isSubmitting}
        />
        <LocationInput
          label="Destination"
          placeholder="End city, address, or landmark"
          value={destination.query}
          selectedLocation={destination.selected}
          onValueChange={onDestinationChange}
          onSelect={onDestinationSelect}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
              Optional Waypoints
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Capture planned stops or route pivots without leaving the flow.
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onWaypointAdd}
            className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add waypoint
          </button>
        </div>

        {waypoints.length > 0 ? (
          <div className="grid gap-4">
            {waypoints.map((waypoint, index) => (
              <div
                key={waypoint.id}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">
                    Waypoint {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => onWaypointRemove(waypoint.id)}
                    className="text-sm text-slate-400 transition hover:text-white"
                  >
                    Remove
                  </button>
                </div>
                <LocationInput
                  label={`Waypoint ${index + 1}`}
                  placeholder="Optional stop or detour point"
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
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-5 text-sm text-slate-400">
            Add stops only when they materially change the route or hazard timing.
          </div>
        )}
      </div>

      <div className="grid gap-4 border-t border-white/10 pt-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2">
          <label
            htmlFor="departure-time"
            className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300"
          >
            Departure Time
          </label>
          <input
            id="departure-time"
            type="datetime-local"
            value={departureTimeLocal}
            onChange={(event) => onDepartureTimeChange(event.target.value)}
            disabled={isSubmitting}
            className="h-14 w-full rounded-2xl border border-white/12 bg-white/[0.03] px-4 text-base text-slate-50 outline-none transition duration-200 focus:border-cyan-300/45 focus:bg-cyan-400/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="text-xs text-slate-400">
            Departure is interpreted in <span className="text-slate-200">{timeZone}</span>.
          </p>
        </div>

        <div className="space-y-3 lg:min-w-[220px]">
          <button
            type="submit"
            disabled={!canAnalyze}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#94d6ff,#4bb5f5)] px-6 text-sm font-semibold uppercase tracking-[0.2em] text-slate-950 transition duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSubmitting ? "Analyzing route…" : "Analyze route risk"}
          </button>
          <p className="text-xs leading-5 text-slate-400">
            SnowRoute evaluates evenly spaced checkpoints, matches forecast time by ETA,
            and surfaces the most dangerous windows first.
          </p>
        </div>
      </div>
    </form>
  );
}
