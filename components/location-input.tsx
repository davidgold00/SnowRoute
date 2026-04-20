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
    <div className="relative space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300"
        >
          {label}
        </label>
        {selectedLocation ? (
          <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
            locked
          </span>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            precision required
          </span>
        )}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              selectedLocation ? "bg-cyan-300 shadow-[0_0_0_6px_rgba(125,211,252,0.08)]" : "bg-slate-500"
            }`}
          />
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isLoading
                ? "bg-amber-300 shadow-[0_0_0_6px_rgba(252,211,77,0.08)]"
                : selectedLocation
                  ? "bg-cyan-300 shadow-[0_0_0_6px_rgba(125,211,252,0.08)]"
                  : "bg-white/15"
            }`}
          />
        </div>
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
          className="h-14 w-full rounded-[24px] border border-white/12 bg-[#0b1728]/88 px-10 text-base text-slate-50 outline-none transition duration-200 placeholder:text-slate-500 focus:border-cyan-300/45 focus:bg-cyan-400/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {selectedLocation ? (
        <div className="rounded-[20px] border border-white/10 bg-white/[0.035] px-4 py-3 text-xs leading-5 text-slate-300">
          <span className="font-semibold text-slate-100">
            {selectedLocation.region ?? selectedLocation.country ?? "Coordinates locked"}
          </span>
          <span className="mx-2 text-slate-500">•</span>
          {selectedLocation.lat.toFixed(3)}, {selectedLocation.lon.toFixed(3)}
        </div>
      ) : (
        <p className="text-xs leading-5 text-slate-500">
          Select a suggestion so SnowRoute can pin a precise route geometry before analysis.
        </p>
      )}

      {showDropdown ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.55rem)] z-30 overflow-hidden rounded-[24px] border border-white/12 bg-[#0c182a]/96 shadow-[0_28px_80px_rgba(4,10,21,0.6)] backdrop-blur-xl">
          <div className="border-b border-white/8 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {isLoading ? "Searching winter route stops…" : "Best matches"}
          </div>
          {isLoading ? (
            <div className="px-4 py-4 text-sm text-slate-300">Finding precise route anchors…</div>
          ) : null}
          {!isLoading && error ? (
            <div className="px-4 py-4 text-sm text-rose-200">{error}</div>
          ) : null}
          {!isLoading && !error && suggestions.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-300">
              No matches yet. Try a city, address, or landmark.
            </div>
          ) : null}
          {!isLoading && !error && suggestions.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto py-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelect(suggestion);
                      setHasFocus(false);
                    }}
                    className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-slate-50">
                        {suggestion.label}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {[suggestion.region, suggestion.country].filter(Boolean).join(" • ") ||
                          "Location match"}
                      </span>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      Select
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
