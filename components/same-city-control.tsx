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
      <legend className="text-sm font-semibold text-[#202927]">
        Is the destination in the same city?
      </legend>
      <p id={descriptionId} className="mt-1 text-xs leading-5 text-[#6d7a76]">
        {sameCity && cityName
          ? `Both points will be searched within ${cityName}.`
          : "Choose No for an intercity trip, or Yes to reuse the starting city."}
      </p>
      <div className="mt-3 grid max-w-xs grid-cols-2 gap-1 rounded-lg border border-[#c8cec8] bg-[#eceee9] p-1">
        {[
          { value: true, label: "Yes" },
          { value: false, label: "No" },
        ].map((option) => {
          const selected = sameCity === option.value;
          return (
            <label
              key={option.label}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-4 text-sm font-semibold transition ${
                selected
                  ? "border-[#a9c8c2] bg-white text-[#155d59] shadow-sm"
                  : "border-transparent text-[#596762] hover:text-[#202927]"
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
