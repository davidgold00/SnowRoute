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
  const [hasFocus, setHasFocus] = useState(false);
  const shouldSearch =
    !disabled &&
    value.trim().length >= 2 &&
    (!selectedLocation || selectedLocation.label.trim() !== value.trim());
  const { suggestions, isLoading, error } = useGeocodeSearch(value, shouldSearch);
  const showDropdown =
    hasFocus && shouldSearch && (isLoading || suggestions.length > 0 || Boolean(error));

  return (
    <div className="relative space-y-2">
      <label
        htmlFor={inputId}
        className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-slate-300"
      >
        <span>{label}</span>
        {selectedLocation ? (
          <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] tracking-[0.18em] text-cyan-100">
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
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-14 w-full rounded-2xl border border-white/12 bg-white/[0.03] px-4 text-base text-slate-50 outline-none transition duration-200 placeholder:text-slate-500 focus:border-cyan-300/45 focus:bg-cyan-400/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
      />
      {selectedLocation ? (
        <p className="text-xs text-slate-400">
          {selectedLocation.region ?? selectedLocation.country ?? "Coordinates locked"} •{" "}
          {selectedLocation.lat.toFixed(3)}, {selectedLocation.lon.toFixed(3)}
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          Select a suggestion so SnowRoute can pin a precise route.
        </p>
      )}
      {showDropdown ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-white/12 bg-[#0f1a2e]/95 shadow-[0_24px_80px_rgba(4,10,21,0.55)] backdrop-blur-xl">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-slate-300">Searching winter route stops…</div>
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
            <ul className="max-h-72 overflow-y-auto py-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelect(suggestion);
                      setHasFocus(false);
                    }}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-white/6"
                  >
                    <span className="text-sm font-medium text-slate-50">
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
