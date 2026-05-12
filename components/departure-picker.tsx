"use client";

import { useMemo, useState } from "react";

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

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function roundUpToStep(minutes: number, step = TIME_STEP_MINUTES) {
  return Math.min(23 * 60 + 59, Math.ceil(minutes / step) * step);
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getMinimumMinutesForDate(dateValue: string) {
  const today = formatDateInputValue(new Date());

  if (dateValue !== today) {
    return 0;
  }

  return roundUpToStep(getCurrentMinutes() + TIME_STEP_MINUTES);
}

function parseLocalDateTime(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    const now = new Date();
    const minutes = roundUpToStep(getCurrentMinutes() + 60);
    return {
      dateValue: formatDateInputValue(now),
      minutes,
    };
  }

  return {
    dateValue: match[1],
    minutes: Number(match[2]) * 60 + Number(match[3]),
  };
}

function buildLocalDateTimeValue(dateValue: string, minutes: number) {
  const normalizedMinutes = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
  const hours = Math.floor(normalizedMinutes / 60);
  const remainingMinutes = normalizedMinutes % 60;

  return `${dateValue}T${pad(hours)}:${pad(remainingMinutes)}`;
}

function formatClock(minutes: number) {
  const hours24 = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${pad(remainingMinutes)} ${meridiem}`;
}

function parseClockInput(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  const match = /^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/.exec(normalized);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (minutes > 59) {
    return null;
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return null;
    }

    if (meridiem === "am") {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatLongDate(dateValue: string) {
  const date = parseDateValue(dateValue);

  if (!date) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getDayName(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function getMonthDay(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function DeparturePicker({
  value,
  timeZone,
  disabled = false,
  onChange,
}: DeparturePickerProps) {
  const { dateValue, minutes } = parseLocalDateTime(value);
  const [dateDraft, setDateDraft] = useState<string | null>(null);
  const [timeDraft, setTimeDraft] = useState<string | null>(null);
  const dayOptions = useMemo(() => {
    const today = new Date();

    return Array.from({ length: FORECAST_DAY_COUNT }, (_, index) => {
      const date = addDays(today, index);

      return {
        date,
        dateValue: formatDateInputValue(date),
        dayName: index === 0 ? "Today" : index === 1 ? "Tomorrow" : getDayName(date),
        monthDay: getMonthDay(date),
      };
    });
  }, []);
  const selectedDate = parseDateValue(dateValue) ?? new Date();
  const displayedDateValue = dateDraft ?? dateValue;
  const displayedTimeValue = timeDraft ?? formatClock(minutes);
  const minimumMinutes = getMinimumMinutesForDate(dateValue);
  const normalizedMinutes = Math.max(minutes, minimumMinutes);
  const railValue = Math.min(
    23 * 60 + 59,
    Math.max(minimumMinutes, roundUpToStep(normalizedMinutes)),
  );
  const selectedDateLabel = formatLongDate(dateValue);
  const quickTimes = [
    { label: "Morning", minutes: 8 * 60 },
    { label: "Noon", minutes: 12 * 60 },
    { label: "Afternoon", minutes: 15 * 60 },
    { label: "Evening", minutes: 18 * 60 },
    { label: "Late", minutes: 21 * 60 },
  ];

  function commit(nextDateValue: string, nextMinutes: number) {
    const validDate = parseDateValue(nextDateValue);

    if (!validDate) {
      return;
    }

    const safeMinutes = Math.max(
      Math.min(nextMinutes, 23 * 60 + 59),
      getMinimumMinutesForDate(nextDateValue),
    );

    onChange(buildLocalDateTimeValue(nextDateValue, safeMinutes));
  }

  function handleDateTextChange(nextValue: string) {
    setDateDraft(nextValue);
  }

  function commitDateDraft() {
    const nextDateDraft = dateDraft ?? dateValue;

    if (/^\d{4}-\d{2}-\d{2}$/.test(nextDateDraft)) {
      setDateDraft(null);
      commit(nextDateDraft, minutes);
      return;
    }

    setDateDraft(null);
  }

  function handleTimeTextChange(nextValue: string) {
    setTimeDraft(nextValue);
  }

  function commitTimeDraft() {
    const parsedMinutes = parseClockInput(timeDraft ?? formatClock(minutes));

    if (parsedMinutes !== null) {
      setTimeDraft(null);
      commit(dateValue, parsedMinutes);
      return;
    }

    setTimeDraft(null);
  }

  function nudgeMinutes(amount: number) {
    commit(dateValue, minutes + amount);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
            Departure Time
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-white">
            {selectedDateLabel} at {formatClock(minutes)}
          </p>
        </div>
        <span className="rounded-lg border border-cyan-100/15 bg-cyan-300/8 px-3 py-2 text-xs font-medium text-cyan-50">
          {timeZone}
        </span>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="departure-date"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              Date
            </label>
            <input
              id="departure-date"
              type="text"
              inputMode="numeric"
              value={displayedDateValue}
              onChange={(event) => handleDateTextChange(event.target.value)}
              onBlur={commitDateDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitDateDraft();
                }
              }}
              disabled={disabled}
              className="h-9 w-32 rounded-lg border border-white/10 bg-black/10 px-3 text-right text-xs font-semibold text-slate-200 outline-none transition focus:border-cyan-200/50 focus:bg-cyan-300/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {dayOptions.map((option) => {
              const isSelected = option.dateValue === dateValue;

              return (
                <button
                  key={option.dateValue}
                  type="button"
                  disabled={disabled}
                  onClick={() => commit(option.dateValue, normalizedMinutes)}
                  className={`rounded-xl border px-3 py-3 text-left transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200/55 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected
                      ? "border-cyan-200/55 bg-cyan-300/[0.16] shadow-[0_0_0_4px_rgba(125,211,252,0.08)]"
                      : "border-white/10 bg-white/[0.025] hover:border-cyan-100/25 hover:bg-cyan-300/[0.07]"
                  }`}
                >
                  <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {option.dayName}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-white">
                    {option.monthDay}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
            <button
              type="button"
              disabled={disabled || minutes <= minimumMinutes}
              onClick={() => nudgeMinutes(-TIME_STEP_MINUTES)}
              className="flex h-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-lg font-semibold text-slate-100 transition hover:border-cyan-100/25 hover:bg-cyan-300/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Move departure time 15 minutes earlier"
            >
              -
            </button>
            <label className="space-y-2" htmlFor="departure-clock-time">
              <span className="sr-only">Time</span>
              <input
                id="departure-clock-time"
                type="text"
                inputMode="text"
                value={displayedTimeValue}
                onChange={(event) => handleTimeTextChange(event.target.value)}
                onBlur={commitTimeDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitTimeDraft();
                  }
                }}
                disabled={disabled}
                className="h-14 w-full min-w-0 rounded-xl border border-cyan-200/25 bg-[#0d1b25] px-4 text-center text-xl font-semibold text-slate-50 outline-none transition duration-200 focus:border-cyan-100/70 focus:bg-cyan-200/[0.08] focus:shadow-[0_0_0_4px_rgba(125,211,252,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <button
              type="button"
              disabled={disabled || minutes >= 23 * 60 + 59}
              onClick={() => nudgeMinutes(TIME_STEP_MINUTES)}
              className="flex h-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-lg font-semibold text-slate-100 transition hover:border-cyan-100/25 hover:bg-cyan-300/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Move departure time 15 minutes later"
            >
              +
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-4">
            <input
              type="range"
              min={minimumMinutes}
              max={23 * 60 + 59}
              step={TIME_STEP_MINUTES}
              value={railValue}
              disabled={disabled}
              onChange={(event) => commit(dateValue, Number(event.target.value))}
              aria-label="Departure time"
              className="h-2 w-full cursor-pointer accent-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>11 PM</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {quickTimes.map((preset) => {
              const isActive = Math.abs(minutes - preset.minutes) < TIME_STEP_MINUTES;
              const isDisabled = disabled || preset.minutes < minimumMinutes;

              return (
                <button
                  key={preset.label}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => commit(dateValue, preset.minutes)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    isActive
                      ? "border-cyan-200/55 bg-cyan-300/[0.14] text-cyan-50"
                      : "border-white/10 bg-white/[0.025] text-slate-300 hover:border-cyan-100/25 hover:bg-cyan-300/[0.07]"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs leading-5 text-slate-400">
            Forecasts are available through {getMonthDay(dayOptions.at(-1)?.date ?? selectedDate)}.
          </p>
        </div>
      </div>
    </div>
  );
}
