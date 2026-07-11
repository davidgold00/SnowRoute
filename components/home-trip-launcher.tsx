"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useState } from "react";

import { DeparturePicker } from "@/components/departure-picker";
import {
  RouteLocationFields,
  type RouteLocationFieldErrors,
} from "@/components/route-location-fields";
import { trackLocationEvent } from "@/lib/location-analytics";
import {
  createInitialRouteLocationState,
  getDestinationCity,
  getRouteEndpointSelections,
  routeEndpointsAreEffectivelyIdentical,
  routeLocationReducer,
} from "@/lib/route-location-state";
import {
  getBrowserTimeZone,
  getDefaultDepartureTimeLocal,
  inferTimeZoneFromLocation,
} from "@/lib/time-zones";
import type { CitySelection } from "@/lib/types";

const TRIP_DRAFT_STORAGE_KEY = "snowroute.tripDraft.v3";
const TRIP_LAUNCH_STORAGE_KEY = "snowroute.tripLaunch.v2";

function inferCityTimeZone(city: CitySelection) {
  return city.timezone ?? inferTimeZoneFromLocation({
    country: city.countryName,
    detail: [city.regionName, city.countryName].filter(Boolean).join(", "),
    label: city.displayName,
    lon: city.longitude,
    region: city.regionName ?? null,
  });
}

export function HomeTripLauncher() {
  const router = useRouter();
  const [locations, dispatch] = useReducer(
    routeLocationReducer,
    undefined,
    createInitialRouteLocationState,
  );
  const [departureTimeLocal, setDepartureTimeLocal] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [isReady, setIsReady] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RouteLocationFieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const browserTimeZone = getBrowserTimeZone();
      setDepartureTimeLocal(getDefaultDepartureTimeLocal(browserTimeZone));
      setTimeZone(browserTimeZone);
      setIsReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function clearErrors() {
    setFieldErrors({});
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const destinationCity = getDestinationCity(locations);
    const nextErrors: RouteLocationFieldErrors = {
      ...(!locations.start.city
        ? { startCity: "Choose a starting city from the suggestions." }
        : {}),
      ...(locations.start.placeQuery.trim() && !locations.start.place
        ? {
            startPlace: `Choose a starting address or leave it blank${locations.start.city ? ` to use ${locations.start.city.cityName}` : ""}.`,
          }
        : {}),
      ...(!destinationCity
        ? { destinationCity: "Choose a destination city from the suggestions." }
        : {}),
      ...(locations.destination.placeQuery.trim() && !locations.destination.place
        ? {
            destinationPlace: `Choose a destination address or leave it blank${destinationCity ? ` to use ${destinationCity.cityName}` : ""}.`,
          }
        : {}),
    };
    const endpoints = getRouteEndpointSelections(locations);

    if (Object.keys(nextErrors).length > 0 || !endpoints) {
      setFieldErrors(nextErrors);
      setError("Correct the highlighted location details before continuing.");
      trackLocationEvent("route_form_validation_failed", {
        errorCode: !locations.start.city
          ? "START_CITY_UNRESOLVED"
          : !destinationCity
            ? "DESTINATION_CITY_UNRESOLVED"
            : "PLACE_UNRESOLVED",
      });
      return;
    }

    if (routeEndpointsAreEffectivelyIdentical(endpoints.origin, endpoints.destination)) {
      setError("The starting point and destination are the same. Choose two different places.");
      trackLocationEvent("route_form_validation_failed", {
        errorCode: "SAME_EFFECTIVE_LOCATION",
      });
      return;
    }

    const draft = {
      version: 3,
      locations,
      waypoints: [],
      timeZone,
      timeZoneManuallySet: false,
    };
    const launch = {
      ...draft,
      departureTimeLocal,
      createdAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(TRIP_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      window.sessionStorage.setItem(TRIP_LAUNCH_STORAGE_KEY, JSON.stringify(launch));
    } catch {
      // The planner remains usable when browser storage is blocked.
    }

    if (endpoints.origin.usesCityFallback) {
      trackLocationEvent("city_fallback_used", {
        endpoint: "start",
        countryCode: endpoints.origin.city.countryCode,
        usesCityFallback: true,
      });
    }
    if (endpoints.destination.usesCityFallback) {
      trackLocationEvent("city_fallback_used", {
        endpoint: "destination",
        countryCode: endpoints.destination.city.countryCode,
        usesCityFallback: true,
      });
    }

    router.push("/analyze-trip");
  }

  if (!isReady) {
    return (
      <section
        aria-label="Preparing trip form"
        className="min-h-[680px] rounded-2xl border border-white/10 bg-[#0b1c24] p-5 motion-safe:animate-pulse"
      >
        <div className="h-5 w-36 rounded bg-white/[0.08]" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="h-20 rounded-xl bg-white/[0.05]" />
          <div className="h-20 rounded-xl bg-white/[0.05]" />
        </div>
        <div className="mt-6 h-36 rounded-xl bg-white/[0.05]" />
        <div className="mt-6 h-32 rounded-xl bg-white/[0.05]" />
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-2xl border border-white/10 bg-[#0b1c24] p-4 shadow-[0_20px_50px_rgba(0,7,10,0.28)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-4">
        <div>
          <p className="text-sm font-semibold text-white">Plan a route</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Choose cities first. Exact addresses and places are optional.
          </p>
        </div>
        <span className="rounded-md border border-cyan-200/20 bg-cyan-300/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-100">
          No account needed
        </span>
      </div>

      <div className="mt-4">
        <RouteLocationFields
          state={locations}
          dispatch={(action) => {
            dispatch(action);
            clearErrors();
          }}
          errors={fieldErrors}
          compact
          onStartCitySelected={(city) => {
            const inferredTimeZone = inferCityTimeZone(city);
            if (inferredTimeZone) {
              setTimeZone(inferredTimeZone);
              setDepartureTimeLocal(
                getDefaultDepartureTimeLocal(inferredTimeZone),
              );
            }
            clearErrors();
          }}
        />
      </div>

      <div className="mt-5 border-t border-white/10 pt-5">
        <p className="mb-3 text-sm font-semibold text-slate-100">Departure</p>
        <DeparturePicker
          value={departureTimeLocal}
          timeZone={timeZone}
          onChange={(value) => {
            setDepartureTimeLocal(value);
            clearErrors();
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/[0.08] px-3 py-2.5 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#76d5d1] px-5 text-sm font-bold text-[#07161d] shadow-[0_10px_24px_rgba(64,180,177,0.16)] transition hover:bg-[#9be4e0]"
        >
          Continue to analysis
        </button>
        <p className="text-xs leading-5 text-slate-400">
          You can review every detail before the route is analyzed.
        </p>
      </div>
    </form>
  );
}
