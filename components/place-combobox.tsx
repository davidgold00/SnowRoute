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
          <p className="text-xs font-semibold text-[#50605b]">
            {label}
          </p>
          <span className="text-xs font-semibold text-[#2f7654]">
            Confirmed
          </span>
        </div>
        <div className="selected-control flex min-h-14 items-center justify-between gap-4 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#202927]">{place.primaryText}</p>
            <p className="mt-0.5 truncate text-xs text-[#596762]">
              {place.secondaryText ?? place.formattedAddress}
            </p>
            <p className="mt-1 text-xs font-medium text-[#176c68]">
              {precisionLabel(place)} · {placeTypeLabel(place)}
            </p>
            {place.cityRelationship === "NEAR_SELECTED_CITY" ? (
              <p className="mt-1 text-xs leading-5 text-[#796027]">
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
            className="min-h-11 shrink-0 rounded-md px-3 text-xs font-semibold text-[#176c68] transition hover:bg-[#dbece9] disabled:cursor-not-allowed disabled:opacity-55"
          >
            Change
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-xs leading-5 text-[#b33a32]">{error}</p>
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
        className={`min-h-14 cursor-pointer px-4 py-3 outline-none transition ${
          active ? "bg-[#e3f0ee]" : "hover:bg-[#f3f4f1]"
        }`}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#202927]">
              {result.primaryText}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#6d7a76]">
              {result.secondaryText ?? result.formattedAddress}
            </span>
          </span>
          <span className={`shrink-0 rounded border px-2 py-1 text-[10px] font-semibold ${
            nearby
              ? "border-[#ddc995] bg-[#fbf7ed] text-[#796027]"
              : "border-[#c6d9d5] bg-[#f2f8f6] text-[#176c68]"
          }`}>
            {placeTypeLabel(result)}
          </span>
        </span>
        <span className="mt-1.5 block text-[11px] text-[#6d7a76]">
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
        className="text-xs font-semibold text-[#384641]"
      >
        {label}
        <span className="ml-2 font-normal text-[#6d7a76]">
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
          className="field-control h-13 px-3.5 pr-12 text-base"
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
            className="absolute inset-y-0 right-1 my-auto grid size-11 place-items-center rounded-md text-lg text-[#6d7a76] transition hover:bg-[#eceee9] hover:text-[#202927]"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
      <p id={helperId} className="text-xs leading-5 text-[#6d7a76]">
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
        <p id={errorId} role="alert" className="text-xs leading-5 text-[#b33a32]">
          {error}
        </p>
      ) : null}

      {showListbox ? (
        <div
          className="floating-menu absolute inset-x-0 top-[calc(100%+0.4rem)] z-[120] max-h-[min(28rem,calc(100dvh-9rem))] overflow-y-auto overscroll-contain"
        >
          {outsideCandidate ? (
            <div role="alert" className="space-y-3 border-b border-[#ead9ad] bg-[#fbf7ed] px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-[#694914]">
                  {outsideCandidate.cityRelationship === "CITY_MEMBERSHIP_UNKNOWN"
                    ? `SnowRoute could not verify that this result is inside ${city?.cityName}.`
                    : `This result appears to be in ${outsideCandidate.cityName ?? "another city"}, not ${city?.cityName}.`}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#796027]">
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
                    className="min-h-11 rounded-md bg-[#a66516] px-3 text-xs font-bold text-white"
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
                    className="min-h-11 rounded-md bg-[#a66516] px-3 text-xs font-bold text-white"
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
                  className="button-secondary min-h-11 px-3 text-xs"
                >
                  Keep searching in {city?.cityName}
                </button>
              </div>
            </div>
          ) : null}
          {isLoading ? (
            <div className="px-4 py-4 text-sm text-[#596762]">
              Searching within {city?.cityName}…
            </div>
          ) : null}
          {!isLoading && searchError ? (
            <div className="space-y-3 px-4 py-4 text-sm text-[#8c312b]">
              <div>
                <p className="font-semibold">{searchError.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#7b514d]">
                  {searchError.message}
                </p>
              </div>
              {searchError.retryable ? (
                <button
                  type="button"
                  onClick={retrySearch}
                  className="button-secondary min-h-11 px-3 text-xs"
                >
                  Retry search
                </button>
              ) : null}
            </div>
          ) : null}
          {!isLoading && !searchError && status === "not-found" ? (
            <div className="space-y-3 px-4 py-4 text-sm text-[#596762]">
              <div>
                <p className="font-semibold text-[#202927]">
                  No matches found in {city?.cityName}.
                </p>
                <p className="mt-1 text-xs leading-5 text-[#6d7a76]">
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
                className="button-secondary min-h-11 px-3 text-xs text-[#176c68]"
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
                  <p className="border-b border-[#e4e7e2] px-4 py-2 text-xs font-semibold text-[#50605b]">
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
                  className="border-t border-[#d9ddd6]"
                >
                  <p className="px-4 py-2 text-xs font-semibold text-[#796027]">
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
            <p className="border-t border-[#d9ddd6] px-4 py-3 text-xs leading-5 text-[#796027]">
              {unitRoutingNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
