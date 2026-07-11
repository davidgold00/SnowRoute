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
        className="feature-surface min-h-[620px] p-5 motion-safe:animate-pulse sm:p-7"
      >
        <div className="h-5 w-36 rounded bg-[#dfe4de]" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="h-20 rounded-lg bg-[#eceee9]" />
          <div className="h-20 rounded-lg bg-[#eceee9]" />
        </div>
        <div className="mt-6 h-36 rounded-lg bg-[#eceee9]" />
        <div className="mt-6 h-32 rounded-lg bg-[#eceee9]" />
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="feature-surface p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d9ddd6] pb-5">
        <div>
          <p className="text-lg font-semibold text-[#202927]">Plan a route</p>
          <p className="mt-1 text-sm leading-5 text-[#596762]">
            Choose cities first. Exact addresses and places are optional.
          </p>
        </div>
        <span className="text-xs font-semibold text-[#6d7a76]">
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

      <div className="mt-6 border-t border-[#d9ddd6] pt-5">
        <p className="mb-3 text-sm font-semibold text-[#202927]">Departure</p>
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
        <p role="alert" className="page-alert mt-4 rounded-md px-3 py-2.5 text-sm">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          className="button-primary min-h-12 px-5"
        >
          Continue to analysis
        </button>
        <p className="text-xs leading-5 text-[#6d7a76]">
          You can review every detail before the route is analyzed.
        </p>
      </div>
    </form>
  );
}
