import type { Recommendation, RiskLabel } from "@/lib/types";

function pillClasses(tone: string) {
  switch (tone) {
    case "low":
      return "border-emerald-300/35 bg-emerald-400/12 text-emerald-100";
    case "moderate":
      return "border-amber-300/35 bg-amber-400/12 text-amber-100";
    case "high":
      return "border-orange-300/35 bg-orange-400/12 text-orange-100";
    case "severe":
      return "border-rose-300/35 bg-rose-500/14 text-rose-100";
    case "safe":
      return "border-emerald-300/35 bg-emerald-400/12 text-emerald-100";
    case "warning":
      return "border-amber-300/35 bg-amber-400/12 text-amber-100";
    case "danger":
      return "border-rose-300/35 bg-rose-500/14 text-rose-100";
    default:
      return "border-white/15 bg-white/6 text-slate-100";
  }
}

function BasePill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${pillClasses(
        tone,
      )}`}
    >
      {children}
    </span>
  );
}

export function RiskPill({ label }: { label: RiskLabel }) {
  const tone =
    label === "Low"
      ? "low"
      : label === "Moderate"
        ? "moderate"
        : label === "High"
          ? "high"
          : "severe";

  return <BasePill tone={tone}>{label}</BasePill>;
}

export function RecommendationPill({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const tone =
    recommendation === "Safe"
      ? "safe"
      : recommendation === "Use caution"
        ? "warning"
        : "danger";

  return <BasePill tone={tone}>{recommendation}</BasePill>;
}
