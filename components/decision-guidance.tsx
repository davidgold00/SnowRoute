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
    <section id="departure-options" className="scroll-mt-24 border-y border-[#a9c8c2] bg-[#e3f0ee] px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow">Better time to leave</p>
          <h3 className="mt-2 text-xl font-semibold text-[#202927]">
            A lower-risk departure appears available around {saferWindow.departureTime}.
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#50605b]">{saferWindow.summary}</p>
          {saferWindow.improvementComparedToSelected ? (
            <p className="mt-2 text-xs leading-5 text-[#176c68]">
              {saferWindow.improvementComparedToSelected}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <RiskPill label={saferWindow.overallRisk} />
          <button
            type="button"
            onClick={() => onUseDeparture(saferWindow.departureTimeUtc)}
            className="button-primary min-h-11 px-4"
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
    return (
      <section id="danger-windows" className="scroll-mt-24 border-y border-[#d9ddd6] py-6">
        <p className="eyebrow">Danger windows</p>
        <h3 className="mt-2 text-xl font-semibold text-[#202927]">
          No major danger window was found.
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#596762]">
          Review the route details for lower-level hazards and changing conditions.
        </p>
      </section>
    );
  }

  return (
    <section id="danger-windows" className="scroll-mt-24 space-y-4">
      <div>
        <p className="eyebrow">Danger windows</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#202927]">
          Where driving conditions are expected to worsen
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#596762]">
          These are route-relative forecast windows, matched to when you are expected to
          reach each stretch—not live closure notices.
        </p>
      </div>
      <ol className="relative mt-6 space-y-0 border-l border-[#b9c2bc] pl-6 md:grid md:grid-cols-3 md:gap-0 md:border-l-0 md:border-t md:pl-0">
        {decision.dangerWindows.slice(0, 3).map((window) => (
          <li key={window.id} className="relative border-b border-[#d9ddd6] py-5 last:border-b-0 md:border-b-0 md:px-5 md:first:pl-0 md:last:pr-0">
            <span aria-hidden="true" className={`absolute -left-[1.78rem] top-7 h-3 w-3 rounded-full border-2 border-white md:-top-[0.42rem] md:left-5 ${window.maxRisk === "Severe" ? "bg-[#b73831]" : "bg-[#c05d1e]"}`} />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#202927]">{window.approximateLocationLabel}</p>
                <p className="mt-1 text-xs text-[#6d7a76]">
                  {window.startTime} to {window.endTime}
                </p>
              </div>
              <RiskPill label={window.maxRisk} />
            </div>
            <p className="mt-4 text-sm leading-6 text-[#50605b]">{window.summary}</p>
            <p className="mt-3 text-xs font-medium leading-5 text-[#6d7a76]">
              {window.hazardTypes.join(" • ")}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ForecastLimitations({ decision }: { decision: TripDecision }) {
  return (
    <details id="limitations" className="rounded-lg border border-[#d9ddd6] bg-white p-5 sm:p-6">
      <summary className="cursor-pointer list-none">
      <span className="eyebrow block">Forecast and road limits</span>
      <span className="mt-2 block text-xl font-semibold text-[#202927]">Use SnowRoute before you leave—not as your only source.</span>
      </summary>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {decision.dataQualityNotes.map((note) => (
          <p key={note} className="border-l-2 border-[#aeb8b1] pl-4 text-sm leading-6 text-[#596762]">
            {note}
          </p>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-[#6d7a76]">{decision.safetyDisclaimer}</p>
    </details>
  );
}
