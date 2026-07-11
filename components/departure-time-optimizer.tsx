"use client";

import { useMemo, useState } from "react";

import { RecommendationPill, RiskPill } from "@/components/status-pill";
import type { DepartureOptimization, DepartureTimeOption } from "@/lib/types";

function formatHourTick(hour: number) {
  if (hour === 0) {
    return "12AM";
  }

  if (hour === 12) {
    return "12PM";
  }

  if (hour < 12) {
    return `${hour}AM`;
  }

  return `${hour - 12}PM`;
}

function optionColor(label: DepartureTimeOption["label"]) {
  switch (label) {
    case "Low":
      return "#34d399";
    case "Moderate":
      return "#fbbf24";
    case "High":
      return "#fb923c";
    case "Severe":
      return "#f43f5e";
  }
}

function optionTone(label: DepartureTimeOption["label"]) {
  switch (label) {
    case "Low":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "Moderate":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "High":
      return "border-orange-300 bg-orange-50 text-orange-800";
    case "Severe":
      return "border-rose-300 bg-rose-50 text-rose-800";
  }
}

function formatCoverage(option: DepartureTimeOption) {
  const matchedSamples = Math.round(option.forecastCoverageRatio * 100);

  if (matchedSamples >= 100) {
    return "Forecast fully matched";
  }

  return `${matchedSamples}% forecast coverage`;
}

function buildChartPoints(options: DepartureTimeOption[]) {
  return options.map((option) => {
    const x = (option.hour / 23) * 100;
    const y = 100 - option.safetyScore;

    return {
      option,
      x,
      y,
    };
  });
}

export function DepartureTimeOptimizer({
  optimization,
}: {
  optimization: DepartureOptimization;
}) {
  const [focusedOptionId, setFocusedOptionId] = useState<string | null>(null);
  const bestOption = optimization.options.find((option) =>
    optimization.bestOptionIds.includes(option.id),
  );
  const selectedOption = optimization.options.find((option) => option.isSelectedHour);
  const bestOptions = optimization.options.filter((option) =>
    optimization.bestOptionIds.includes(option.id),
  );
  const safestWindow = bestOptions.slice(0, 4);
  const chartPoints = useMemo(
    () => buildChartPoints(optimization.options),
    [optimization.options],
  );
  const safetyPath = chartPoints
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const focusedOption =
    optimization.options.find((option) => option.id === focusedOptionId) ??
    selectedOption ??
    bestOption;
  const legendItems: Array<{ label: DepartureTimeOption["label"]; text: string }> = [
    { label: "Low", text: "Low" },
    { label: "Moderate", text: "Moderate" },
    { label: "High", text: "High" },
    { label: "Severe", text: "Severe" },
  ];

  return (
    <section className="surface-panel p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="eyebrow">
            Departure Optimizer
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            Lowest-risk time to leave
          </h2>
          <p className="text-sm leading-6 text-[var(--color-text-muted)]">{optimization.summary}</p>
        </div>

        <div className="grid min-w-full grid-cols-3 border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-center sm:min-w-[420px] lg:min-w-[460px]">
          {[
            {
              label: "Lowest-risk time",
              value: optimization.isEquallySafe
                ? "All day"
                : bestOption?.departureTimeDisplay ?? "n/a",
            },
            {
              label: "Risk margin",
              value: bestOption ? bestOption.safetyScore.toString() : "n/a",
            },
            {
              label: "Risk",
              value: bestOption ? bestOption.overallScore.toString() : "n/a",
            },
          ].map((item) => (
            <div key={item.label} className="border-l border-[var(--color-border)] px-3 py-3 first:border-l-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 border border-[var(--color-border)] bg-white p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="eyebrow">
              Lower-risk score by local departure hour
            </p>
            <div className="flex flex-wrap gap-2">
              {legendItems.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-2 text-[11px] font-medium text-[var(--color-text-muted)]"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: optionColor(item.label) }}
                  />
                  {item.text}
                </span>
              ))}
            </div>
          </div>

          <div
            className="relative h-[320px] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
            onMouseLeave={() => setFocusedOptionId(null)}
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label="Lower-risk score by departure hour"
              className="absolute bottom-9 left-12 right-4 top-5 overflow-visible"
            >
              {[0, 25, 50, 75, 100].map((value) => {
                const y = 100 - value;

                return (
                  <line
                    key={value}
                    x1="0"
                    x2="100"
                    y1={y}
                    y2={y}
                    stroke={
                      value === 75
                        ? "rgba(52,211,153,0.32)"
                        : value === 50
                          ? "rgba(251,191,36,0.28)"
                          : "rgba(80,96,91,0.14)"
                    }
                    strokeDasharray="2 2"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}

              {[0, 6, 12, 18, 23].map((hour) => (
                <line
                  key={hour}
                  x1={(hour / 23) * 100}
                  x2={(hour / 23) * 100}
                  y1="0"
                  y2="100"
                  stroke="rgba(80,96,91,0.12)"
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {chartPoints.map((point) => {
                const isBest = optimization.bestOptionIds.includes(point.option.id);
                const isFocused = focusedOption?.id === point.option.id;
                const barWidth = 2.15;

                return (
                  <rect
                    key={point.option.id}
                    x={point.x - barWidth / 2}
                    y={point.y}
                    width={barWidth}
                    height={point.option.safetyScore}
                    rx="0.9"
                    fill={optionColor(point.option.label)}
                    opacity={isBest ? 0.78 : isFocused ? 0.66 : 0.34}
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={() => setFocusedOptionId(point.option.id)}
                    onClick={() => setFocusedOptionId(point.option.id)}
                    onFocus={() => setFocusedOptionId(point.option.id)}
                    tabIndex={0}
                  />
                );
              })}

              <polyline
                points={safetyPath}
                fill="none"
                stroke="#176c68"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />

              {chartPoints.map((point) => {
                const isBest = optimization.bestOptionIds.includes(point.option.id);
                const isFocused = focusedOption?.id === point.option.id;

                return (
                  <circle
                    key={`${point.option.id}-dot`}
                    cx={point.x}
                    cy={point.y}
                    r={isBest || isFocused ? 1.9 : 1.15}
                    fill={isBest ? "#176c68" : optionColor(point.option.label)}
                    stroke="#ffffff"
                    strokeWidth="0.65"
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={() => setFocusedOptionId(point.option.id)}
                    onClick={() => setFocusedOptionId(point.option.id)}
                  />
                );
              })}
            </svg>

            <div className="absolute bottom-3 left-12 right-4 flex justify-between text-xs font-semibold text-[var(--color-text-muted)]">
              {[0, 6, 12, 18, 23].map((hour) => (
                <span key={hour}>{formatHourTick(hour)}</span>
              ))}
            </div>
            <div className="absolute left-3 top-5 grid h-[calc(100%-3.5rem)] content-between text-xs text-[var(--color-text-muted)]">
              {[100, 75, 50, 25, 0].map((value) => (
                <span key={value}>{value}</span>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
            Risk margin is 100 minus the modeled route-risk score. A higher margin means
            lower forecast exposure, not guaranteed safe conditions.
          </p>
        </div>

        <div className="grid gap-3">
          <div className="bg-[var(--color-brand-soft)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {focusedOption?.id === selectedOption?.id ? "Selected departure" : "Focused hour"}
              </p>
              {focusedOption ? <RiskPill label={focusedOption.label} /> : null}
            </div>
            {focusedOption ? (
              <>
                <p className="mt-3 text-2xl font-semibold text-[var(--color-text)]">
                  {focusedOption.departureTimeDisplay}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                  Risk margin {focusedOption.safetyScore}/100 • modeled risk{" "}
                  {focusedOption.overallScore}/100
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                  {focusedOption.guidance.headline}
                </p>
                <div className="mt-4 border-t border-[var(--color-border)] px-1 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-faint)]">
                    Forecast confidence
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {formatCoverage(focusedOption)}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          <div className="border border-[var(--color-border)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">Best checked options</p>
              {bestOption ? <RecommendationPill recommendation={bestOption.recommendation} /> : null}
            </div>
            <div className="mt-4 grid gap-2">
              {safestWindow.map((option) => (
                <div
                  key={option.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${optionTone(
                    option.label,
                  )}`}
                >
                  <span className="text-sm font-semibold">{option.departureTimeDisplay}</span>
                  <span className="text-xs uppercase tracking-[0.16em]">
                    margin {option.safetyScore}/100
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
