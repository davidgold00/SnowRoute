"use client";

import { useEffect, useRef, useState } from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RISK_THRESHOLDS } from "@/components/risk-legend";
import { RiskPill } from "@/components/status-pill";
import type { RouteSample } from "@/lib/types";

type ChartPoint = {
  id: string;
  distanceKm: number;
  score: number;
  etaDisplay: string;
  label: RouteSample["label"];
  weatherSummary: string;
  explanation: string;
  gamePlan: string;
};

function TimelineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="max-w-xs border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-surface)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--color-text)]">{point.etaDisplay}</p>
        <RiskPill label={point.label} />
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-muted)]">{point.weatherSummary}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--color-text-faint)]">{point.explanation}</p>
      {point.label !== "Low" ? (
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{point.gamePlan}</p>
      ) : null}
      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
        {point.distanceKm.toFixed(0)} km • risk score {point.score}/100
      </p>
    </div>
  );
}

export function RiskTimeline({
  samples,
  activeSampleId,
}: {
  samples: RouteSample[];
  activeSampleId: string | null;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const chartContainer = chartContainerRef.current;

    if (!chartContainer) {
      return;
    }

    const updateChartSize = () => {
      setChartSize({
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
      });
    };

    updateChartSize();
    const resizeObserver = new ResizeObserver(updateChartSize);
    resizeObserver.observe(chartContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }, [samples.length]);

  if (samples.length === 0) {
    return (
      <section className="surface-panel p-6">
        <div className="flex min-h-[360px] flex-col justify-between gap-8">
          <div>
            <p className="eyebrow">
              Risk Timeline
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
              Timeline ready after analysis
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--color-text-muted)]">
              Analyze a route to see the ETA-synced risk curve across the drive.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Low", "Moderate", "High"].map((label) => (
              <div
                key={label}
                className="border-b border-[var(--color-border)] px-1 py-4 text-sm font-semibold text-[var(--color-text-muted)]"
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const chartData: ChartPoint[] = samples.map((sample) => ({
    id: sample.id,
    distanceKm: sample.distanceKm,
    score: sample.score,
    etaDisplay: sample.etaDisplay,
    label: sample.label,
    weatherSummary: sample.weather.summary,
    explanation: sample.explanationFactors.join(" • ") || "No dominant hazard signal",
    gamePlan: sample.guidance.gamePlan,
  }));
  const activeSample = samples.find((sample) => sample.id === activeSampleId) ?? samples[0];

  return (
    <section className="surface-panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            Risk Timeline
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            How risk changes along the drive
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-muted)]">
            Risk score is measured from 0 to 100 across the distance along the route.
          </p>
        </div>
        {activeSample ? (
          <div className="border-l-[3px] border-[var(--color-brand)] bg-[var(--color-brand-soft)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-text)]">{activeSample.etaDisplay}</span>
            <span className="mx-2 text-[var(--color-text-faint)]">•</span>
            {activeSample.weather.summary}
          </div>
        ) : null}
      </div>

      <div ref={chartContainerRef} className="mt-6 h-[360px]">
        {chartSize.width > 0 && chartSize.height > 0 ? (
          <AreaChart
            width={chartSize.width}
            height={chartSize.height}
            data={chartData}
            margin={{ top: 12, right: 18, left: 16, bottom: 34 }}
          >
            <defs>
              <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#176c68" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#176c68" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#d9ddd6" strokeDasharray="3 3" />
            <XAxis
              dataKey="distanceKm"
              tickFormatter={(value: number) => `${Math.round(value)} km`}
              tick={{ fill: "#6d7a76", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Distance along route",
                position: "insideBottom",
                offset: -20,
                fill: "#50605b",
                fontSize: 12,
              }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#6d7a76", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Risk score",
                angle: -90,
                position: "insideLeft",
                fill: "#50605b",
                fontSize: 12,
              }}
            />
            <ReferenceLine y={25} stroke="rgba(250,204,21,0.25)" strokeDasharray="4 4" />
            <ReferenceLine y={50} stroke="rgba(251,146,60,0.25)" strokeDasharray="4 4" />
            <ReferenceLine y={75} stroke="rgba(244,63,94,0.25)" strokeDasharray="4 4" />
            <Tooltip content={<TimelineTooltip />} cursor={{ stroke: "#176c68", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#176c68"
              strokeWidth={3}
              fill="url(#riskFill)"
              activeDot={{ r: 6, strokeWidth: 2, stroke: "#ffffff", fill: "#176c68" }}
            />
          </AreaChart>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="bg-[var(--color-surface-subtle)] p-4">
          <p className="eyebrow">
            Thresholds
          </p>
          <div className="mt-3 grid gap-2">
            {RISK_THRESHOLDS.map((item) => (
              <div key={item.label} className="text-sm leading-6 text-[var(--color-text-muted)]">
                <span className="font-semibold text-[var(--color-text)]">{item.label}</span>{" "}
                <span>{item.range}:</span> {item.description}
              </div>
            ))}
          </div>
        </div>
        {activeSample ? (
          <div
            className="bg-[var(--color-brand-soft)] p-4"
            aria-live="polite"
          >
            <p className="eyebrow">
              Selected checkpoint
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
              {activeSample.etaDisplay}, {activeSample.distanceKm.toFixed(0)} km:
              risk {activeSample.score}/100 ({activeSample.label}).{" "}
              {activeSample.weather.summary}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
