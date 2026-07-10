import type { Metadata } from "next";
import Link from "next/link";

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
    <main className="min-h-screen pb-16 pt-6">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <section className="glass-panel rounded-[36px] px-6 py-10 sm:px-8">
          <div className="max-w-3xl space-y-5">
            <p className="eyebrow">About SnowRoute</p>
            <h1 className="display-type text-5xl leading-[0.94] text-white sm:text-6xl">
              A clearer way to decide before a weather-exposed drive.
            </h1>
            <p className="text-base leading-7 text-slate-300 sm:text-lg">
              SnowRoute is a conservative, explainable planning tool for deciding whether to
              start, delay, or hold before a dangerous stretch of the route.
            </p>
            <Link
              href="/analyze-trip"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ecfaff,#b8ebff_42%,#84d0f5)] px-6 text-sm font-semibold uppercase tracking-[0.2em] text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:brightness-105"
            >
              Open the planner
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <article key={section.title} className="glass-panel rounded-[28px] p-6">
              <h2 className="text-lg font-semibold text-white">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{section.body}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
