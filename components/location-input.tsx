"use client";

import { useId, useState } from "react";

import { useGeocodeSearch } from "@/hooks/use-geocode-search";
import type { LocationSuggestion } from "@/lib/types";

type LocationInputProps = {
  label: string;
  placeholder: string;
  value: string;
  selectedLocation: LocationSuggestion | null;
  onValueChange: (value: string) => void;
  onSelect: (suggestion: LocationSuggestion) => void;
  disabled?: boolean;
};

export function LocationInput({
  label,
  placeholder,
  value,
  selectedLocation,
  onValueChange,
  onSelect,
  disabled = false,
}: LocationInputProps) {
  const inputId = useId();
  const listboxId = `${inputId}-suggestions`;
  const [hasFocus, setHasFocus] = useState(false);
  const shouldSearch =
    !disabled &&
    value.trim().length >= 2 &&
    (!selectedLocation || selectedLocation.label.trim() !== value.trim());
  const { suggestions, isLoading, error } = useGeocodeSearch(value, shouldSearch);
  const showDropdown =
    hasFocus && shouldSearch && (isLoading || suggestions.length > 0 || Boolean(error));

  return (
    <div
      className={`location-input relative space-y-2 ${
        showDropdown ? "location-input--open" : ""
      }`}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;

        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setHasFocus(false);
        }
      }}
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
      <input
        id={inputId}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={showDropdown ? listboxId : undefined}
        aria-expanded={showDropdown}
        aria-busy={isLoading}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-14 w-full rounded-xl border border-white/12 bg-white/[0.045] px-4 text-base text-slate-50 outline-none transition duration-200 placeholder:text-slate-500 focus:border-cyan-200/55 focus:bg-cyan-200/[0.06] focus:shadow-[0_0_0_4px_rgba(125,211,252,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
      />
      {selectedLocation ? (
        <p className="min-h-4 text-xs text-slate-400">
          {selectedLocation.region ?? selectedLocation.country ?? "Coordinates locked"} •{" "}
          {selectedLocation.lat.toFixed(3)}, {selectedLocation.lon.toFixed(3)}
        </p>
      ) : (
        <p className="min-h-4 text-xs text-slate-500">
          Select a suggestion so SnowRoute can pin a precise route.
        </p>
      )}
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
            <div className="px-4 py-3 text-sm text-rose-200">{error}</div>
          ) : null}
          {!isLoading && !error && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-300">
              No matches yet. Try a city, address, or landmark.
            </div>
          ) : null}
          {!isLoading && !error && suggestions.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto overscroll-contain py-1.5">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onPointerDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      onSelect(suggestion);
                      setHasFocus(false);
                    }}
                    className="group flex w-full flex-col gap-1 px-4 py-3 text-left outline-none transition hover:bg-cyan-100/[0.07] focus-visible:bg-cyan-100/[0.09]"
                  >
                    <span className="text-sm font-semibold text-slate-50 transition group-hover:text-white">
                      {suggestion.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {[suggestion.region, suggestion.country].filter(Boolean).join(" • ") ||
                        "Location match"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
