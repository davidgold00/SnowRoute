"use client";

import { useEffect, useId, useRef, useState } from "react";

import { usePlaceSearch } from "@/hooks/use-location-search";
import { trackLocationEvent } from "@/lib/location-analytics";
import type { CitySelection, PlaceSelection } from "@/lib/types";

type PlaceComboboxProps = {
  label: string;
  city: CitySelection | null;
  query: string;
  place: PlaceSelection | null;
  endpoint: "start" | "destination";
  onQueryChange: (value: string) => void;
  onSelect: (place: PlaceSelection) => void;
  onClear: () => void;
  onRequestCityChange: (cityName: string) => void;
  disabled?: boolean;
  error?: string | null;
  focusOnError?: boolean;
};

function placeTypeLabel(place: PlaceSelection) {
  switch (place.placeType) {
    case "address":
      return "Address";
    case "street":
      return place.precision === "intersection" ? "Intersection" : "Street";
    case "business":
      return "Business";
    case "airport":
      return "Airport";
    case "transit":
      return "Transit";
    case "landmark":
      return "Landmark";
    case "postal":
      return "Postal area";
    case "coordinates":
      return "Coordinates";
    default:
      return "Place";
  }
}

function precisionLabel(place: PlaceSelection) {
  switch (place.precision) {
    case "rooftop":
    case "entrance":
      return "Exact address";
    case "parcel":
      return "Property-level";
    case "street":
      return "Street-level";
    case "intersection":
      return "Intersection";
    case "postal":
      return "Postal-area";
    default:
      return "Approximate";
  }
}

export function PlaceCombobox({
  label,
  city,
  query,
  place,
  endpoint,
  onQueryChange,
  onSelect,
  onClear,
  onRequestCityChange,
  disabled = false,
  error = null,
  focusOnError = false,
}: PlaceComboboxProps) {
  const inputId = useId();
  const listboxId = `${inputId}-places`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const statusId = `${inputId}-status`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const warningActionRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [outsideCandidate, setOutsideCandidate] = useState<PlaceSelection | null>(null);
  const shouldSearch = Boolean(city) && !disabled && !place && query.trim().length >= 2;
  const {
    results,
    nearbyResults,
    status,
    error: searchError,
    isLoading,
    retrySearch,
    unitRoutingNote,
  } = usePlaceSearch(query, city, shouldSearch);
  const combinedResults = [...results, ...nearbyResults];
  const activePlace = activeIndex >= 0 ? combinedResults[activeIndex] ?? null : null;
  const showListbox =
    isOpen &&
    shouldSearch &&
    (isLoading || combinedResults.length > 0 || Boolean(searchError) || status === "not-found");
  const hasVisibleOptions =
    showListbox && !isLoading && !searchError && combinedResults.length > 0;

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
        setOutsideCandidate(null);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  useEffect(() => {
    if (focusOnError && error) {
      inputRef.current?.focus();
    }
  }, [error, focusOnError]);

  useEffect(() => {
    if (activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  useEffect(() => {
    if (outsideCandidate) {
      warningActionRef.current?.focus();
    }
  }, [outsideCandidate]);

  function acceptPlace(selection: PlaceSelection) {
    onSelect(selection);
    setIsOpen(false);
    setActiveIndex(-1);
    setOutsideCandidate(null);
    trackLocationEvent("place_selected", {
      endpoint,
      countryCode: selection.countryCode ?? city?.countryCode,
      precision: selection.precision,
      placeType: selection.placeType,
      provider: "openrouteservice-pelias",
    });
  }

  function choosePlace(selection: PlaceSelection) {
    if (
      selection.cityRelationship === "OUTSIDE_SELECTED_CITY" ||
      selection.cityRelationship === "CITY_MEMBERSHIP_UNKNOWN"
    ) {
      setOutsideCandidate(selection);
      setActiveIndex(-1);
      trackLocationEvent("place_outside_city_warning", {
        endpoint,
        countryCode: selection.countryCode ?? city?.countryCode,
        precision: selection.precision,
        placeType: selection.placeType,
        provider: "openrouteservice-pelias",
      });
      return;
    }

    acceptPlace(selection);
  }

  if (place) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
            {label}
          </p>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">
            Confirmed
          </span>
        </div>
        <div className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-emerald-200/25 bg-emerald-300/[0.07] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{place.primaryText}</p>
            <p className="mt-1 truncate text-xs text-slate-300">
              {place.secondaryText ?? place.formattedAddress}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/75">
              {precisionLabel(place)} · {placeTypeLabel(place)}
            </p>
            {place.cityRelationship === "NEAR_SELECTED_CITY" ? (
              <p className="mt-1 text-xs leading-5 text-amber-100/85">
                Near the selected city; confirm this is the intended route point.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onClear();
              window.requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="min-h-11 shrink-0 rounded-lg border border-white/12 px-3 text-xs font-semibold text-cyan-50 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-55"
          >
            Change
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-xs leading-5 text-rose-200">{error}</p>
        ) : null}
      </div>
    );
  }

  const statusMessage = !city
    ? "Select a city before searching for an address or place."
    : isLoading
      ? `Searching within ${city.cityName}.`
      : searchError
        ? `${searchError.title} ${searchError.message}`
        : status === "not-found"
          ? `No matches found in ${city.cityName}.`
          : combinedResults.length > 0
            ? `${combinedResults.length} place suggestions available.`
            : `Optional. Leave blank to use an approximate point in ${city.cityName}.`;

  function renderOption(result: PlaceSelection, index: number, nearby: boolean) {
    const active = index === activeIndex;

    return (
      <li
        key={result.providerId ?? `${result.formattedAddress}-${result.latitude}-${result.longitude}-${result.placeType}`}
        ref={(element) => {
          optionRefs.current[index] = element;
        }}
        id={`${listboxId}-option-${index}`}
        role="option"
        aria-selected={active}
        onPointerDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choosePlace(result)}
        className={`min-h-16 cursor-pointer px-4 py-3 outline-none transition ${
          active ? "bg-cyan-100/[0.11]" : "hover:bg-white/[0.055]"
        }`}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">
              {result.primaryText}
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-400">
              {result.secondaryText ?? result.formattedAddress}
            </span>
          </span>
          <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
            nearby
              ? "border-amber-200/25 bg-amber-200/[0.06] text-amber-100"
              : "border-cyan-200/20 bg-cyan-200/[0.06] text-cyan-100"
          }`}>
            {placeTypeLabel(result)}
          </span>
        </span>
        <span className="mt-2 block text-[11px] text-slate-500">
          {precisionLabel(result)}
          {result.cityRelationship === "NEAR_SELECTED_CITY" ? " · Near the selected city" : ""}
        </span>
      </li>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative space-y-2"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;

        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setIsOpen(false);
          setActiveIndex(-1);
          setOutsideCandidate(null);
        }
      }}
    >
      <label
        htmlFor={inputId}
        className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300"
      >
        {label}
        <span className="ml-2 font-medium normal-case tracking-normal text-slate-500">
          Optional
        </span>
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={query}
          disabled={disabled || !city}
          maxLength={160}
          autoComplete="street-address"
          placeholder={city ? `Address, business, or landmark in ${city.cityName}` : "Select a city first"}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={hasVisibleOptions}
          aria-controls={hasVisibleOptions ? listboxId : undefined}
          aria-activedescendant={
            activePlace ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-busy={isLoading}
          aria-invalid={Boolean(error)}
          aria-describedby={`${helperId} ${statusId}${error ? ` ${errorId}` : ""}`}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
            setOutsideCandidate(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && combinedResults.length > 0) {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) =>
                current < 0 ? 0 : Math.min(current + 1, combinedResults.length - 1),
              );
            } else if (event.key === "ArrowUp" && combinedResults.length > 0) {
              event.preventDefault();
              setActiveIndex((current) =>
                current <= 0 ? combinedResults.length - 1 : current - 1,
              );
            } else if (event.key === "Enter" && activePlace) {
              event.preventDefault();
              choosePlace(activePlace);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
              setOutsideCandidate(null);
              setActiveIndex(-1);
            }
          }}
          className={`h-14 w-full rounded-xl border bg-white/[0.045] px-4 pr-12 text-base text-slate-50 outline-none transition placeholder:text-slate-400 focus:bg-cyan-200/[0.06] disabled:cursor-not-allowed disabled:opacity-55 ${
            error
              ? "border-rose-300/55 focus:border-rose-200"
              : "border-white/12 focus:border-cyan-200/55"
          }`}
        />
        {query && city ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLocaleLowerCase()}`}
            onClick={() => {
              onClear();
              setIsOpen(false);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-1.5 my-auto grid size-11 place-items-center rounded-lg text-lg text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
      <p id={helperId} className="text-xs leading-5 text-slate-400">
        {!city
          ? "Select a city first."
          : query.trim()
            ? `Choose a confirmed match in ${city.cityName}.`
            : `Leave blank to use an approximate point in ${city.cityName}.`}
      </p>
      <p id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-5 text-rose-200">
          {error}
        </p>
      ) : null}

      {showListbox ? (
        <div
          className="absolute inset-x-0 top-[calc(100%+0.45rem)] z-[120] max-h-[min(28rem,calc(100dvh-9rem))] overflow-y-auto overscroll-contain rounded-xl border border-cyan-100/18 bg-[#0d1722]/[0.99] shadow-[0_24px_70px_rgba(1,8,16,0.65)]"
        >
          {outsideCandidate ? (
            <div role="alert" className="space-y-3 border-b border-amber-200/20 bg-amber-200/[0.07] px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-amber-50">
                  {outsideCandidate.cityRelationship === "CITY_MEMBERSHIP_UNKNOWN"
                    ? `SnowRoute could not verify that this result is inside ${city?.cityName}.`
                    : `This result appears to be in ${outsideCandidate.cityName ?? "another city"}, not ${city?.cityName}.`}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  {outsideCandidate.cityRelationship === "CITY_MEMBERSHIP_UNKNOWN"
                    ? "Confirm the displayed address carefully, or keep searching within the selected city."
                    : "Change the city before using this location, or keep searching within the selected city."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {outsideCandidate.cityRelationship === "CITY_MEMBERSHIP_UNKNOWN" ? (
                  <button
                    ref={warningActionRef}
                    type="button"
                    onClick={() => acceptPlace(outsideCandidate)}
                    className="min-h-11 rounded-lg bg-amber-100 px-3 text-xs font-bold text-amber-950"
                  >
                    Use this result cautiously
                  </button>
                ) : outsideCandidate.cityName ? (
                  <button
                    ref={warningActionRef}
                    type="button"
                    onClick={() => {
                      onRequestCityChange(outsideCandidate.cityName!);
                      window.requestAnimationFrame(() => {
                        rootRef.current
                          ?.closest("section")
                          ?.querySelector<HTMLInputElement>(
                            'input[autocomplete="address-level2"]:not([disabled])',
                          )
                          ?.focus();
                      });
                    }}
                    className="min-h-11 rounded-lg bg-amber-100 px-3 text-xs font-bold text-amber-950"
                  >
                    Search {outsideCandidate.cityName}
                  </button>
                ) : null}
                <button
                  ref={
                    outsideCandidate.cityRelationship !== "CITY_MEMBERSHIP_UNKNOWN" &&
                    !outsideCandidate.cityName
                      ? warningActionRef
                      : undefined
                  }
                  type="button"
                  onClick={() => {
                    setOutsideCandidate(null);
                    window.requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  className="min-h-11 rounded-lg border border-white/15 px-3 text-xs font-semibold text-white"
                >
                  Keep searching in {city?.cityName}
                </button>
              </div>
            </div>
          ) : null}
          {isLoading ? (
            <div className="px-4 py-4 text-sm text-slate-300">
              Searching within {city?.cityName}…
            </div>
          ) : null}
          {!isLoading && searchError ? (
            <div className="space-y-3 px-4 py-4 text-sm text-rose-100">
              <div>
                <p className="font-semibold">{searchError.title}</p>
                <p className="mt-1 text-xs leading-5 text-rose-100/80">
                  {searchError.message}
                </p>
              </div>
              {searchError.retryable ? (
                <button
                  type="button"
                  onClick={retrySearch}
                  className="min-h-11 rounded-lg border border-rose-100/25 px-3 text-xs font-semibold"
                >
                  Retry search
                </button>
              ) : null}
            </div>
          ) : null}
          {!isLoading && !searchError && status === "not-found" ? (
            <div className="space-y-3 px-4 py-4 text-sm text-slate-300">
              <div>
                <p className="font-semibold text-slate-100">
                  No matches found in {city?.cityName}.
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Check the street number, try a business or landmark, or continue with the city.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                  trackLocationEvent("city_fallback_used", {
                    endpoint,
                    countryCode: city?.countryCode,
                    usesCityFallback: true,
                  });
                }}
                className="min-h-11 rounded-lg border border-cyan-100/25 bg-cyan-200/[0.07] px-3 text-xs font-semibold text-cyan-50"
              >
                Use central {city?.cityName}
              </button>
            </div>
          ) : null}
          {hasVisibleOptions ? (
            <div
              id={listboxId}
              role="listbox"
              aria-label={`Places in and near ${city?.cityName ?? "the selected city"}`}
            >
              {results.length > 0 ? (
                <div role="group" aria-label={`Matches in ${city?.cityName ?? "the selected city"}`}>
                  <p className="border-b border-white/8 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/70">
                    Matches in {city?.cityName}
                  </p>
                  <ul role="presentation" className="py-1">
                    {results.map((result, index) => renderOption(result, index, false))}
                  </ul>
                </div>
              ) : null}
              {nearbyResults.length > 0 ? (
                <div
                  role="group"
                  aria-label="Nearby matches outside the selected city"
                  className="border-t border-white/10"
                >
                  <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-100/75">
                    Nearby matches outside the selected city
                  </p>
                  <ul role="presentation" className="py-1">
                    {nearbyResults.map((result, index) =>
                      renderOption(result, results.length + index, true),
                    )}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {unitRoutingNote ? (
            <p className="border-t border-white/10 px-4 py-3 text-xs leading-5 text-amber-100/80">
              {unitRoutingNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
