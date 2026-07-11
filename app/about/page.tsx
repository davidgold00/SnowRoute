import type { Metadata } from "next";
import Link from "next/link";

import { HowItWorks } from "@/components/how-it-works";

export const metadata: Metadata = {
  title: "About",
  description: "How SnowRoute turns route-specific weather forecasts into drive, delay, hold, or avoid guidance.",
};

const sections = [
  {
    title: "What it does",
    body: "SnowRoute turns ETA-matched forecasts into clear GO, CAUTION, DELAY, HOLD, or AVOID guidance.",
  },
  {
    title: "Why it helps",
    body: "A drive can be manageable at the start and dangerous later. SnowRoute highlights that timing before you leave.",
  },
  {
    title: "What you see",
    body: "The decision comes first, followed by danger windows, safer departure options, hold guidance, and route evidence.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen pb-16 pt-10">
      <div className="page-container max-w-5xl">
        <section className="border-b border-[var(--color-border)] pb-10">
          <div className="max-w-3xl space-y-5">
            <p className="eyebrow">About SnowRoute</p>
            <h1 className="display-type text-4xl leading-[1.02] text-[var(--color-text)] sm:text-6xl">
              A clearer way to decide before a weather-exposed drive.
            </h1>
            <p className="text-base leading-7 text-[var(--color-text-muted)] sm:text-lg">
              SnowRoute is a conservative, explainable planning tool for deciding whether to
              start, delay, or hold before a dangerous stretch of the route.
            </p>
            <Link
              href="/analyze-trip"
              className="button-primary"
            >
              Open the planner
            </Link>
          </div>
        </section>

        <section className="grid border-b border-[var(--color-border)] md:grid-cols-3">
          {sections.map((section) => (
            <article key={section.title} className="border-b border-[var(--color-border)] py-6 last:border-b-0 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">{section.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-6" aria-labelledby="methodology-heading">
          <h2 id="methodology-heading" className="sr-only">
            Methodology and data sources
          </h2>
          <HowItWorks />
        </section>
      </div>
    </main>
  );
}
