import Link from "next/link";

import { HomeTripLauncher } from "@/components/home-trip-launcher";

const benefits = [
  {
    title: "Timed to your drive",
    body: "Forecasts are matched to when you are expected to reach each part of the route.",
  },
  {
    title: "Focused on the decision",
    body: "SnowRoute explains the hazards that matter most and whether waiting may reduce exposure.",
  },
  {
    title: "Clear about uncertainty",
    body: "Confidence and data limits stay visible so a low score is never presented as a guarantee.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen pb-14 pt-5">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <section className="grid gap-7 rounded-3xl border border-white/10 bg-[#102630] px-5 py-7 shadow-[0_24px_60px_rgba(0,7,10,0.22)] sm:px-7 sm:py-9 lg:grid-cols-[minmax(0,0.82fr)_minmax(460px,1.18fr)] lg:items-start lg:px-9">
          <div className="max-w-xl pt-2">
            <p className="eyebrow">Route-specific hazard guidance</p>
            <h1 className="display-type mt-4 text-4xl leading-[1.02] text-white sm:text-5xl">
              Make a clearer call before severe weather meets the road.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-300">
              Enter a route and departure time. SnowRoute checks when forecast hazards may
              meet your drive, then explains whether to go, wait, or avoid the trip.
            </p>
          </div>

          <HomeTripLauncher />
        </section>

        <section className="mt-7" aria-labelledby="benefits-heading">
          <div className="max-w-2xl">
            <p className="eyebrow">What you get</p>
            <h2 id="benefits-heading" className="mt-2 text-2xl font-semibold tracking-tight text-white">
              The essential guidance, without a wall of weather data.
            </h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {benefits.map((benefit) => (
              <article
                key={benefit.title}
                className="rounded-2xl border border-white/10 bg-[#0d2029] p-5"
              >
                <h3 className="text-base font-semibold text-white">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{benefit.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-amber-200/15 bg-amber-200/[0.045] p-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-white">Plan carefully. Verify locally.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              SnowRoute is forecast-based guidance, not a source for live closures, official
              warnings, road treatment, or emergency instructions.
            </p>
          </div>
          <Link
            href="/about"
            className="mt-4 inline-flex min-h-11 shrink-0 items-center rounded-lg text-sm font-semibold text-cyan-100 underline decoration-cyan-200/35 underline-offset-4 transition hover:text-white sm:mt-0"
          >
            Methodology and limits
          </Link>
        </section>
      </div>
    </main>
  );
}
