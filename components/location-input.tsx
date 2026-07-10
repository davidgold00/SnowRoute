"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useGeocodeSearch } from "@/hooks/use-geocode-search";
import type { PublicAppError } from "@/lib/app-error";
import type { LocationSuggestion } from "@/lib/types";

type LocationInputProps = {
  label: string;
  placeholder: string;
  value: string;
  selectedLocation: LocationSuggestion | null;
  onValueChange: (value: string) => void;
  onSelect: (suggestion: LocationSuggestion) => void;
  disabled?: boolean;
  fieldError?: PublicAppError | string | null;
  focusOnError?: boolean;
};

function getPlaceTypeTone(placeType: LocationSuggestion["placeType"]) {
  switch (placeType) {
    case "Address":
      return "border-cyan-200/35 bg-cyan-300/12 text-cyan-50";
    case "Place":
      return "border-emerald-200/30 bg-emerald-300/10 text-emerald-50";
    case "Street":
      return "border-sky-200/30 bg-sky-300/10 text-sky-50";
    case "City":
      return "border-violet-200/25 bg-violet-300/10 text-violet-50";
    case "Region":
      return "border-white/14 bg-white/[0.06] text-slate-100";
  }
}

function getPrecisionLabel(precision: LocationSuggestion["precision"] | undefined) {
  switch (precision) {
    case "rooftop":
      return "Exact building";
    case "parcel":
      return "Property-level";
    case "street":
      return "Street-level";
    case "postal":
      return "Postal-area";
    case "city":
      return "City-level";
    case "region":
      return "Region-level";
    default:
      return "Approximate match";
  }
}

function getEffectivePrecision(suggestion: LocationSuggestion) {
  if (suggestion.precision) {
    return suggestion.precision;
  }

  switch (suggestion.placeType) {
    case "Address":
    case "Street":
      return "street" as const;
    case "City":
      return "city" as const;
    case "Region":
      return "region" as const;
    default:
      return "unknown" as const;
  }
}

function isApproximateSuggestion(suggestion: LocationSuggestion) {
  return (
    suggestion.isApproximate ??
    ["postal", "city", "region", "unknown"].includes(getEffectivePrecision(suggestion))
  );
}

export function LocationInput({
  label,
  placeholder,
  value,
  selectedLocation,
  onValueChange,
  onSelect,
  disabled = false,
  fieldError = null,
  focusOnError = false,
}: LocationInputProps) {
  const inputId = useId();
  const listboxId = `${inputId}-suggestions`;
  const helperId = `${inputId}-helper`;
  const fieldErrorId = `${inputId}-error`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const shouldSearch =
    !disabled &&
    value.trim().length >= 2 &&
    (!selectedLocation || selectedLocation.label.trim() !== value.trim());
  const { suggestions, isLoading, error, status, retrySearch } = useGeocodeSearch(
    value,
    shouldSearch,
  );
  const showDropdown =
    isOpen &&
    shouldSearch &&
    (isLoading || suggestions.length > 0 || Boolean(error) || status === "not-found");
  const activeOptionIndex = Math.min(activeIndex, Math.max(suggestions.length - 1, 0));
  const activeSuggestion =
    showDropdown && suggestions.length > 0 ? suggestions[activeOptionIndex] : null;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (fieldError && focusOnError && !disabled) {
      inputRef.current?.focus();
    }
  }, [disabled, fieldError, focusOnError]);

  function selectSuggestion(suggestion: LocationSuggestion) {
    onSelect(suggestion);
    setIsOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`location-input relative space-y-2 ${
        showDropdown ? "location-input--open" : ""
      }`}
    >
      <label
        htmlFor={inputId}
        className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-300"
      >
        <span>{label}</span>
        {selectedLocation ? (
          <span className="rounded-md border border-cyan-200/25 bg-cyan-300/10 px-2 py-0.5 text-[10px] tracking-[0.16em] text-cyan-100">
            locked
          </span>
        ) : null}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={200}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={showDropdown ? listboxId : undefined}
          aria-expanded={showDropdown}
          aria-activedescendant={
            activeSuggestion ? `${listboxId}-option-${activeOptionIndex}` : undefined
          }
          aria-busy={isLoading}
          aria-invalid={Boolean(fieldError)}
          aria-errormessage={fieldError ? fieldErrorId : undefined}
          aria-describedby={`${helperId}${fieldError ? ` ${fieldErrorId}` : ""}`}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setActiveIndex(0);
            setIsOpen(true);
            onValueChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((currentIndex) =>
                Math.min(currentIndex + 1, Math.max(suggestions.length - 1, 0)),
              );
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
            }

            if (event.key === "Enter" && activeSuggestion) {
              event.preventDefault();
              selectSuggestion(activeSuggestion);
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
            }
          }}
          className={`h-14 w-full rounded-xl border bg-white/[0.045] px-4 pr-12 text-base text-slate-50 outline-none transition duration-200 placeholder:text-slate-400 focus:bg-cyan-200/[0.06] focus:shadow-[0_0_0_4px_rgba(125,211,252,0.08)] disabled:cursor-not-allowed disabled:opacity-60 ${
            fieldError
              ? "border-rose-300/55 focus:border-rose-200/75"
              : "border-white/12 focus:border-cyan-200/55"
          }`}
        />
        {value && !disabled ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLocaleLowerCase()}`}
            onClick={() => {
              setActiveIndex(0);
              setIsOpen(false);
              onValueChange("");
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-1.5 my-auto flex size-10 items-center justify-center rounded-lg text-lg text-slate-300 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-100/70"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
      {selectedLocation ? (
        <p id={helperId} className="min-h-4 text-xs leading-5 text-slate-400">
          <span className={isApproximateSuggestion(selectedLocation) ? "text-amber-100/85" : "text-cyan-100/85"}>
            {getPrecisionLabel(getEffectivePrecision(selectedLocation))}
          </span>{" "}
          • {selectedLocation.detail ?? selectedLocation.formattedAddress ?? "Coordinates locked"}
          {isApproximateSuggestion(selectedLocation)
            ? " • Routing uses the provider’s mapped center point."
            : ""}
        </p>
      ) : (
        <p id={helperId} className="min-h-4 text-xs text-slate-300">
          Search exact addresses, places, streets, or cities.
        </p>
      )}
      {fieldError ? (
        <p id={fieldErrorId} role="alert" className="text-xs leading-5 text-rose-200">
          {typeof fieldError === "string"
            ? fieldError
            : `${fieldError.title} ${fieldError.message}`}
        </p>
      ) : null}
      {showDropdown ? (
        <div
          id={listboxId}
          role="listbox"
          className="location-suggestions absolute inset-x-0 top-[calc(100%+0.45rem)] z-[90] overflow-hidden rounded-xl border border-cyan-100/16 bg-[#0d1722]/98 shadow-[0_24px_70px_rgba(1,8,16,0.58)] backdrop-blur-xl"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-slate-300">Searching route stops...</div>
          ) : null}
          {!isLoading && error ? (
            <div className="space-y-2 px-4 py-3 text-sm text-rose-100">
              <p className="font-semibold">{error.title}</p>
              <p className="text-xs leading-5 text-rose-100/80">{error.message}</p>
              {error.correlationId ? (
                <p className="font-mono text-[10px] text-slate-400">
                  Reference: {error.correlationId}
                </p>
              ) : null}
              {error.retryable ? (
                <button
                  type="button"
                  onClick={retrySearch}
                  className="min-h-9 rounded-lg border border-rose-100/25 bg-rose-100/[0.07] px-3 text-xs font-semibold text-rose-50 transition hover:bg-rose-100/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-100/60"
                >
                  Retry search
                </button>
              ) : null}
            </div>
          ) : null}
          {!isLoading && !error && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-300">
              No matches yet. Try a city, address, or landmark.
            </div>
          ) : null}
          {!isLoading && !error && suggestions.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto overscroll-contain py-1.5">
              {suggestions.map((suggestion, index) => {
                const isActive = index === activeOptionIndex;

                return (
                <li key={suggestion.id}>
                  <button
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onPointerDown={(event) => {
                      event.preventDefault();
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      selectSuggestion(suggestion);
                    }}
                    className={`group flex min-h-16 w-full flex-col gap-2 px-4 py-3 text-left outline-none transition ${
                      isActive
                        ? "bg-cyan-100/[0.09]"
                        : "hover:bg-cyan-100/[0.07] focus-visible:bg-cyan-100/[0.09]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-50 transition group-hover:text-white">
                        {suggestion.primaryLabel || suggestion.label}
                      </span>
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${getPlaceTypeTone(
                          suggestion.placeType,
                        )}`}
                      >
                        {suggestion.placeType}
                      </span>
                    </span>
                    <span className="text-xs leading-5 text-slate-400">
                      <span className={isApproximateSuggestion(suggestion) ? "text-amber-100/80" : "text-cyan-100/75"}>
                        {getPrecisionLabel(getEffectivePrecision(suggestion))}
                      </span>{" "}
                      • {suggestion.detail || suggestion.formattedAddress || "Location match"}
                    </span>
                  </button>
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
