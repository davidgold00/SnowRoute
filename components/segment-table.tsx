import { RiskPill } from "@/components/status-pill";
import type { RouteSample } from "@/lib/types";

function formatValue(value: number | null, suffix: string, digits = 0) {
  if (value === null) {
    return "n/a";
  }

  return `${value.toFixed(digits)}${suffix}`;
}

function formatForecastMatch(sample: RouteSample) {
  if (sample.weather.source === "exact") {
    return "Forecast matched to ETA";
  }

  if (sample.weather.source === "nearest") {
    return `Nearest forecast hour${sample.weather.matchDistanceMinutes ? ` (${sample.weather.matchDistanceMinutes} min from ETA)` : ""}`;
  }

  return "Forecast unavailable for this checkpoint";
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
    <section className="surface-panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            Segment Table
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            Checkpoint-by-checkpoint risk
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[var(--color-text-muted)]">
          Use “Show on map” to highlight a checkpoint on the map and timeline.
        </p>
      </div>

      <div className="mt-6 overflow-hidden border border-[var(--color-border)]">
        <div className="segment-scroll hidden max-h-[520px] overflow-auto md:block">
          <table className="min-w-full divide-y divide-[var(--color-border)] text-left">
            <caption className="sr-only">
              Forecast conditions and modeled risk at each route checkpoint
            </caption>
            <thead className="sticky top-0 bg-[var(--color-surface-subtle)]">
              <tr className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-faint)]">
                <th scope="col" className="px-4 py-4 font-medium">ETA</th>
                <th scope="col" className="px-4 py-4 font-medium">Distance</th>
                <th scope="col" className="px-4 py-4 font-medium">Conditions</th>
                <th scope="col" className="px-4 py-4 font-medium">Visibility</th>
                <th scope="col" className="px-4 py-4 font-medium">Wind</th>
                <th scope="col" className="px-4 py-4 font-medium">Risk</th>
                <th scope="col" className="px-4 py-4 font-medium">
                  <span className="sr-only">Map action</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {samples.map((sample) => {
                const isActive = activeSampleId === sample.id;

                return (
                  <tr
                    key={sample.id}
                    className={`transition ${
                      isActive
                        ? "bg-[var(--color-brand-soft)] shadow-[inset_3px_0_0_var(--color-brand)]"
                        : "bg-transparent"
                    }`}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="text-sm font-medium text-[var(--color-text)]">{sample.etaDisplay}</div>
                      <div className="mt-1 text-xs text-[var(--color-text-faint)]">
                        {sample.pointTimeZone}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-[var(--color-text-muted)]">
                      {sample.distanceKm.toFixed(0)} km
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-sm font-medium text-[var(--color-text)]">
                        {sample.weather.condition}
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {sample.explanationFactors[0] ?? "No major hazard signal detected"}
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-text-faint)]">
                        {formatForecastMatch(sample)}
                      </div>
                      {sample.label !== "Low" ? (
                        <div className="mt-3 max-w-md border-l-[3px] border-[var(--color-risk-moderate)] bg-[var(--color-surface-subtle)] p-3">
                          <p className="text-xs font-semibold text-[var(--color-text)]">
                            {sample.guidance.headline}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                            {sample.guidance.gamePlan}
                          </p>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-[var(--color-text-muted)]">
                      {formatValue(sample.weather.visibilityKm, " km", 1)}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-[var(--color-text-muted)]">
                      {formatValue(sample.weather.windGustKph, " kph")}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[var(--color-text)]">
                          {sample.score}/100
                        </span>
                        <RiskPill label={sample.label} />
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <button
                        type="button"
                        aria-pressed={isActive}
                        aria-label={
                          isActive
                            ? `Checkpoint at ${sample.etaDisplay} is selected on the map`
                            : `Show checkpoint at ${sample.etaDisplay} on the map`
                        }
                        onClick={() => onSelectSample(sample.id)}
                        className={`min-h-11 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 ${
                          isActive
                            ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                            : "border-[var(--color-border-strong)] bg-white text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]"
                        }`}
                      >
                        {isActive ? "Selected" : "Show on map"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="segment-scroll grid max-h-[620px] gap-3 overflow-auto p-3 md:hidden">
          {samples.map((sample) => {
            const isActive = activeSampleId === sample.id;

            return (
              <button
                key={sample.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectSample(sample.id)}
                className={`rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 ${
                  isActive
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]"
                    : "border-[var(--color-border)] bg-white hover:bg-[var(--color-surface-subtle)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{sample.etaDisplay}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {sample.distanceKm.toFixed(0)} km • {sample.pointTimeZone}
                    </p>
                  </div>
                  <RiskPill label={sample.label} />
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--color-text)]">
                  Risk {sample.score}/100
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                  {sample.weather.condition} •{" "}
                  {sample.explanationFactors[0] ?? "No major hazard signal detected"}
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-faint)]">
                  {formatForecastMatch(sample)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
