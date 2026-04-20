"use client";

import dynamic from "next/dynamic";
import { startTransition, useState } from "react";

import { RouteForm, type EditableStop } from "@/components/route-form";
import { SegmentTable } from "@/components/segment-table";
import { SummaryPanel } from "@/components/summary-panel";
import type { LocationSuggestion, RouteAnalysisResponse } from "@/lib/types";

const RouteMap = dynamic(() => import("@/components/route-map"), {
  ssr: false,
  loading: () => (
    <div className="map-shell flex min-h-[520px] items-center justify-center rounded-[30px] border border-white/10 bg-[#0b1322]/80">
      <p className="text-sm text-slate-300">Loading route canvas…</p>
    </div>
  ),
});

const RiskTimeline = dynamic(
  () => import("@/components/risk-timeline").then((module) => module.RiskTimeline),
  {
    ssr: false,
    loading: () => (
      <div className="glass-panel flex min-h-[468px] items-center justify-center rounded-[28px] p-6">
        <p className="text-sm text-slate-300">Loading risk timeline…</p>
      </div>
    ),
  },
);

function createStop(id: string): EditableStop {
  return {
    id,
    query: "",
    selected: null,
  };
}

function createWaypoint() {
  return createStop(`waypoint-${Math.random().toString(36).slice(2, 9)}`);
}

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultDepartureTime() {
  const date = new Date();
  date.setMinutes(Math.ceil(date.getMinutes() / 30) * 30 || 30, 0, 0);

  if (date.getMinutes() === 0) {
    date.setHours(date.getHours() + 1);
  }

  return formatLocalDateTime(date);
}

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return "SnowRoute could not analyze that route.";
}

export default function Home() {
  const [origin, setOrigin] = useState<EditableStop>(() => createStop("origin"));
  const [destination, setDestination] = useState<EditableStop>(() =>
    createStop("destination"),
  );
  const [waypoints, setWaypoints] = useState<EditableStop[]>([]);
  const [departureTimeLocal, setDepartureTimeLocal] = useState(() =>
    getDefaultDepartureTime(),
  );
  const [analysis, setAnalysis] = useState<RouteAnalysisResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  function handleStopChange(
    setter: React.Dispatch<React.SetStateAction<EditableStop>>,
    value: string,
  ) {
    setter((currentStop) => ({
      ...currentStop,
      query: value,
      selected: currentStop.selected?.label === value ? currentStop.selected : null,
    }));
  }

  function handleStopSelect(
    setter: React.Dispatch<React.SetStateAction<EditableStop>>,
    suggestion: LocationSuggestion,
  ) {
    setter((currentStop) => ({
      ...currentStop,
      query: suggestion.label,
      selected: suggestion,
    }));
  }

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const hasIncompleteWaypoint = waypoints.some(
      (waypoint) => waypoint.query.trim().length > 0 && !waypoint.selected,
    );

    if (!origin.selected || !destination.selected || !departureTimeLocal || hasIncompleteWaypoint) {
      setAnalysisError(
        "Select autocomplete suggestions for each stop and choose a departure time before analyzing.",
      );
      return;
    }

    const departureDate = new Date(departureTimeLocal);

    if (Number.isNaN(departureDate.getTime())) {
      setAnalysisError("Departure time is not valid yet. Choose a new date and time.");
      return;
    }

    setIsSubmitting(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: origin.selected,
          destination: destination.selected,
          waypoints: waypoints.flatMap((waypoint) =>
            waypoint.selected ? [waypoint.selected] : [],
          ),
          departureTimeUtc: departureDate.toISOString(),
          clientTimeZone,
        }),
      });

      const payload = (await response.json()) as RouteAnalysisResponse | { message: string };

      if (!response.ok) {
        throw new Error(getErrorMessage(payload));
      }

      const nextAnalysis = payload as RouteAnalysisResponse;
      const highestRiskSample = nextAnalysis.samples.reduce(
        (current, sample) => (sample.score > current.score ? sample : current),
        nextAnalysis.samples[0],
      );

      startTransition(() => {
        setAnalysis(nextAnalysis);
        setActiveSampleId(highestRiskSample?.id ?? null);
      });
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "SnowRoute could not analyze that route right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen pb-14">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-[32px] border border-white/10 bg-white/[0.025] px-6 py-7 shadow-[0_24px_80px_rgba(3,9,20,0.35)] lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                SnowRoute
              </div>
              <div className="space-y-4">
                <h1 className="display-type max-w-4xl text-5xl leading-[0.95] text-white sm:text-6xl">
                  Intelligent winter driving risk across the full route, not just the endpoints.
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                  Route geometry, ETA-aware weather matching, and transparent winter hazard
                  scoring combine into a map-first analytics workflow built for real travel
                  decisions.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                {
                  title: "Space + time aware",
                  body: "Forecasts are matched to each sampled checkpoint at the moment you are expected to reach it.",
                },
                {
                  title: "Transparent scoring",
                  body: "Snow, ice proxy, visibility, wind, hazardous codes, and night driving each contribute openly.",
                },
                {
                  title: "Actionable output",
                  body: "Map segments, hazard windows, recommendation logic, and a route table stay synced off one payload.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {analysisError ? (
          <div className="mt-6 rounded-3xl border border-rose-300/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            {analysisError}
          </div>
        ) : null}

        <main className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="space-y-6">
            <RouteForm
              origin={origin}
              destination={destination}
              waypoints={waypoints}
              departureTimeLocal={departureTimeLocal}
              timeZone={clientTimeZone}
              isSubmitting={isSubmitting}
              onOriginChange={(value) => handleStopChange(setOrigin, value)}
              onOriginSelect={(suggestion) => handleStopSelect(setOrigin, suggestion)}
              onDestinationChange={(value) => handleStopChange(setDestination, value)}
              onDestinationSelect={(suggestion) => handleStopSelect(setDestination, suggestion)}
              onWaypointChange={(id, value) => {
                setWaypoints((currentWaypoints) =>
                  currentWaypoints.map((waypoint) =>
                    waypoint.id === id
                      ? {
                          ...waypoint,
                          query: value,
                          selected:
                            waypoint.selected?.label === value ? waypoint.selected : null,
                        }
                      : waypoint,
                  ),
                );
              }}
              onWaypointSelect={(id, suggestion) => {
                setWaypoints((currentWaypoints) =>
                  currentWaypoints.map((waypoint) =>
                    waypoint.id === id
                      ? {
                          ...waypoint,
                          query: suggestion.label,
                          selected: suggestion,
                        }
                      : waypoint,
                  ),
                );
              }}
              onWaypointAdd={() => {
                setWaypoints((currentWaypoints) => [...currentWaypoints, createWaypoint()]);
              }}
              onWaypointRemove={(id) => {
                setWaypoints((currentWaypoints) =>
                  currentWaypoints.filter((waypoint) => waypoint.id !== id),
                );
              }}
              onDepartureTimeChange={setDepartureTimeLocal}
              onSubmit={handleAnalyze}
            />

            <RouteMap
              analysis={analysis}
              activeSampleId={activeSampleId}
              onSelectSample={setActiveSampleId}
            />
          </section>

          <SummaryPanel analysis={analysis} />
        </main>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <SegmentTable
            samples={analysis?.samples ?? []}
            activeSampleId={activeSampleId}
            onSelectSample={setActiveSampleId}
          />
          <RiskTimeline
            samples={analysis?.samples ?? []}
            activeSampleId={activeSampleId}
          />
        </section>
      </div>
    </div>
  );
}
