import { RiskPill } from "@/components/status-pill";
import type { TripDecision } from "@/lib/types";

function decisionTone(decision: TripDecision["decision"]) {
  switch (decision) {
    case "GO":
      return "border-[#3f7b5b] text-[#2f7654]";
    case "CAUTION":
      return "border-[#a66d20] text-[#8a5817]";
    case "DELAY":
    case "HOLD":
      return "border-[#c05d1e] text-[#a14c18]";
    case "AVOID":
      return "border-[#b73831] text-[#a8322c]";
  }
}

function confidenceTone(confidence: TripDecision["confidence"]) {
  return confidence === "High"
    ? "text-[#2f7654]"
    : confidence === "Medium"
      ? "text-[#8a5817]"
      : "text-[#a8322c]";
}

export function DecisionCard({ decision }: { decision: TripDecision }) {
  return (
    <section id="decision" tabIndex={-1} className={`feature-surface scroll-mt-24 border-l-4 p-5 outline-none sm:p-7 ${decisionTone(decision.decision).split(" ")[0]}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">Drive decision</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={`inline-flex text-sm font-bold ${decisionTone(decision.decision).split(" ").slice(1).join(" ")}`}>
              {decision.decision}
            </span>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#202927] sm:text-3xl">
              {decision.decisionLabel}
            </h2>
          </div>
          <p className="mt-4 text-base leading-7 text-[#50605b]">{decision.decisionSummary}</p>
        </div>

        <div className="grid grid-cols-3 border-y border-[#d9ddd6] text-center lg:min-w-[390px]">
          <div className="px-3 py-3">
            <p className="text-xs font-medium text-[#6d7a76]">
              Overall
            </p>
            <div className="mt-2 flex justify-center"><RiskPill label={decision.overallRisk} /></div>
          </div>
          <div className="border-l border-[#d9ddd6] px-3 py-3">
            <p className="text-xs font-medium text-[#6d7a76]">
              Worst
            </p>
            <div className="mt-2 flex justify-center"><RiskPill label={decision.worstSegmentRisk} /></div>
          </div>
          <div className="border-l border-[#d9ddd6] px-3 py-3">
            <p className="text-xs font-medium text-[#6d7a76]">
              Confidence
            </p>
            <p className={`mt-2 text-sm font-semibold ${confidenceTone(decision.confidence)}`}>
              {decision.confidence}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 border-t border-[#d9ddd6] pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] lg:divide-x lg:divide-[#d9ddd6]">
        <div>
          <p className="text-sm font-semibold text-[#384641]">
            Why this recommendation
          </p>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#50605b]">
            {decision.explanationBullets.length > 0 ? (
              decision.explanationBullets.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <span aria-hidden="true" className="text-[#176c68]">•</span>
                  <span>{reason}</span>
                </li>
              ))
            ) : (
              <li>Forecast data did not identify a major driving-hazard signal.</li>
            )}
          </ul>
        </div>
        <div className="lg:pl-6">
          <p className="text-sm font-semibold text-[#384641]">
            Highest-risk point
          </p>
          <p className="mt-3 text-sm font-semibold text-[#202927]">
            {decision.worstSegmentLocationLabel}
          </p>
          <p className="mt-1 text-sm leading-6 text-[#596762]">
            Expected around {decision.worstSegmentArrivalTime}
          </p>
          {decision.mainHazards.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {decision.mainHazards.slice(0, 3).map((hazard) => (
                <span
                  key={hazard}
                  className="rounded-full border border-[#c6d9d5] bg-[#f2f8f6] px-2.5 py-1 text-xs text-[#176c68]"
                >
                  {hazard}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {decision.confidence !== "High" ? (
        <p className="mt-4 text-xs leading-5 text-[#796027]">
          {decision.confidenceReasons[0]} Treat this as planning guidance and check official
          sources before leaving.
        </p>
      ) : null}
    </section>
  );
}
