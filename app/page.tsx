import Link from "next/link";

import { HomeTripLauncher } from "@/components/home-trip-launcher";

const decisions = [
  { label: "GO", title: "Lower observed risk", symbol: "✓", tone: "border-emerald-200/25 text-emerald-100" },
  { label: "CAUTION", title: "Manageable hazards", symbol: "!", tone: "border-amber-200/25 text-amber-100" },
  { label: "DELAY", title: "A better time may help", symbol: "↻", tone: "border-orange-200/25 text-orange-100" },
  { label: "HOLD", title: "Pause before danger", symbol: "Ⅱ", tone: "border-orange-200/25 text-orange-100" },
  { label: "AVOID", title: "Severe route exposure", symbol: "×", tone: "border-rose-200/25 text-rose-100" },
];

const differentiators = [
  "Matches weather to when you will reach each segment",
  "Scores compounding road-weather hazards, not just snowfall",
  "Finds route-relative danger windows",
  "Compares departure times for lower-risk options",
  "Explains every recommendation in plain English",
];

const process = [
  "Enter your route and intended departure.",
  "SnowRoute samples the drive and estimates each arrival time.",
  "Hourly forecasts are matched to those route checkpoints.",
  "Road-weather hazards and forecast limits are scored conservatively.",
  "You get a drive, delay, hold, or avoid recommendation.",
];

export default function Home() {
  return (
    <main className="min-h-screen pb-16 pt-5">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <section className="grid gap-7 rounded-3xl border border-white/10 bg-[#102630] px-5 py-7 shadow-[0_24px_60px_rgba(0,7,10,0.22)] sm:px-7 sm:py-9 lg:grid-cols-[minmax(0,0.82fr)_minmax(460px,1.18fr)] lg:items-start lg:px-9">
          <div className="max-w-xl pt-2">
            <p className="eyebrow">Route-specific hazard guidance</p>
            <h1 className="display-type mt-4 text-4xl leading-[1.02] text-white sm:text-5xl">
              Make a clearer call before severe weather meets the road.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-300">
              SnowRoute combines your route, timing, and hourly forecasts to explain where
              snow, ice, low visibility, heavy rain, wind, or storms may change the decision.
            </p>
            <div className="mt-6 grid gap-3 text-sm text-slate-300">
              {differentiators.slice(0, 3).map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-cyan-200/25 text-[11px] text-cyan-100">✓</span>
                  <span className="leading-6">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <HomeTripLauncher />
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Possible trip decisions">
          {decisions.map((decision) => (
            <article key={decision.label} className={`rounded-xl border bg-[#0d2029] p-4 ${decision.tone}`}>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-md border border-current/25 text-xs font-bold">{decision.symbol}</span>
                <p className="text-xs font-bold uppercase tracking-[0.16em]">{decision.label}</p>
              </div>
              <p className="mt-2 text-sm font-medium leading-5 text-slate-300">{decision.title}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="glass-panel rounded-2xl p-6 sm:p-8">
            <p className="eyebrow">Not just weather along the route</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Built for the decision, not just the forecast.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Most route-weather tools show conditions. SnowRoute is built for the harder
              question: should you leave, wait, or stop before the dangerous stretch?
            </p>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate-200">
              {differentiators.map((item) => (
                <li key={item} className="flex gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                  <span aria-hidden="true" className="text-cyan-200">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article id="how-it-works" className="glass-panel scroll-mt-24 rounded-2xl p-6 sm:p-8">
            <p className="eyebrow">How SnowRoute decides</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              The route is read as a driving-risk timeline.
            </h2>
            <ol className="mt-5 grid gap-3">
              {process.map((item, index) => (
                <li key={item} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-300">
                  <span className="font-mono text-xs font-semibold text-cyan-100/80">0{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </article>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200/15 bg-amber-200/[0.045] p-6 sm:p-8">
          <p className="eyebrow text-amber-100/80">A serious planning tool</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Use SnowRoute before you leave—not as your only source.
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
            SnowRoute does not know live road closures, plow status, chain laws, or every
            local condition. Road-weather forecasts can change quickly. Always check state DOT
            road conditions, local advisories, closures, and emergency guidance before travel.
          </p>
          <Link href="/about" className="mt-4 inline-flex text-sm font-semibold text-cyan-100 underline decoration-cyan-200/35 underline-offset-4 hover:text-white">
            Read the methodology and data sources
          </Link>
        </section>
      </div>
    </main>
  );
}
