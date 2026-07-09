"use client";

import { useMemo } from "react";

const FORECAST_DAY_COUNT = 15;
const TIME_STEP_MINUTES = 15;

type DeparturePickerProps = {
  value: string;
  timeZone: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function roundUpToStep(minutes: number) {
  return Math.min(23 * 60 + 45, Math.ceil(minutes / TIME_STEP_MINUTES) * TIME_STEP_MINUTES);
}

function getMinimumMinutesForDate(dateValue: string) {
  if (dateValue !== formatDateInputValue(new Date())) {
    return 0;
  }

  const now = new Date();
  return roundUpToStep(now.getHours() * 60 + now.getMinutes() + TIME_STEP_MINUTES);
}

function parseLocalDateTime(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    const date = new Date();
    return {
      dateValue: formatDateInputValue(date),
      minutes: roundUpToStep(date.getHours() * 60 + date.getMinutes() + 60),
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
  return new Intl.DateTimeFormat(undefined, { month: "long" }).format(
    new Date(2026, monthIndex, 1),
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
      }).format(date)
    : dateValue;
}

export function DeparturePicker({
  value,
  timeZone,
  disabled = false,
  onChange,
}: DeparturePickerProps) {
  const { dateValue, minutes } = parseLocalDateTime(value);
  const dateOptions = useMemo(
    () =>
      Array.from({ length: FORECAST_DAY_COUNT }, (_, index) => {
        const date = addDays(new Date(), index);
        return {
          dateValue: formatDateInputValue(date),
          year: date.getFullYear(),
          month: date.getMonth(),
          day: date.getDate(),
        };
      }),
    [],
  );
  const selectedDate = parseDateValue(dateValue) ?? new Date();
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const selectedDay = selectedDate.getDate();
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
  const minimumMinutes = getMinimumMinutesForDate(dateValue);
  const selectedMinutes = Math.max(minutes, minimumMinutes);
  const timeOptions = Array.from(
    { length: 24 * (60 / TIME_STEP_MINUTES) },
    (_, index) => index * TIME_STEP_MINUTES,
  );

  function commit(nextDateValue: string, nextMinutes: number) {
    if (!dateOptions.some((option) => option.dateValue === nextDateValue)) {
      return;
    }

    onChange(
      buildLocalDateTimeValue(
        nextDateValue,
        Math.max(getMinimumMinutesForDate(nextDateValue), nextMinutes),
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
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
            Departure
          </p>
          <p className="mt-1 text-base font-semibold text-white">
            {formatSelectedDate(dateValue)} at {formatClock(selectedMinutes)}
          </p>
        </div>
        <span className="max-w-full truncate rounded-lg border border-cyan-100/15 bg-cyan-300/8 px-3 py-1.5 text-xs font-medium text-cyan-50">
          {timeZone}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          Time
          <select
            value={selectedMinutes}
            disabled={disabled}
            onChange={(event) => commit(dateValue, Number(event.target.value))}
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
