import type { RiskLabel } from "@/lib/types";

export const RISK_THRESHOLDS: Array<{
  label: RiskLabel;
  range: string;
  colorClass: string;
  description: string;
}> = [
  {
    label: "Low",
    range: "0-24",
    colorClass: "bg-emerald-300",
    description: "Routine road-weather awareness.",
  },
  {
    label: "Moderate",
    range: "25-49",
    colorClass: "bg-amber-300",
    description: "Use caution and watch changing conditions.",
  },
  {
    label: "High",
    range: "50-74",
    colorClass: "bg-orange-300",
    description: "Delay or reroute if possible.",
  },
  {
    label: "Severe",
    range: "75-100",
    colorClass: "bg-rose-400",
    description: "Avoid travel unless essential.",
  },
];

export function RiskLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`border border-[var(--color-border)] bg-white/95 p-3 text-[var(--color-text)] shadow-[var(--shadow-surface)] ${compact ? "" : ""}`}
      aria-label="Risk score legend"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
        Risk score
      </p>
      <div className="mt-3 grid gap-2">
        {RISK_THRESHOLDS.map((item) => (
          <div key={item.label} className="flex items-start gap-2 text-xs">
            <span
              className={`mt-1 h-3 w-3 shrink-0 rounded-full ${item.colorClass}`}
              aria-hidden="true"
            />
            <span>
              <span className="font-semibold text-[var(--color-text)]">{item.label}</span>{" "}
              <span className="text-[var(--color-text-muted)]">({item.range})</span>
              {!compact ? (
                <span className="block text-[var(--color-text-muted)]">{item.description}</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
        Checkpoint markers use the same scale as route segments.
      </p>
    </div>
  );
}
