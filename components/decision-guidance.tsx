import { RiskPill } from "@/components/status-pill";
import type { TripDecision } from "@/lib/types";

export function SaferDepartureCard({
  decision,
  onUseDeparture,
}: {
  decision: TripDecision;
  onUseDeparture: (departureTimeUtc: string) => void;
}) {
  const saferWindow = decision.saferDepartureWindows[0];

  if (!saferWindow) {
    return null;
  }

  return (
    <section id="departure-options" className="scroll-mt-24 rounded-2xl border border-cyan-100/18 bg-[linear-gradient(135deg,rgba(139,232,199,0.15),rgba(125,211,252,0.08))] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow text-cyan-100/80">Better time to leave</p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            A lower-risk departure appears available around {saferWindow.departureTime}.
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">{saferWindow.summary}</p>
          {saferWindow.improvementComparedToSelected ? (
            <p className="mt-2 text-xs leading-5 text-cyan-50/85">
              {saferWindow.improvementComparedToSelected}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <RiskPill label={saferWindow.overallRisk} />
          <button
            type="button"
            onClick={() => onUseDeparture(saferWindow.departureTimeUtc)}
            className="min-h-11 rounded-xl bg-[linear-gradient(135deg,#b7f0ff,#5bd0f2_52%,#8be8c7)] px-4 text-sm font-bold text-slate-950 shadow-[0_10px_28px_rgba(91,208,242,0.18)] transition hover:brightness-105"
          >
            Use this time
          </button>
        </div>
      </div>
    </section>
  );
}

export function DangerWindows({ decision }: { decision: TripDecision }) {
  if (decision.dangerWindows.length === 0) {
    return null;
  }

  return (
    <section id="danger-windows" className="scroll-mt-24 space-y-4">
      <div>
        <p className="eyebrow">Danger windows</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          Where driving conditions are expected to worsen
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          These are route-relative forecast windows, matched to when you are expected to
          reach each stretch—not live closure notices.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {decision.dangerWindows.slice(0, 3).map((window) => (
          <article key={window.id} className="glass-panel rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{window.approximateLocationLabel}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {window.startTime} to {window.endTime}
                </p>
              </div>
              <RiskPill label={window.maxRisk} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-200">{window.summary}</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Why this matters
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {window.hazardTypes.join(" • ")}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HoldGuidance({ decision }: { decision: TripDecision }) {
  const hold = decision.holdRecommendation;

  if (!hold?.shouldHold) {
    return null;
  }

  return (
    <section id="hold-guidance" className="scroll-mt-24 rounded-2xl border border-orange-200/20 bg-orange-300/[0.075] p-5 sm:p-6">
      <p className="eyebrow text-orange-100/80">Where to stop if conditions worsen</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
        Hold before {hold.holdBeforeLocationLabel}
      </h3>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100">{hold.reason}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Reach hold point</p>
          <p className="mt-1 text-sm font-semibold text-white">{hold.estimatedArrivalTime}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Danger begins</p>
          <p className="mt-1 text-sm font-semibold text-white">{hold.dangerBeginsAround}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">If continuing</p>
          <div className="mt-1"><RiskPill label={hold.riskIfContinuing} /></div>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-orange-50/85">
        This is planning guidance, not a verified stopping location or live closure recommendation.
        Confirm fuel, lodging, legal stopping options, and official advisories before leaving.
      </p>
    </section>
  );
}

export function ForecastLimitations({ decision }: { decision: TripDecision }) {
  return (
    <section id="limitations" className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <p className="eyebrow">Forecast and road limits</p>
      <h3 className="mt-2 text-xl font-semibold text-white">Use SnowRoute before you leave—not as your only source.</h3>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {decision.dataQualityNotes.map((note) => (
          <p key={note} className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm leading-6 text-slate-300">
            {note}
          </p>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">{decision.safetyDisclaimer}</p>
    </section>
  );
}
