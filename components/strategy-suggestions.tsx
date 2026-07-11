import { RecommendationPill, RiskPill } from "@/components/status-pill";
import { buildWeatherHoldStrategies } from "@/lib/strategy";
import type { RouteAnalysisResponse } from "@/lib/types";

function formatDistance(distanceKm: number) {
  return `${distanceKm.toFixed(0)} km`;
}

function getIndicatorTone(score: number) {
  if (score >= 75) {
    return "border-rose-200/25 bg-rose-300/10 text-rose-50";
  }

  if (score >= 55) {
    return "border-amber-200/25 bg-amber-300/10 text-amber-50";
  }

  return "border-cyan-200/25 bg-cyan-300/10 text-cyan-50";
}

export function StrategySuggestions({
  analysis,
}: {
  analysis: RouteAnalysisResponse;
}) {
  const strategies = buildWeatherHoldStrategies(analysis);
  const highestIndicator = Math.max(
    ...strategies.map((strategy) => strategy.indicatorScore),
    0,
  );

  return (
    <section className="space-y-6" aria-label="Weather hold strategy suggestions">
      <header className="glass-panel rounded-2xl p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Step 3 · Strategy briefing</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Weather-hold plan for this drive
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              A formal, forecast-based briefing that identifies decision points before
              sustained high-risk conditions. It is designed to help you choose a conservative
              pause before conditions deteriorate—not to identify verified facilities or
              replace official road advisories.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RiskPill label={analysis.summary.overallLabel} />
            <RecommendationPill recommendation={analysis.summary.recommendation} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="metric-card rounded-xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
              Hold points
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{strategies.length}</p>
            <p className="mt-1 text-sm text-slate-300">Before sustained risk windows</p>
          </div>
          <div className="metric-card rounded-xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
              Highest hold indicator
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{highestIndicator}/100</p>
            <p className="mt-1 text-sm text-slate-300">Forecast-derived indicator score</p>
          </div>
          <div className="metric-card rounded-xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
              Forecast quality
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {analysis.summary.dataQuality.unmatchedSamples === 0 ? "Complete" : "Review"}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {analysis.summary.dataQuality.unmatchedSamples === 0
                ? "All sampled points matched"
                : `${analysis.summary.dataQuality.unmatchedSamples} point(s) unmatched`}
            </p>
          </div>
        </div>
      </header>

      {strategies.length > 0 ? (
        <div className="space-y-4">
          {strategies.map((strategy, index) => (
            <article
              key={strategy.id}
              className="glass-panel rounded-2xl p-5 sm:p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                    Decision point {index + 1}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    Prepare to hold before {formatDistance(strategy.hazardStart.distanceKm)}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    Plan the stop at approximately {formatDistance(strategy.holdPoint.distanceKm)}
                    {" "}into the route, before the forecast high-risk stretch beginning around{" "}
                    {strategy.hazardStart.etaDisplay}.
                  </p>
                </div>
                <div
                  className={`rounded-xl border px-4 py-3 text-right ${getIndicatorTone(
                    strategy.indicatorScore,
                  )}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
                    {strategy.indicatorLabel} hold indicator
                  </p>
                  <p className="mt-1 text-3xl font-semibold leading-none">
                    {strategy.indicatorScore}/100
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                    Operating instruction
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-100">{strategy.action}</p>
                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    A hold point is route-relative only. Confirm an open, legal place to
                    stop with navigation and local road information before departure.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                      Forecast evidence
                    </p>
                    <RiskPill label={strategy.window.label} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">
                    Peak checkpoint: {strategy.worstSample.score}/100 at{" "}
                    {formatDistance(strategy.worstSample.distanceKm)}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    {strategy.evidence.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="text-cyan-200">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="glass-panel rounded-2xl p-6">
          <p className="eyebrow">No scheduled weather hold</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            No sustained high-risk forecast window was detected.
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Keep conservative driving margins and recheck conditions immediately before leaving.
            Road treatment, crashes, and local warnings can change more quickly than the
            hourly forecast used in this analysis.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-cyan-100/14 bg-cyan-300/[0.055] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
          Method and research basis
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <p className="text-sm leading-6 text-slate-200">
            SnowRoute samples the route by estimated arrival time, matches each point to
            an hourly forecast, and marks sustained checkpoints scoring 50+ as high risk.
            The hold-indicator score combines the route risk score with snow, visibility,
            wind, and near-freezing precipitation signals. It is a conservative planning
            aid, not a calibrated probability of a crash, closure, required stop, or
            facility availability.
          </p>
          <p className="text-sm leading-6 text-slate-200">
            The operational guidance follows National Weather Service advice to avoid
            driving in low visibility and wait for improvement, plus NHTSA guidance to
            adjust departure around the worst weather and plan longer-trip stops. Always
            check active local warnings and road conditions before you leave.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-cyan-50">
          <a
            href="https://www.weather.gov/safety/winter-during"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-cyan-100/40 underline-offset-4 transition hover:text-white"
          >
            National Weather Service: winter storm driving safety
          </a>
          <a
            href="https://www.nhtsa.gov/winter-driving-tips"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-cyan-100/40 underline-offset-4 transition hover:text-white"
          >
            NHTSA: winter driving tips
          </a>
        </div>
      </section>
    </section>
  );
}
