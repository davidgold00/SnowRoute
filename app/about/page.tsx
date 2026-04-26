import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | SnowRoute",
  description: "A simple overview of how SnowRoute helps plan winter drives.",
};

const sections = [
  {
    title: "What it does",
    body: "SnowRoute estimates weather risk across a full drive by pairing route checkpoints with forecast timing.",
  },
  {
    title: "Why it helps",
    body: "A winter route can change quickly. This gives you one place to check the trip before you leave.",
  },
  {
    title: "What you see",
    body: "The app shows a route map, a trip summary, and the sections of the drive that need the most attention.",
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
              A calmer way to check a winter trip.
            </h1>
            <p className="text-base leading-7 text-slate-300 sm:text-lg">
              SnowRoute is built to make winter travel planning easier to read and quicker to act
              on.
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
