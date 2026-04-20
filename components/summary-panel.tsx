import { RecommendationPill, RiskPill } from "@/components/status-pill";
import type { RouteAnalysisResponse } from "@/lib/types";

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function buildQualityNotes(analysis: RouteAnalysisResponse) {
  const notes: string[] = [];
  const quality = analysis.summary.dataQuality;

  if (quality.unmatchedSamples > 0) {
    notes.push(`${quality.unmatchedSamples} sampled points had no hourly forecast within 2 hours.`);
  }

  if (quality.fallbackMatches > 0) {
    notes.push(`${quality.fallbackMatches} sampled points used the nearest forecast hour.`);
  }

  if (quality.missingSnowfallSamples > 0) {
    notes.push(`${quality.missingSnowfallSamples} sampled points were missing snowfall values.`);
  }

  if (quality.missingVisibilitySamples > 0) {
    notes.push(`${quality.missingVisibilitySamples} sampled points were missing visibility values.`);
  }

  return notes.length > 0
    ? notes
    : ["Forecast matching was complete across the sampled route checkpoints."];
}

export function SummaryPanel({
  analysis,
}: {
  analysis: RouteAnalysisResponse | null;
}) {
  if (!analysis) {
    return (
      <aside className="glass-panel flex min-h-[420px] flex-col justify-between rounded-[28px] p-6 lg:p-7">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Trip Summary
          </p>
          <h2 className="display-type text-3xl text-white">Ready when the route is</h2>
          <p className="max-w-md text-sm leading-6 text-slate-300">
            Once you analyze a drive, SnowRoute will highlight the worst segment, the
            hazard windows worth watching, and the clearest travel recommendation.
          </p>
        </div>

        <div className="grid gap-3">
          {[
            "Overall trip score blended from route average and worst segment.",
            "Hazard windows merged across brief low-risk gaps to avoid noisy alerts.",
            "Transparent factor explanations for snow, ice, visibility, wind, and night driving.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-4 text-sm text-slate-300"
            >
              {item}
            </div>
          ))}
        </div>
      </aside>
    );
  }

  const worstSegment = analysis.route.segments.find(
    (segment) => segment.id === analysis.summary.worstSegmentId,
  );
  const qualityNotes = buildQualityNotes(analysis);

  return (
    <aside className="glass-panel rounded-[28px] p-6 lg:p-7">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
          Trip Summary
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="display-type text-4xl leading-none text-white">
              {analysis.summary.overallScore}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              overall winter driving risk across the sampled route
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <RiskPill label={analysis.summary.overallLabel} />
            <RecommendationPill recommendation={analysis.summary.recommendation} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Distance</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {analysis.route.distanceKm.toFixed(0)} km
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Duration</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatDuration(analysis.route.durationMinutes)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Average sample</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {analysis.summary.averageScore}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Samples</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {analysis.samples.length}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Worst segment</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-2xl font-semibold text-white">{analysis.summary.maxScore}</p>
            {worstSegment ? <RiskPill label={worstSegment.label} /> : null}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {["OpenRouteService routing", "Open-Meteo forecast", "ETA-matched scoring"].map(
          (item) => (
            <span
              key={item}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-slate-300"
            >
              {item}
            </span>
          ),
        )}
      </div>
      <div className="mt-6 rounded-3xl border border-white/10 bg-[linear-gradient(160deg,rgba(154,211,255,0.14),rgba(255,255,255,0.03))] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
          Recommendation
        </p>
        <p className="mt-3 text-lg font-semibold text-white">
          {analysis.summary.recommendation}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-200">
          {analysis.summary.recommendation === "Safe"
            ? "Forecast conditions stay mostly manageable along the route with no sustained high-risk windows."
            : analysis.summary.recommendation === "Use caution"
              ? "Some portions of the drive show meaningful winter hazards, but severe windows are not dominant."
              : analysis.summary.recommendation === "Delay recommended"
                ? "SnowRoute found high-risk or brief severe conditions that make a schedule shift worth considering."
                : "Severe hazards persist for a meaningful stretch of the trip, making travel avoidance the safer call."}
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Hazard windows</p>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {analysis.hazardWindows.length} flagged
          </p>
        </div>
        {analysis.hazardWindows.length > 0 ? (
          <div className="space-y-3">
            {analysis.hazardWindows.map((window) => (
              <div
                key={window.id}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {window.startEtaDisplay} to {window.endEtaDisplay}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      Max score {window.maxScore}
                    </p>
                  </div>
                  <RiskPill label={window.label} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {window.dominantFactors.join(" • ")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-300">
            No sustained high-risk windows were detected across the analyzed route.
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-sm font-semibold text-white">Forecast quality notes</p>
        <div className="space-y-2">
          {qualityNotes.map((note) => (
            <div
              key={note}
              className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-300"
            >
              {note}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
