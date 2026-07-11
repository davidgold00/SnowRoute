"use client";

import { useId } from "react";

import { trackLocationEvent } from "@/lib/location-analytics";

export function SameCityControl({
  sameCity,
  cityName,
  disabled = false,
  onChange,
}: {
  sameCity: boolean;
  cityName?: string | null;
  disabled?: boolean;
  onChange: (sameCity: boolean) => void;
}) {
  const descriptionId = useId();
  const statusId = useId();

  function select(value: boolean) {
    onChange(value);
    trackLocationEvent(value ? "same_city_enabled" : "same_city_disabled");
  }

  return (
    <fieldset disabled={disabled} aria-describedby={`${descriptionId} ${statusId}`}>
      <legend className="text-sm font-semibold text-slate-100">
        Is the destination in the same city?
      </legend>
      <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-400">
        {sameCity && cityName
          ? `Both points will be searched within ${cityName}.`
          : "Choose No for an intercity trip, or Yes to reuse the starting city."}
      </p>
      <div className="mt-3 grid max-w-sm grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/10 p-1.5">
        {[
          { value: true, label: "Yes" },
          { value: false, label: "No" },
        ].map((option) => {
          const selected = sameCity === option.value;
          return (
            <label
              key={option.label}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-4 text-sm font-semibold transition ${
                selected
                  ? "border-cyan-200/35 bg-cyan-300/[0.13] text-white"
                  : "border-transparent text-slate-300 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <input
                type="radio"
                name="same-city"
                value={option.value ? "yes" : "no"}
                checked={selected}
                onChange={() => select(option.value)}
                className="sr-only"
              />
              {option.label}
              <span className="sr-only">
                {option.value ? ", destination is in the same city" : ", destination is in a different city"}
              </span>
            </label>
          );
        })}
      </div>
      <p id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
        {sameCity
          ? cityName
            ? `Same-city mode enabled. Destination city is ${cityName}.`
            : "Same-city mode enabled. Choose the shared city."
          : "Different-city mode enabled. Choose a destination city."}
      </p>
    </fieldset>
  );
}
