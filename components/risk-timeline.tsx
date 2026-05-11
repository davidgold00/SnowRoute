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
    <div className="max-w-xs rounded-xl border border-white/12 bg-[#0f1a2e]/95 p-4 shadow-[0_18px_60px_rgba(4,10,21,0.5)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{point.etaDisplay}</p>
        <RiskPill label={point.label} />
      </div>
      <p className="mt-3 text-sm text-slate-200">{point.weatherSummary}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{point.explanation}</p>
      {point.label !== "Low" ? (
        <p className="mt-2 text-xs leading-5 text-slate-300">{point.gamePlan}</p>
      ) : null}
      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
        {point.distanceKm.toFixed(0)} km • score {point.score}
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
      <section className="glass-panel rounded-2xl p-6">
        <div className="flex min-h-[360px] flex-col justify-between gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
              Risk Timeline
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Timeline ready after analysis
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
              Analyze a route to see the ETA-synced risk curve across the drive.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Low", "Moderate", "High"].map((label) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-4 text-sm font-semibold text-slate-300"
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
    <section className="glass-panel rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Risk Timeline
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            How risk changes along the drive
          </h2>
        </div>
        {activeSample ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-300">
            <span className="font-semibold text-white">{activeSample.etaDisplay}</span>
            <span className="mx-2 text-slate-500">•</span>
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
            margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#95d5ff" stopOpacity={0.48} />
                <stop offset="100%" stopColor="#95d5ff" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis
              dataKey="distanceKm"
              tickFormatter={(value: number) => `${Math.round(value)} km`}
              tick={{ fill: "#9fb5d1", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#9fb5d1", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={25} stroke="rgba(250,204,21,0.25)" strokeDasharray="4 4" />
            <ReferenceLine y={50} stroke="rgba(251,146,60,0.25)" strokeDasharray="4 4" />
            <ReferenceLine y={75} stroke="rgba(244,63,94,0.25)" strokeDasharray="4 4" />
            <Tooltip content={<TimelineTooltip />} cursor={{ stroke: "#95d5ff", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#95d5ff"
              strokeWidth={3}
              fill="url(#riskFill)"
              activeDot={{ r: 6, strokeWidth: 0, fill: "#f8fafc" }}
            />
          </AreaChart>
        ) : null}
      </div>
    </section>
  );
}
