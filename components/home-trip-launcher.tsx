"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DeparturePicker } from "@/components/departure-picker";
import { LocationInput } from "@/components/location-input";
import { getBrowserTimeZone } from "@/lib/time-zones";
import type { LocationSuggestion } from "@/lib/types";

const TRIP_DRAFT_STORAGE_KEY = "snowroute.tripDraft.v2";
const TRIP_LAUNCH_STORAGE_KEY = "snowroute.tripLaunch.v1";

type LauncherStop = {
  id: "origin" | "destination";
  query: string;
  selected: LocationSuggestion | null;
};

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultDepartureTime() {
  const date = new Date();
  date.setHours(date.getHours() + 1);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return formatLocalDateTime(date);
}

function emptyStop(id: LauncherStop["id"]): LauncherStop {
  return { id, query: "", selected: null };
}

export function HomeTripLauncher() {
  const router = useRouter();
  const [origin, setOrigin] = useState<LauncherStop>(() => emptyStop("origin"));
  const [destination, setDestination] = useState<LauncherStop>(() =>
    emptyStop("destination"),
  );
  const [departureTimeLocal, setDepartureTimeLocal] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDepartureTimeLocal(getDefaultDepartureTime());
      setTimeZone(getBrowserTimeZone());
      setIsReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function updateStop(
    setter: React.Dispatch<React.SetStateAction<LauncherStop>>,
    value: string,
  ) {
    setter((current) => ({
      ...current,
      query: value,
      selected: current.selected?.label === value ? current.selected : null,
    }));
    setError(null);
  }

  function selectStop(
    setter: React.Dispatch<React.SetStateAction<LauncherStop>>,
    suggestion: LocationSuggestion,
  ) {
    setter((current) => ({
      ...current,
      query: suggestion.label,
      selected: suggestion,
    }));
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isReady || !origin.selected || !destination.selected) {
      setError("Select a verified suggestion for both the starting point and destination.");
      return;
    }

    const draft = {
      origin,
      destination,
      waypoints: [],
      timeZone,
      timeZoneManuallySet: false,
    };
    const launch = { ...draft, departureTimeLocal, createdAt: new Date().toISOString() };

    try {
      window.localStorage.setItem(TRIP_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      window.sessionStorage.setItem(TRIP_LAUNCH_STORAGE_KEY, JSON.stringify(launch));
    } catch {
      // The planner still works if private browsing prevents web storage.
    }

    router.push("/analyze-trip");
  }

  if (!isReady) {
    return (
      <section
        aria-label="Preparing trip form"
        className="min-h-[600px] rounded-2xl border border-white/10 bg-[#0b1c24] p-5 motion-safe:animate-pulse"
      >
        <div className="h-5 w-36 rounded bg-white/[0.08]" />
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="h-20 rounded-xl bg-white/[0.05]" />
          <div className="h-20 rounded-xl bg-white/[0.05]" />
        </div>
        <div className="mt-6 h-44 rounded-xl bg-white/[0.05]" />
        <div className="mt-6 h-12 w-56 rounded-xl bg-white/[0.08]" />
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-[#0b1c24] p-4 shadow-[0_20px_50px_rgba(0,7,10,0.28)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-4">
        <div>
          <p className="text-sm font-semibold text-white">Check a route</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Choose verified places so the route starts and ends where you expect.
          </p>
        </div>
        <span className="rounded-md border border-cyan-200/20 bg-cyan-300/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-100">
          No account needed
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <LocationInput
          label="Starting point"
          placeholder="Street address, business, landmark, or city"
          value={origin.query}
          selectedLocation={origin.selected}
          onValueChange={(value) => updateStop(setOrigin, value)}
          onSelect={(suggestion) => selectStop(setOrigin, suggestion)}
        />
        <LocationInput
          label="Destination"
          placeholder="Street address, business, landmark, or city"
          value={destination.query}
          selectedLocation={destination.selected}
          onValueChange={(value) => updateStop(setDestination, value)}
          onSelect={(suggestion) => selectStop(setDestination, suggestion)}
        />
      </div>

      <div className="mt-4">
        <DeparturePicker
          value={departureTimeLocal}
          timeZone={timeZone}
          onChange={(value) => {
            setDepartureTimeLocal(value);
            setError(null);
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/[0.08] px-3 py-2.5 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#76d5d1] px-5 text-sm font-bold text-[#07161d] shadow-[0_10px_24px_rgba(64,180,177,0.16)] transition hover:bg-[#9be4e0]"
        >
          Continue to route analysis
        </button>
        <p className="text-xs leading-5 text-slate-400">
          Forecast conditions are matched to your estimated arrival along the drive.
        </p>
      </div>
    </form>
  );
}
