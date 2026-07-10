import type { Metadata } from "next";

import { TripHistory } from "@/components/trip-history";

export const metadata: Metadata = {
  title: "Recent trip analyses",
  description: "Review and re-analyze routes saved locally on this device.",
};

export default function HistoryPage() {
  return <TripHistory />;
}
