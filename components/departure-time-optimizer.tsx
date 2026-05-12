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
      return "border-emerald-300/35 bg-emerald-400/12 text-emerald-100";
    case "Moderate":
      return "border-amber-300/35 bg-amber-400/12 text-amber-100";
    case "High":
      return "border-orange-300/35 bg-orange-400/12 text-orange-100";
    case "Severe":
      return "border-rose-300/35 bg-rose-500/14 text-rose-100";
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
  return options.map((option, index) => {
    const x = options.length <= 1 ? 50 : (index / (options.length - 1)) * 100;
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
    <section className="glass-panel rounded-2xl p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Departure Optimizer
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Safest time to leave
          </h2>
          <p className="text-sm leading-6 text-slate-300">{optimization.summary}</p>
        </div>

        <div className="grid min-w-full grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] text-center sm:min-w-[420px] lg:min-w-[460px]">
          {[
            {
              label: "Best time",
              value: optimization.isEquallySafe
                ? "All day"
                : bestOption?.departureTimeDisplay ?? "n/a",
            },
            {
              label: "Safety",
              value: bestOption ? bestOption.safetyScore.toString() : "n/a",
            },
            {
              label: "Risk",
              value: bestOption ? bestOption.overallScore.toString() : "n/a",
            },
          ].map((item) => (
            <div key={item.label} className="border-l border-white/8 px-3 py-3 first:border-l-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-xl border border-white/10 bg-[#0b1422]/70 p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Safety score by local departure hour
            </p>
            <div className="flex flex-wrap gap-2">
              {legendItems.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-300"
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
            className="relative h-[320px] overflow-hidden rounded-lg border border-white/8 bg-[#08111f]"
            onMouseLeave={() => setFocusedOptionId(null)}
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label="Safety score by departure hour"
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
                          : "rgba(255,255,255,0.09)"
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
                  stroke="rgba(255,255,255,0.07)"
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
                stroke="#d8fff1"
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
                    fill={isBest ? "#f8fafc" : optionColor(point.option.label)}
                    stroke="#08111f"
                    strokeWidth="0.65"
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={() => setFocusedOptionId(point.option.id)}
                    onClick={() => setFocusedOptionId(point.option.id)}
                  />
                );
              })}
            </svg>

            <div className="absolute bottom-3 left-12 right-4 flex justify-between text-xs font-semibold text-slate-300">
              {[0, 6, 12, 18, 23].map((hour) => (
                <span key={hour}>{formatHourTick(hour)}</span>
              ))}
            </div>
            <div className="absolute left-3 top-5 grid h-[calc(100%-3.5rem)] content-between text-xs text-slate-300">
              {[100, 75, 50, 25, 0].map((value) => (
                <span key={value}>{value}</span>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-300">
            Safety is scored from 0 to 100; higher is safer. Risk uses the inverse
            route risk score where higher means more dangerous conditions.
          </p>
        </div>

        <div className="grid gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                {focusedOption?.id === selectedOption?.id ? "Selected departure" : "Focused hour"}
              </p>
              {focusedOption ? <RiskPill label={focusedOption.label} /> : null}
            </div>
            {focusedOption ? (
              <>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {focusedOption.departureTimeDisplay}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Safety {focusedOption.safetyScore}/100 • risk{" "}
                  {focusedOption.overallScore}/100
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {focusedOption.guidance.headline}
                </p>
                <div className="mt-4 rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Forecast confidence
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {formatCoverage(focusedOption)}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Best checked options</p>
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
                    safety {option.safetyScore}/100
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
