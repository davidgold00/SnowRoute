import { RiskPill } from "@/components/status-pill";
import type { RouteSample } from "@/lib/types";

function formatValue(value: number | null, suffix: string, digits = 0) {
  if (value === null) {
    return "n/a";
  }

  return `${value.toFixed(digits)}${suffix}`;
}

export function SegmentTable({
  samples,
  activeSampleId,
  onSelectSample,
}: {
  samples: RouteSample[];
  activeSampleId: string | null;
  onSelectSample: (sampleId: string) => void;
}) {
  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Segment Table
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Checkpoint-by-checkpoint risk
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-slate-300">
          Click any row to highlight that checkpoint on the map and timeline.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full divide-y divide-white/8 text-left">
            <thead className="sticky top-0 bg-[#0e1728]/95 backdrop-blur">
              <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                <th className="px-4 py-4 font-medium">ETA</th>
                <th className="px-4 py-4 font-medium">Distance</th>
                <th className="px-4 py-4 font-medium">Conditions</th>
                <th className="px-4 py-4 font-medium">Visibility</th>
                <th className="px-4 py-4 font-medium">Wind</th>
                <th className="px-4 py-4 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {samples.map((sample) => {
                const isActive = activeSampleId === sample.id;

                return (
                  <tr
                    key={sample.id}
                    onClick={() => onSelectSample(sample.id)}
                    className={`cursor-pointer transition ${
                      isActive
                        ? "bg-cyan-400/[0.08]"
                        : "bg-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="text-sm font-medium text-white">{sample.etaDisplay}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {sample.pointTimeZone}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-200">
                      {sample.distanceKm.toFixed(0)} km
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-sm font-medium text-white">
                        {sample.weather.condition}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {sample.explanationFactors[0] ?? "No major hazard signal detected"}
                      </div>
                      {sample.label !== "Low" ? (
                        <div className="mt-3 max-w-md rounded-lg border border-white/10 bg-white/[0.025] p-3">
                          <p className="text-xs font-semibold text-slate-200">
                            {sample.guidance.headline}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {sample.guidance.gamePlan}
                          </p>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-200">
                      {formatValue(sample.weather.visibilityKm, " km", 1)}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-200">
                      {formatValue(sample.weather.windGustKph, " kph")}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">{sample.score}</span>
                        <RiskPill label={sample.label} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
