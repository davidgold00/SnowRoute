"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useCitySearch } from "@/hooks/use-location-search";
import { trackLocationEvent } from "@/lib/location-analytics";
import type { CitySelection } from "@/lib/types";

type CityComboboxProps = {
  label: string;
  query: string;
  city: CitySelection | null;
  onQueryChange: (value: string) => void;
  onSelect: (city: CitySelection) => void;
  onClear: () => void;
  endpoint: "start" | "destination";
  disabled?: boolean;
  error?: string | null;
  focusOnError?: boolean;
};

function HighlightedText({ text, query }: { text: string; query: string }) {
  const matchIndex = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());

  if (matchIndex < 0 || !query.trim()) {
    return text;
  }

  return (
    <>
      {text.slice(0, matchIndex)}
      <mark className="bg-[#cfe6e2] text-inherit">
        {text.slice(matchIndex, matchIndex + query.trim().length)}
      </mark>
      {text.slice(matchIndex + query.trim().length)}
    </>
  );
}

function cityContext(city: CitySelection) {
  return [city.regionName, city.countryName].filter(Boolean).join(", ");
}

export function CityCombobox({
  label,
  query,
  city,
  onQueryChange,
  onSelect,
  onClear,
  endpoint,
  disabled = false,
  error = null,
  focusOnError = false,
}: CityComboboxProps) {
  const inputId = useId();
  const listboxId = `${inputId}-cities`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const statusId = `${inputId}-status`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const shouldSearch = !disabled && !city && query.trim().length >= 2;
  const { results, status, error: searchError, isLoading, retrySearch } = useCitySearch(
    query,
    shouldSearch,
  );
  const showListbox =
    isOpen &&
    shouldSearch &&
    (isLoading || results.length > 0 || Boolean(searchError) || status === "not-found");
  const hasVisibleOptions =
    showListbox && !isLoading && !searchError && results.length > 0;
  const activeCity = activeIndex >= 0 ? results[activeIndex] ?? null : null;

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
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

  function selectCity(selection: CitySelection) {
    onSelect(selection);
    setIsOpen(false);
    setActiveIndex(-1);
    trackLocationEvent("city_selected", {
      endpoint,
      countryCode: selection.countryCode,
      precision: selection.precision,
      provider: "openrouteservice-pelias",
    });
  }

  if (city) {
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
            <p className="truncate text-sm font-semibold text-[#202927]">{city.cityName}</p>
            <p className="mt-0.5 truncate text-xs text-[#596762]">{cityContext(city)}</p>
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

  const statusMessage = isLoading
    ? "Searching cities."
    : searchError
      ? `${searchError.title} ${searchError.message}`
      : status === "not-found"
        ? "No matching cities found."
        : results.length > 0
          ? `${results.length} city suggestions available.`
          : "Enter at least two characters, then choose a city.";

  return (
    <div
      ref={rootRef}
      className="relative space-y-2"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;

        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setIsOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <label
        htmlFor={inputId}
        className="text-xs font-semibold text-[#384641]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={query}
          disabled={disabled}
          maxLength={120}
          autoComplete="address-level2"
          placeholder="Search city, state or province, country"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={hasVisibleOptions}
          aria-controls={hasVisibleOptions ? listboxId : undefined}
          aria-activedescendant={
            activeCity ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-busy={isLoading}
          aria-invalid={Boolean(error)}
          aria-describedby={`${helperId} ${statusId}${error ? ` ${errorId}` : ""}`}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && results.length > 0) {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) =>
                current < 0 ? 0 : Math.min(current + 1, results.length - 1),
              );
            } else if (event.key === "ArrowUp" && results.length > 0) {
              event.preventDefault();
              setActiveIndex((current) =>
                current <= 0 ? results.length - 1 : current - 1,
              );
            } else if (event.key === "Enter" && activeCity) {
              event.preventDefault();
              selectCity(activeCity);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
              setActiveIndex(-1);
            }
          }}
          className="field-control h-13 px-3.5 pr-12 text-base"
        />
        {query ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLocaleLowerCase()}`}
            onClick={() => {
              onQueryChange("");
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
        Select a city first so SnowRoute can search exact locations more accurately.
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
        <div className="floating-menu absolute inset-x-0 top-[calc(100%+0.4rem)] z-[120] overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-4 text-sm text-[#596762]">Searching cities…</div>
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
            <div className="px-4 py-4 text-sm text-[#596762]">
              <p className="font-semibold text-[#202927]">No matching cities found.</p>
              <p className="mt-1 text-xs leading-5 text-[#6d7a76]">
                Check the spelling or add a state, province, or country.
              </p>
            </div>
          ) : null}
          {!isLoading && !searchError && results.length > 0 ? (
            <ul
              id={listboxId}
              role="listbox"
              className="max-h-[min(20rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain py-1.5"
            >
              {results.map((result, index) => {
                const active = index === activeIndex;
                return (
                  <li
                    key={result.providerId ?? `${result.displayName}-${result.latitude}-${result.longitude}`}
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={active}
                    onPointerDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectCity(result)}
                    className={`flex min-h-16 cursor-pointer items-center justify-between gap-4 px-4 py-3 outline-none transition ${
                      active ? "bg-[#e3f0ee]" : "hover:bg-[#f3f4f1]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#202927]">
                        <HighlightedText text={result.cityName} query={query} />
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#6d7a76]">
                        {cityContext(result)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-[#176c68]">
                      City
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
