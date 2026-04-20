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
  hasAnalysis: boolean;
  onOriginChange: (value: string) => void;
  onOriginSelect: (suggestion: LocationSuggestion) => void;
  onDestinationChange: (value: string) => void;
  onDestinationSelect: (suggestion: LocationSuggestion) => void;
  onWaypointChange: (id: string, value: string) => void;
  onWaypointSelect: (id: string, suggestion: LocationSuggestion) => void;
  onWaypointAdd: () => void;
  onWaypointRemove: (id: string) => void;
  onDepartureTimeChange: (value: string) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function RouteForm({
  origin,
  destination,
  waypoints,
  departureTimeLocal,
  timeZone,
  isSubmitting,
  hasAnalysis,
  onOriginChange,
  onOriginSelect,
  onDestinationChange,
  onDestinationSelect,
  onWaypointChange,
  onWaypointSelect,
  onWaypointAdd,
  onWaypointRemove,
  onDepartureTimeChange,
  onReset,
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

  const plannerSteps = [
    "Lock precise route points",
    "Set the departure context",
    "Analyze the route risk",
  ];

  return (
    <form onSubmit={onSubmit} className="glass-panel space-y-6 rounded-[32px] p-6 lg:p-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <p className="eyebrow">Trip builder</p>
          <div className="space-y-3">
            <h2 className="display-type text-3xl text-white sm:text-[2.15rem]">
              Route-level winter intelligence
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Build the trip once, then let SnowRoute line forecast conditions up with the
              actual time each segment is reached.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 xl:max-w-[470px] xl:flex-1">
          {plannerSteps.map((step, index) => (
            <div
              key={step}
              className="panel-muted rounded-[22px] px-4 py-3 text-sm text-slate-200"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
                Step {index + 1}
              </p>
              <p className="mt-2 leading-5">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <div className="space-y-5">
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

          <div className="panel-muted rounded-[28px] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Optional waypoints</p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                  Add stops only when they materially change the route geometry or hazard
                  timing.
                </p>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onWaypointAdd}
                className="inline-flex h-11 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 text-sm font-medium text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add waypoint
              </button>
            </div>

            {waypoints.length > 0 ? (
              <div className="mt-5 grid gap-4">
                {waypoints.map((waypoint, index) => (
                  <div
                    key={waypoint.id}
                    className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          Waypoint {index + 1}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          Optional route pivot
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onWaypointRemove(waypoint.id)}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
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
              <div className="mt-5 rounded-[24px] border border-dashed border-white/12 bg-white/[0.025] px-4 py-5 text-sm leading-6 text-slate-400">
                Keep the route lean when timing is the priority. The cleanest output comes
                from the smallest set of stops that genuinely affect the drive.
              </div>
            )}
          </div>
        </div>

        <div className="panel-muted flex flex-col justify-between rounded-[28px] p-5">
          <div className="space-y-5">
            <div>
              <p className="eyebrow">Departure context</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Departure time controls the ETA assigned to every checkpoint and therefore the
                forecast hour used for risk scoring.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="departure-time"
                className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300"
              >
                Departure time
              </label>
              <input
                id="departure-time"
                type="datetime-local"
                value={departureTimeLocal}
                onChange={(event) => onDepartureTimeChange(event.target.value)}
                disabled={isSubmitting}
                className="h-14 w-full rounded-[24px] border border-white/12 bg-[#0b1728]/85 px-4 text-base text-slate-50 outline-none transition duration-200 focus:border-cyan-300/45 focus:bg-cyan-400/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="text-xs leading-5 text-slate-400">
                Departure is interpreted in <span className="text-slate-200">{timeZone}</span>.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="metric-card rounded-[22px] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Route readiness
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {origin.selected && destination.selected ? "Pinned" : "Waiting"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Both endpoints need precise autocomplete matches before SnowRoute can analyze.
                </p>
              </div>
              <div className="metric-card rounded-[22px] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Model behavior
                </p>
                <p className="mt-3 text-xl font-semibold text-white">Checkpoint-based</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Evenly spaced route samples keep map segments, timeline points, and table rows
                  aligned.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="submit"
              disabled={!canAnalyze}
              className="flex h-14 w-full items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,#b7ecff,#72d5ff_44%,#4eaef0)] px-6 text-sm font-semibold uppercase tracking-[0.22em] text-slate-950 shadow-[0_18px_40px_rgba(84,181,239,0.24)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isSubmitting ? "Analyzing route…" : "Analyze route risk"}
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={
                isSubmitting ||
                (!hasAnalysis && !origin.query && !destination.query && waypoints.length === 0)
              }
              className="flex h-12 w-full items-center justify-center rounded-[22px] border border-white/12 bg-white/[0.03] px-5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear trip
            </button>
            <p className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-slate-400">
              SnowRoute evaluates evenly spaced checkpoints, matches forecast time by ETA, and
              surfaces the most dangerous windows first.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
