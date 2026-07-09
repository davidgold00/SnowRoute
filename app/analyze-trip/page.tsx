import type { Metadata } from "next";

import { AnalyzeTripShell } from "@/components/analyze-trip-shell";

export const metadata: Metadata = {
  title: "Winter Drive Decision | SnowRoute",
  description:
    "Analyze a winter drive by arrival time and get a forecast-based go, caution, delay, hold, or avoid recommendation.",
};

export default function AnalyzeTripPage() {
  return <AnalyzeTripShell />;
}
