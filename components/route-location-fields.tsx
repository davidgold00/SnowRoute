"use client";

import { CityCombobox } from "@/components/city-combobox";
import { PlaceCombobox } from "@/components/place-combobox";
import { SameCityControl } from "@/components/same-city-control";
import {
  getDestinationCity,
  type RouteLocationAction,
  type RouteLocationState,
} from "@/lib/route-location-state";
import type { CitySelection } from "@/lib/types";

export type RouteLocationFieldErrors = {
  startCity?: string;
  startPlace?: string;
  destinationCity?: string;
  destinationPlace?: string;
};

function SectionNumber({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 font-mono text-xs font-semibold text-[#176c68]">
      0{children}
    </span>
  );
}

function CityFallbackNote({
  city,
  endpoint,
}: {
  city: CitySelection | null;
  endpoint: "start" | "destination";
}) {
  if (!city) {
    return null;
  }

  return (
    <p className="mt-1 text-xs leading-5 text-[#796027]">
      No exact {endpoint === "start" ? "starting" : "destination"} place selected. The route will use an approximate point in {city.cityName}.
    </p>
  );
}

export function RouteLocationFields({
  state,
  dispatch,
  disabled = false,
  errors = {},
  compact = false,
  onStartCitySelected,
}: {
  state: RouteLocationState;
  dispatch: React.Dispatch<RouteLocationAction>;
  disabled?: boolean;
  errors?: RouteLocationFieldErrors;
  compact?: boolean;
  onStartCitySelected?: (city: CitySelection) => void;
}) {
  const destinationCity = getDestinationCity(state);

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <section className="space-y-4" aria-labelledby="starting-location-heading">
        <div className="flex items-center gap-3">
          <SectionNumber>1</SectionNumber>
          <div>
            <h3 id="starting-location-heading" className="text-sm font-semibold text-[#202927]">
              Starting location
            </h3>
            {!compact ? (
              <p className="mt-0.5 text-xs text-[#6d7a76]">Choose the city, then add precision only if useful.</p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <CityCombobox
            label="Starting city"
            query={state.start.cityQuery}
            city={state.start.city}
            endpoint="start"
            disabled={disabled}
            error={errors.startCity}
            focusOnError={Boolean(errors.startCity)}
            onQueryChange={(value) => dispatch({ type: "EDIT_START_CITY", value })}
            onClear={() => dispatch({ type: "CLEAR_START_CITY" })}
            onSelect={(city) => {
              dispatch({ type: "SELECT_START_CITY", city });
              onStartCitySelected?.(city);
            }}
          />
          <div className="space-y-2">
            <PlaceCombobox
              label="Starting address or place"
              city={state.start.city}
              query={state.start.placeQuery}
              place={state.start.place}
              endpoint="start"
              disabled={disabled}
              error={errors.startPlace}
              focusOnError={Boolean(errors.startPlace && !errors.startCity)}
              onQueryChange={(value) => dispatch({ type: "EDIT_START_PLACE", value })}
              onSelect={(place) => dispatch({ type: "SELECT_START_PLACE", place })}
              onClear={() => dispatch({ type: "CLEAR_START_PLACE" })}
              onRequestCityChange={(cityName) =>
                dispatch({ type: "EDIT_START_CITY", value: cityName })
              }
            />
            {state.start.city && !state.start.place && !state.start.placeQuery.trim() ? (
              <CityFallbackNote city={state.start.city} endpoint="start" />
            ) : null}
          </div>
        </div>
      </section>

      <section className="section-rule space-y-3 pt-5" aria-labelledby="destination-relationship-heading">
        <div className="flex items-center gap-3">
          <SectionNumber>2</SectionNumber>
          <h3 id="destination-relationship-heading" className="text-sm font-semibold text-[#202927]">
            Destination relationship
          </h3>
        </div>
        <div>
          <SameCityControl
            sameCity={state.sameCity}
            cityName={state.start.city?.cityName}
            disabled={disabled}
            onChange={(value) => dispatch({ type: "SET_SAME_CITY", value })}
          />
        </div>
      </section>

      <section className="section-rule space-y-4 pt-5" aria-labelledby="destination-location-heading">
        <div className="flex items-center gap-3">
          <SectionNumber>3</SectionNumber>
          <div>
            <h3 id="destination-location-heading" className="text-sm font-semibold text-[#202927]">
              Destination
            </h3>
            {state.sameCity && state.start.city ? (
              <p className="mt-0.5 text-xs text-[#176c68]">
                Shared city: {state.start.city.displayName}
              </p>
            ) : null}
          </div>
        </div>
        <div className={`grid gap-5 ${
          state.sameCity ? "" : "md:grid-cols-2"
        }`}>
          {!state.sameCity ? (
            <CityCombobox
              label="Destination city"
              query={state.destination.cityQuery}
              city={state.destination.city}
              endpoint="destination"
              disabled={disabled}
              error={errors.destinationCity}
              focusOnError={Boolean(
                errors.destinationCity && !errors.startCity && !errors.startPlace,
              )}
              onQueryChange={(value) =>
                dispatch({ type: "EDIT_DESTINATION_CITY", value })
              }
              onClear={() => dispatch({ type: "CLEAR_DESTINATION_CITY" })}
              onSelect={(city) => dispatch({ type: "SELECT_DESTINATION_CITY", city })}
            />
          ) : null}
          <div className="space-y-2">
            <PlaceCombobox
              label="Destination address or place"
              city={destinationCity}
              query={state.destination.placeQuery}
              place={state.destination.place}
              endpoint="destination"
              disabled={disabled}
              error={errors.destinationPlace}
              focusOnError={Boolean(
                errors.destinationPlace &&
                  !errors.startCity &&
                  !errors.startPlace &&
                  !errors.destinationCity,
              )}
              onQueryChange={(value) =>
                dispatch({ type: "EDIT_DESTINATION_PLACE", value })
              }
              onSelect={(place) =>
                dispatch({ type: "SELECT_DESTINATION_PLACE", place })
              }
              onClear={() => dispatch({ type: "CLEAR_DESTINATION_PLACE" })}
              onRequestCityChange={(cityName) => {
                if (state.sameCity) {
                  dispatch({ type: "SET_SAME_CITY", value: false });
                }
                dispatch({ type: "EDIT_DESTINATION_CITY", value: cityName });
              }}
            />
            {destinationCity &&
            !state.destination.place &&
            !state.destination.placeQuery.trim() ? (
              <CityFallbackNote city={destinationCity} endpoint="destination" />
            ) : null}
          </div>
        </div>
      </section>

      {state.notice ? (
        <div
          role="status"
          className="inline-alert flex items-start justify-between gap-4 rounded-md px-3 py-2.5 text-xs leading-5"
        >
          <p>{state.notice}</p>
          <button
            type="button"
            aria-label="Dismiss location update"
            onClick={() => dispatch({ type: "DISMISS_LOCATION_NOTICE" })}
            className="grid size-11 shrink-0 place-items-center rounded-md text-lg text-[#176c68] transition hover:bg-[#e3f0ee]"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
