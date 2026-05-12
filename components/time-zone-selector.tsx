"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  filterTimeZoneOptions,
  getTimeZoneOption,
  type TimeZoneOption,
} from "@/lib/time-zones";

type TimeZoneSelectorProps = {
  value: string;
  disabled?: boolean;
  originTimeZoneSuggestion?: string | null;
  onChange: (value: string) => void;
  onUseOriginTimeZone?: () => void;
  onDismissOriginTimeZone?: () => void;
};

function formatOption(option: TimeZoneOption) {
  return `${option.label} (${option.value})`;
}

export function TimeZoneSelector({
  value,
  disabled = false,
  originTimeZoneSuggestion,
  onChange,
  onUseOriginTimeZone,
  onDismissOriginTimeZone,
}: TimeZoneSelectorProps) {
  const inputId = useId();
  const listboxId = `${inputId}-time-zones`;
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = getTimeZoneOption(value);
  const originOption = originTimeZoneSuggestion
    ? getTimeZoneOption(originTimeZoneSuggestion)
    : null;
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const options = useMemo(
    () => filterTimeZoneOptions(query, value).slice(0, 8),
    [query, value],
  );
  const activeOptionIndex = Math.min(activeIndex, Math.max(options.length - 1, 0));
  const activeOption = options[activeOptionIndex];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  function selectOption(option: TimeZoneOption) {
    onChange(option.value);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div className="space-y-3">
      <div ref={rootRef} className="relative space-y-2">
        <label
          htmlFor={inputId}
          className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300"
        >
          Time zone
        </label>
        <input
          id={inputId}
          type="text"
          value={isOpen ? query : formatOption(selectedOption)}
          placeholder="Search city, region, or time zone"
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-expanded={isOpen}
          aria-activedescendant={
            isOpen && activeOption ? `${listboxId}-${activeOption.value}` : undefined
          }
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
            setActiveIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((currentIndex) =>
                Math.min(currentIndex + 1, Math.max(options.length - 1, 0)),
              );
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
            }

            if (event.key === "Enter" && isOpen && activeOption) {
              event.preventDefault();
              selectOption(activeOption);
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
              setQuery("");
            }
          }}
          className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.045] px-4 text-sm font-medium text-slate-50 outline-none transition placeholder:text-slate-400 focus:border-cyan-200/60 focus:bg-cyan-200/[0.06] focus:shadow-[0_0_0_4px_rgba(125,211,252,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
        />

        {isOpen ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+0.45rem)] z-[80] overflow-hidden rounded-xl border border-cyan-100/16 bg-[#0d1722]/98 shadow-[0_24px_70px_rgba(1,8,16,0.58)] backdrop-blur-xl"
          >
            {options.length > 0 ? (
              <ul className="max-h-72 overflow-y-auto overscroll-contain py-1.5">
                {options.map((option, index) => {
                  const isActive = index === activeOptionIndex;
                  const isSelected = option.value === value;

                  return (
                    <li key={option.value}>
                      <button
                        id={`${listboxId}-${option.value}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onPointerDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectOption(option)}
                        className={`flex min-h-14 w-full flex-col justify-center px-4 py-3 text-left outline-none transition ${
                          isActive || isSelected
                            ? "bg-cyan-100/[0.09]"
                            : "hover:bg-cyan-100/[0.06]"
                        }`}
                      >
                        <span className="text-sm font-semibold text-slate-50">
                          {option.label}
                        </span>
                        <span className="mt-1 text-xs text-slate-300">
                          {option.region} • {option.value}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-slate-300">
                No matching time zones. Try a city like Toronto, Denver, or Vancouver.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {originOption ? (
        <div className="rounded-xl border border-cyan-200/18 bg-cyan-300/[0.08] p-3">
          <p className="text-sm leading-5 text-cyan-50">
            Origin appears to use{" "}
            <span className="font-semibold">{originOption.value}</span>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onUseOriginTimeZone}
              disabled={disabled}
              className="min-h-10 rounded-lg border border-cyan-100/30 bg-cyan-200/12 px-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Use origin time zone
            </button>
            <button
              type="button"
              onClick={onDismissOriginTimeZone}
              disabled={disabled}
              className="min-h-10 rounded-lg border border-white/12 bg-white/[0.04] px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Keep current
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-xs leading-5 text-slate-300">
        Departure time is interpreted in this time zone. Search by city, region, or
        IANA name.
      </p>
    </div>
  );
}
