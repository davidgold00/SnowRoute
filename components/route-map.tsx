"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";

import type { RouteAnalysisResponse } from "@/lib/types";

function riskColor(label: string) {
  switch (label) {
    case "Low":
      return "#34d399";
    case "Moderate":
      return "#fbbf24";
    case "High":
      return "#fb923c";
    case "Severe":
      return "#f43f5e";
    default:
      return "#95d5ff";
  }
}

function FitBounds({ analysis }: { analysis: RouteAnalysisResponse }) {
  const map = useMap();

  useEffect(() => {
    const bounds = analysis.route.coordinates.map((coordinate) => [
      coordinate.lat,
      coordinate.lon,
    ]) as [number, number][];

    if (bounds.length > 0) {
      map.fitBounds(bounds, {
        padding: [36, 36],
      });
    }
  }, [analysis, map]);

  return null;
}

export default function RouteMap({
  analysis,
  activeSampleId,
  onSelectSample,
}: {
  analysis: RouteAnalysisResponse | null;
  activeSampleId: string | null;
  onSelectSample: (sampleId: string) => void;
}) {
  if (!analysis) {
    return (
      <div className="map-shell flex min-h-[520px] items-center justify-center rounded-2xl border border-white/10 bg-[#0b1322]/80 p-10 text-center">
        <div className="max-w-md space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
            Route Map
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Weather-aware route risk, once you hit analyze
          </h2>
          <p className="text-sm leading-6 text-slate-300">
            SnowRoute will render the route geometry, color each segment by risk, and
            expose clickable checkpoints with ETA, conditions, and the drivers behind the score.
          </p>
        </div>
      </div>
    );
  }

  const routePath = analysis.route.coordinates.map((coordinate) => [
    coordinate.lat,
    coordinate.lon,
  ]) as [number, number][];

  return (
    <div className="map-shell overflow-hidden rounded-2xl border border-white/10">
      <MapContainer
        center={routePath[0]}
        zoom={8}
        scrollWheelZoom
        className="h-[520px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds analysis={analysis} />
        <Polyline positions={routePath} pathOptions={{ color: "#18304d", weight: 10 }} />
        {analysis.route.segments.map((segment) => (
          <Polyline
            key={segment.id}
            positions={segment.coordinates.map((coordinate) => [
              coordinate.lat,
              coordinate.lon,
            ])}
            pathOptions={{
              color: riskColor(segment.label),
              weight: 7,
              opacity: 0.95,
            }}
          />
        ))}
        {analysis.samples.map((sample) => {
          const isActive = activeSampleId === sample.id;

          return (
            <CircleMarker
              key={sample.id}
              center={[sample.coordinate.lat, sample.coordinate.lon]}
              radius={isActive ? 8 : 5}
              pathOptions={{
                color: "#0b1322",
                weight: 2,
                fillColor: riskColor(sample.label),
                fillOpacity: 1,
              }}
              eventHandlers={{
                click: () => onSelectSample(sample.id),
              }}
            >
              <Popup>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">{sample.etaDisplay}</p>
                  <p className="text-sm text-slate-700">{sample.weather.summary}</p>
                  <p className="text-xs text-slate-500">
                    Risk {sample.score} • {sample.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    {sample.explanationFactors.join(" • ") || "No major hazard signal detected"}
                  </p>
                  {sample.label !== "Low" ? (
                    <>
                      <p className="text-xs font-semibold text-slate-800">
                        {sample.guidance.impact}
                      </p>
                      <p className="text-xs text-slate-600">{sample.guidance.gamePlan}</p>
                    </>
                  ) : null}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
