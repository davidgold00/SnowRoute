import Link from "next/link";

const decisions = [
  { label: "GO", title: "Lower winter risk", tone: "border-emerald-200/30 bg-emerald-300/[0.1] text-emerald-50" },
  { label: "CAUTION", title: "Snowy trouble spots", tone: "border-amber-200/30 bg-amber-300/[0.1] text-amber-50" },
  { label: "DELAY", title: "Safer timing found", tone: "border-orange-200/30 bg-orange-300/[0.1] text-orange-50" },
  { label: "HOLD", title: "Stop before conditions worsen", tone: "border-orange-200/30 bg-orange-300/[0.1] text-orange-50" },
  { label: "AVOID", title: "Severe route risk", tone: "border-rose-200/30 bg-rose-400/[0.12] text-rose-50" },
];

const differentiators = [
  "Matches weather to when you will reach each segment",
  "Scores compounding winter hazards, not just snowfall",
  "Finds route-relative danger windows",
  "Compares departure times for lower-risk options",
  "Explains every recommendation in plain English",
];

const process = [
  "Enter your route and intended departure.",
  "SnowRoute samples the drive and estimates each arrival time.",
  "Hourly forecasts are matched to those route checkpoints.",
  "Winter hazards and forecast limits are scored conservatively.",
  "You get a drive, delay, hold, or avoid recommendation.",
];

export default function Home() {
  return (
    <main className="min-h-screen pb-16 pt-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <section className="glass-panel rounded-[40px] px-6 py-10 sm:px-8 sm:py-12 lg:px-10">
          <div className="max-w-4xl space-y-6">
            <p className="eyebrow">Winter drive decisions</p>
            <h1 className="display-type text-5xl leading-[0.92] text-white sm:text-6xl">
              Should you take that winter drive?
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">
              SnowRoute analyzes your route by arrival time, finds winter danger windows,
              and gives a clear drive, delay, hold, or avoid recommendation.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/analyze-trip"
                className="inline-flex h-13 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ecfaff,#b8ebff_42%,#84d0f5)] px-6 text-sm font-semibold uppercase tracking-[0.22em] text-slate-950 shadow-[0_18px_40px_rgba(84,181,239,0.18)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105"
              >
                Analyze a winter route
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-13 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 text-sm font-medium uppercase tracking-[0.2em] text-slate-100 transition hover:bg-white/[0.08]"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Possible trip decisions">
          {decisions.map((decision) => (
            <article key={decision.label} className={`rounded-2xl border p-4 ${decision.tone}`}>
              <p className="text-xs font-bold uppercase tracking-[0.2em]">{decision.label}</p>
              <p className="mt-2 text-sm font-semibold leading-5">{decision.title}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="glass-panel rounded-[30px] p-6 sm:p-8">
            <p className="eyebrow">Not just weather along the route</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Built for the decision, not just the forecast.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Most route-weather tools show conditions. SnowRoute is built for the harder
              winter question: should you leave, wait, or stop before the dangerous stretch?
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

          <article id="how-it-works" className="glass-panel scroll-mt-24 rounded-[30px] p-6 sm:p-8">
            <p className="eyebrow">How SnowRoute decides</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              The route is read as a winter timeline.
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

        <section className="mt-6 rounded-[30px] border border-amber-200/15 bg-amber-200/[0.045] p-6 sm:p-8">
          <p className="eyebrow text-amber-100/80">A serious planning tool</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Use SnowRoute before you leave—not as your only source.
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
            SnowRoute does not know live road closures, plow status, chain laws, or every
            local condition. Winter forecasts can change quickly. Always check state DOT
            road conditions, local advisories, closures, and emergency guidance before travel.
          </p>
        </section>
      </div>
    </main>
  );
}
