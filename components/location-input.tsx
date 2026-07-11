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
      return "border-teal-300 bg-teal-50 text-teal-800";
    case "Place":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "Street":
      return "border-sky-300 bg-sky-50 text-sky-800";
    case "City":
      return "border-violet-300 bg-violet-50 text-violet-800";
    case "Region":
      return "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]";
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
        className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
      >
        <span>{label}</span>
        {selectedLocation ? (
          <span className="rounded-md border border-teal-300 bg-teal-50 px-2 py-0.5 text-[10px] tracking-[0.16em] text-teal-800">
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
          className={`field-control h-12 w-full pr-12 ${
            fieldError
              ? "border-rose-300/55 focus:border-rose-200/75"
              : ""
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
            className="absolute inset-y-0 right-1.5 my-auto flex size-10 items-center justify-center rounded-md text-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
      {selectedLocation ? (
        <p id={helperId} className="min-h-4 text-xs leading-5 text-[var(--color-text-faint)]">
          <span className={isApproximateSuggestion(selectedLocation) ? "text-amber-800" : "text-[var(--color-brand)]"}>
            {getPrecisionLabel(getEffectivePrecision(selectedLocation))}
          </span>{" "}
          • {selectedLocation.detail ?? selectedLocation.formattedAddress ?? "Coordinates locked"}
          {isApproximateSuggestion(selectedLocation)
            ? " • Routing uses the provider’s mapped center point."
            : ""}
        </p>
      ) : (
        <p id={helperId} className="min-h-4 text-xs text-[var(--color-text-muted)]">
          Search exact addresses, places, streets, or cities.
        </p>
      )}
      {fieldError ? (
        <p id={fieldErrorId} role="alert" className="text-xs leading-5 text-rose-800">
          {typeof fieldError === "string"
            ? fieldError
            : `${fieldError.title} ${fieldError.message}`}
        </p>
      ) : null}
      {showDropdown ? (
        <div
          id={listboxId}
          role="listbox"
          className="location-suggestions floating-menu absolute inset-x-0 top-[calc(100%+0.45rem)] z-[90] overflow-hidden"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-[var(--color-text-muted)]">Searching route stops...</div>
          ) : null}
          {!isLoading && error ? (
            <div className="space-y-2 px-4 py-3 text-sm text-rose-800">
              <p className="font-semibold">{error.title}</p>
              <p className="text-xs leading-5 text-rose-700">{error.message}</p>
              {error.correlationId ? (
                <p className="font-mono text-[10px] text-[var(--color-text-faint)]">
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
            <div className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
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
                        ? "bg-[var(--color-brand-soft)]"
                        : "hover:bg-[var(--color-surface-subtle)] focus-visible:bg-[var(--color-brand-soft)]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-[var(--color-text)] transition group-hover:text-[var(--color-brand)]">
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
                    <span className="text-xs leading-5 text-[var(--color-text-faint)]">
                      <span className={isApproximateSuggestion(suggestion) ? "text-amber-800" : "text-[var(--color-brand)]"}>
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
