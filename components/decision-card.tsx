import { RiskPill } from "@/components/status-pill";
import type { TripDecision } from "@/lib/types";

function decisionTone(decision: TripDecision["decision"]) {
  switch (decision) {
    case "GO":
      return "border-emerald-200/30 bg-emerald-300/[0.11] text-emerald-50";
    case "CAUTION":
      return "border-amber-200/30 bg-amber-300/[0.11] text-amber-50";
    case "DELAY":
    case "HOLD":
      return "border-orange-200/30 bg-orange-300/[0.12] text-orange-50";
    case "AVOID":
      return "border-rose-200/30 bg-rose-400/[0.13] text-rose-50";
  }
}

function confidenceTone(confidence: TripDecision["confidence"]) {
  return confidence === "High"
    ? "text-emerald-100"
    : confidence === "Medium"
      ? "text-amber-100"
      : "text-rose-100";
}

export function DecisionCard({ decision }: { decision: TripDecision }) {
  return (
    <section id="decision" tabIndex={-1} className="glass-panel scroll-mt-24 rounded-2xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70 sm:p-6 lg:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">Drive decision</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] ${decisionTone(
                decision.decision,
              )}`}
            >
              {decision.decision}
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {decision.decisionLabel}
            </h2>
          </div>
          <p className="mt-4 text-base leading-7 text-slate-200">{decision.decisionSummary}</p>
        </div>

        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] text-center lg:min-w-[390px]">
          <div className="px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Overall
            </p>
            <div className="mt-2 flex justify-center"><RiskPill label={decision.overallRisk} /></div>
          </div>
          <div className="border-l border-white/8 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Worst
            </p>
            <div className="mt-2 flex justify-center"><RiskPill label={decision.worstSegmentRisk} /></div>
          </div>
          <div className="border-l border-white/8 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Confidence
            </p>
            <p className={`mt-2 text-sm font-semibold ${confidenceTone(decision.confidence)}`}>
              {decision.confidence}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <div className="rounded-xl border border-white/10 bg-black/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            Why this recommendation
          </p>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-200">
            {decision.explanationBullets.length > 0 ? (
              decision.explanationBullets.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <span aria-hidden="true" className="text-cyan-200">•</span>
                  <span>{reason}</span>
                </li>
              ))
            ) : (
              <li>Forecast data did not identify a major driving-hazard signal.</li>
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            Highest-risk point
          </p>
          <p className="mt-3 text-sm font-semibold text-white">
            {decision.worstSegmentLocationLabel}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            Expected around {decision.worstSegmentArrivalTime}
          </p>
          {decision.mainHazards.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {decision.mainHazards.slice(0, 3).map((hazard) => (
                <span
                  key={hazard}
                  className="rounded-full border border-cyan-100/15 bg-cyan-300/[0.07] px-2.5 py-1 text-xs text-cyan-50"
                >
                  {hazard}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {decision.confidence !== "High" ? (
        <p className="mt-4 text-xs leading-5 text-amber-100/90">
          {decision.confidenceReasons[0]} Treat this as planning guidance and check official
          sources before leaving.
        </p>
      ) : null}
    </section>
  );
}
