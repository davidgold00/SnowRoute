import type { Metadata } from "next";

import { AnalyzeTripShell } from "@/components/analyze-trip-shell";

export const metadata: Metadata = {
  title: "Route analysis",
  description:
    "Analyze a drive by arrival time and get forecast-based GO, CAUTION, DELAY, HOLD, or AVOID guidance.",
};

export default function AnalyzeTripPage() {
  return <AnalyzeTripShell />;
}
