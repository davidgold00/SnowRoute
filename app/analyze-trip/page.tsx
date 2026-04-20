import type { Metadata } from "next";

import { AnalyzeTripShell } from "@/components/analyze-trip-shell";

export const metadata: Metadata = {
  title: "Analyze a Trip | SnowRoute",
  description:
    "Plan a winter trip with route-level forecast matching, segment risk scoring, and hazard window analysis.",
};

export default function AnalyzeTripPage() {
  return <AnalyzeTripShell />;
}
