"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useMemo, useRef } from "react";

import { getDefaultDepartureTimeLocal } from "@/lib/time-zones";

const FORECAST_DAY_COUNT = 15;
const TIME_STEP_MINUTES = 15;

type DeparturePickerProps = {
  value: string;
  timeZone: string;
  disabled?: boolean;
  errorId?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInputValue(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function roundUpToStep(minutes: number) {
  return Math.min(23 * 60 + 45, Math.ceil(minutes / TIME_STEP_MINUTES) * TIME_STEP_MINUTES);
}

function getCurrentLocalParts(timeZone: string, now = new Date()) {
  let value: string;

  try {
    value = formatInTimeZone(now, timeZone, "yyyy-MM-dd'T'HH:mm");
  } catch {
    value = formatInTimeZone(now, "UTC", "yyyy-MM-dd'T'HH:mm");
  }

  const [dateValue, clockValue = "00:00"] = value.split("T");
  const [hours = 0, minutes = 0] = clockValue.split(":").map(Number);

  return { dateValue, minutes: hours * 60 + minutes };
}

function getMinimumMinutesForDate(dateValue: string, timeZone: string) {
  const current = getCurrentLocalParts(timeZone);

  if (dateValue !== current.dateValue) {
    return 0;
  }

  return roundUpToStep(current.minutes + TIME_STEP_MINUTES);
}

function parseLocalDateTime(value: string, timeZone: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    const fallback = getDefaultDepartureTimeLocal(timeZone);
    const fallbackMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(fallback);

    return {
      dateValue: fallbackMatch?.[1] ?? getCurrentLocalParts(timeZone).dateValue,
      minutes:
        Number(fallbackMatch?.[2] ?? 0) * 60 + Number(fallbackMatch?.[3] ?? 0),
    };
  }

  return {
    dateValue: match[1],
    minutes: Number(match[2]) * 60 + Number(match[3]),
  };
}

function buildLocalDateTimeValue(dateValue: string, minutes: number) {
  const safeMinutes = Math.min(Math.max(minutes, 0), 23 * 60 + 45);
  return `${dateValue}T${pad(Math.floor(safeMinutes / 60))}:${pad(safeMinutes % 60)}`;
}

function formatClock(minutes: number) {
  const hours24 = Math.floor(minutes / 60);
  const minutesPart = minutes % 60;
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${pad(minutesPart)} ${meridiem}`;
}

function formatMonth(monthIndex: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    timeZone: "UTC",
  }).format(
    new Date(Date.UTC(2026, monthIndex, 1)),
  );
}

function formatSelectedDate(dateValue: string) {
  const date = parseDateValue(dateValue);

  return date
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(date)
    : dateValue;
}

export function DeparturePicker({
  value,
  timeZone,
  disabled = false,
  errorId,
  invalid = false,
  onChange,
}: DeparturePickerProps) {
  const timeSelectRef = useRef<HTMLSelectElement>(null);
  const { dateValue, minutes } = parseLocalDateTime(value, timeZone);
  const dateOptions = useMemo(
    () => {
      const current = getCurrentLocalParts(timeZone);
      const firstDate = parseDateValue(current.dateValue) ?? new Date();
      const nextSlotMinutes = Math.ceil(
        (current.minutes + TIME_STEP_MINUTES) / TIME_STEP_MINUTES,
      ) * TIME_STEP_MINUTES;
      const startOffset = nextSlotMinutes > 23 * 60 + 45 ? 1 : 0;

      return Array.from({ length: FORECAST_DAY_COUNT - startOffset }, (_, index) => {
        const date = addDays(firstDate, index + startOffset);
        return {
          dateValue: formatDateInputValue(date),
          year: date.getUTCFullYear(),
          month: date.getUTCMonth(),
          day: date.getUTCDate(),
        };
      });
    },
    [timeZone],
  );
  const effectiveDateValue = dateOptions.some((option) => option.dateValue === dateValue)
    ? dateValue
    : dateOptions[0]?.dateValue ?? dateValue;
  const selectedDate =
    parseDateValue(effectiveDateValue) ??
    parseDateValue(getCurrentLocalParts(timeZone).dateValue) ??
    new Date();
  const selectedYear = selectedDate.getUTCFullYear();
  const selectedMonth = selectedDate.getUTCMonth();
  const selectedDay = selectedDate.getUTCDate();
  const yearOptions = Array.from(new Set(dateOptions.map((option) => option.year)));
  const monthOptions = Array.from(
    new Set(
      dateOptions
        .filter((option) => option.year === selectedYear)
        .map((option) => option.month),
    ),
  );
  const dayOptions = dateOptions.filter(
    (option) => option.year === selectedYear && option.month === selectedMonth,
  );
  const minimumMinutes = getMinimumMinutesForDate(effectiveDateValue, timeZone);
  const selectedMinutes = Math.max(minutes, minimumMinutes);
  const timeOptions = Array.from(
    { length: 24 * (60 / TIME_STEP_MINUTES) },
    (_, index) => index * TIME_STEP_MINUTES,
  );

  useEffect(() => {
    if (invalid && errorId && !disabled) {
      timeSelectRef.current?.focus();
    }
  }, [disabled, errorId, invalid]);

  function commit(nextDateValue: string, nextMinutes: number) {
    if (!dateOptions.some((option) => option.dateValue === nextDateValue)) {
      return;
    }

    onChange(
      buildLocalDateTimeValue(
        nextDateValue,
        Math.max(getMinimumMinutesForDate(nextDateValue, timeZone), nextMinutes),
      ),
    );
  }

  function selectYear(year: number) {
    const nextDate = dateOptions.find(
      (option) =>
        option.year === year && option.month === selectedMonth && option.day === selectedDay,
    ) ?? dateOptions.find((option) => option.year === year);

    if (nextDate) {
      commit(nextDate.dateValue, selectedMinutes);
    }
  }

  function selectMonth(month: number) {
    const nextDate = dateOptions.find(
      (option) =>
        option.year === selectedYear && option.month === month && option.day === selectedDay,
    ) ??
      dateOptions.find(
        (option) => option.year === selectedYear && option.month === month,
      );

    if (nextDate) {
      commit(nextDate.dateValue, selectedMinutes);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
            Departure
          </p>
          <p className="mt-1 text-base font-semibold text-white">
            {formatSelectedDate(effectiveDateValue)} at {formatClock(selectedMinutes)}
          </p>
        </div>
        <span className="max-w-full truncate rounded-lg border border-cyan-100/15 bg-cyan-300/8 px-3 py-1.5 text-xs font-medium text-cyan-50">
          {timeZone}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          Time
          <select
            ref={timeSelectRef}
            value={selectedMinutes}
            disabled={disabled}
            aria-describedby={errorId}
            aria-invalid={invalid}
            onChange={(event) => commit(effectiveDateValue, Number(event.target.value))}
            className="h-11 w-full rounded-lg border border-white/12 bg-[#0d1b25] px-3 text-sm font-semibold normal-case tracking-normal text-slate-50 outline-none transition focus:border-cyan-200/60 focus:shadow-[0_0_0_4px_rgba(125,211,252,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {timeOptions.map((option) => (
              <option key={option} value={option} disabled={option < minimumMinutes}>
                {formatClock(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          Month
          <select
            value={selectedMonth}
            disabled={disabled}
            aria-describedby={errorId}
            aria-invalid={invalid}
            onChange={(event) => selectMonth(Number(event.target.value))}
            className="h-11 w-full rounded-lg border border-white/12 bg-[#0d1b25] px-3 text-sm font-semibold normal-case tracking-normal text-slate-50 outline-none transition focus:border-cyan-200/60 focus:shadow-[0_0_0_4px_rgba(125,211,252,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          Day
          <select
            value={selectedDay}
            disabled={disabled}
            aria-describedby={errorId}
            aria-invalid={invalid}
            onChange={(event) => {
              const nextDate = dayOptions.find(
                (option) => option.day === Number(event.target.value),
              );
              if (nextDate) {
                commit(nextDate.dateValue, selectedMinutes);
              }
            }}
            className="h-11 w-full rounded-lg border border-white/12 bg-[#0d1b25] px-3 text-sm font-semibold normal-case tracking-normal text-slate-50 outline-none transition focus:border-cyan-200/60 focus:shadow-[0_0_0_4px_rgba(125,211,252,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dayOptions.map((option) => (
              <option key={option.dateValue} value={option.day}>
                {option.day}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          Year
          <select
            value={selectedYear}
            disabled={disabled}
            aria-describedby={errorId}
            aria-invalid={invalid}
            onChange={(event) => selectYear(Number(event.target.value))}
            className="h-11 w-full rounded-lg border border-white/12 bg-[#0d1b25] px-3 text-sm font-semibold normal-case tracking-normal text-slate-50 outline-none transition focus:border-cyan-200/60 focus:shadow-[0_0_0_4px_rgba(125,211,252,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        Choose from the next 15 forecast days. Today&apos;s passed times are unavailable.
      </p>
    </section>
  );
}
