import type { Recommendation, RiskLabel } from "@/lib/types";

function pillClasses(tone: string) {
  switch (tone) {
    case "low":
      return "border-[#b8d1c2] bg-[#eef6f0] text-[#2f7654]";
    case "moderate":
      return "border-[#dec995] bg-[#fbf7ed] text-[#8a5817]";
    case "high":
      return "border-[#e2b795] bg-[#fff3e9] text-[#a14c18]";
    case "severe":
      return "border-[#e2aaa5] bg-[#fff0ef] text-[#a8322c]";
    case "safe":
      return "border-[#b8d1c2] bg-[#eef6f0] text-[#2f7654]";
    case "warning":
      return "border-[#dec995] bg-[#fbf7ed] text-[#8a5817]";
    case "danger":
      return "border-[#e2aaa5] bg-[#fff0ef] text-[#a8322c]";
    default:
      return "border-[#cfd5ce] bg-[#f3f4f1] text-[#50605b]";
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
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${pillClasses(
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
    recommendation === "Lower risk"
      ? "safe"
      : recommendation === "Use caution"
        ? "warning"
        : "danger";

  return <BasePill tone={tone}>{recommendation}</BasePill>;
}
