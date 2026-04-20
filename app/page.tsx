import Link from "next/link";

const featureCards = [
  {
    title: "Route-level forecast matching",
    body: "Weather is aligned to the expected arrival time at each checkpoint along the drive, not just the origin and destination.",
  },
  {
    title: "Explainable winter risk scoring",
    body: "Snowfall, icing conditions, visibility, wind, hazardous codes, and nighttime exposure are surfaced as readable score drivers.",
  },
  {
    title: "Decision-ready outputs",
    body: "Users get a route map, risk timeline, checkpoint table, and plain-language recommendation in one coherent workflow.",
  },
];

const workflow = [
  {
    step: "01",
    title: "Build the route",
    body: "Select exact locations, optional waypoints, and departure time so the trip geometry and ETA model are trustworthy.",
  },
  {
    step: "02",
    title: "Sample across the drive",
    body: "SnowRoute interpolates checkpoints along the route line and assigns ETA to each one based on cumulative distance.",
  },
  {
    step: "03",
    title: "Match forecast to time and place",
    body: "Open-Meteo conditions are normalized and matched to the nearest valid forecast hour at each sampled checkpoint.",
  },
  {
    step: "04",
    title: "Score and explain risk",
    body: "The route is colored by risk while the summary calls out severe windows, worst segments, and the clearest recommendation.",
  },
];

const valueProps = [
  {
    eyebrow: "Why it matters",
    title: "Winter driving risk changes over time, not just across geography.",
    body: "A route that looks safe at departure can become hazardous midway through the drive. SnowRoute is designed to answer the real question: what will conditions look like where I am when I get there?",
  },
  {
    eyebrow: "Built for clarity",
    title: "More than a scorecard.",
    body: "The product is designed to feel operational, not academic. Every score is attached to route segments, hazard windows, and human-readable reasons that help a driver or planner act.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen pb-16 pt-4">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="glass-panel hero-shell rounded-[40px] px-6 py-7 lg:px-8 lg:py-9">
          <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                  SnowRoute
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-200">
                  Intelligent winter route analysis
                </div>
              </div>

              <div className="space-y-5">
                <p className="eyebrow">A winter travel decision system, not just a map</p>
                <h1 className="display-type max-w-4xl text-5xl leading-[0.9] text-white sm:text-6xl lg:text-[4.6rem]">
                  Understand the risk of a winter drive across the whole route.
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                  SnowRoute helps users assess winter driving risk dynamically across space and
                  time. Instead of checking only the start and end of a trip, it follows the
                  route itself and scores what conditions are likely to be when each segment is
                  actually reached.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/analyze-trip"
                  className="inline-flex h-13 items-center justify-center rounded-full bg-[linear-gradient(135deg,#dff7ff,#9be6ff_42%,#70c8f5)] px-6 text-sm font-semibold uppercase tracking-[0.22em] text-slate-950 shadow-[0_18px_40px_rgba(84,181,239,0.24)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105"
                >
                  Analyze a trip
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex h-13 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 text-sm font-medium uppercase tracking-[0.2em] text-slate-100 transition hover:bg-white/[0.08]"
                >
                  How it works
                </a>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="panel-muted rounded-[30px] p-5">
                <p className="eyebrow">What the product does</p>
                <div className="mt-5 grid gap-3">
                  {featureCards.map((item) => (
                    <div key={item.title} className="metric-card rounded-[24px] p-4">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
                {[
                  { label: "Temporal model", value: "ETA-aware" },
                  { label: "Forecast source", value: "Open-Meteo" },
                  { label: "Route engine", value: "OpenRouteService" },
                ].map((item) => (
                  <div key={item.label} className="metric-card rounded-[22px] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-3 text-xl font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section id="how-it-works" className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="glass-panel rounded-[34px] p-6 lg:p-7">
            <div className="space-y-4">
              <p className="eyebrow">How it works</p>
              <h2 className="display-type text-4xl text-white">A route-first winter analysis engine</h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                The core challenge is not weather lookup. It is connecting route geometry, travel
                time, and forecast timing into one model that can be explained to a real user.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {workflow.map((item) => (
                <div key={item.step} className="panel-muted rounded-[24px] p-4">
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            {valueProps.map((item) => (
              <section key={item.title} className="glass-panel rounded-[34px] p-6 lg:p-7">
                <div className="space-y-4">
                  <p className="eyebrow">{item.eyebrow}</p>
                  <h2 className="display-type text-4xl text-white">{item.title}</h2>
                  <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                    {item.body}
                  </p>
                </div>
              </section>
            ))}

            <section className="glass-panel rounded-[34px] p-6 lg:p-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="metric-card rounded-[24px] p-5">
                  <p className="eyebrow">Outputs</p>
                  <p className="mt-4 text-2xl font-semibold text-white">Map, timeline, summary, table</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    The interface is built so every view is synchronized around the same
                    normalized route analysis payload.
                  </p>
                </div>
                <div className="metric-card rounded-[24px] p-5">
                  <p className="eyebrow">Recommendation layer</p>
                  <p className="mt-4 text-2xl font-semibold text-white">Safe to Avoid travel</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Recommendation logic converts raw route risk into a direct operational call
                    without hiding the reasons behind it.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="glass-panel mt-6 rounded-[36px] px-6 py-7 lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <p className="eyebrow">Ready to use the planner?</p>
              <h2 className="display-type max-w-3xl text-4xl text-white sm:text-5xl">
                Move from explanation to live route analysis.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                The analysis workspace is dedicated to the planning experience: route entry,
                map visualization, risk summary, checkpoint detail, and hazard timing.
              </p>
            </div>

            <Link
              href="/analyze-trip"
              className="inline-flex h-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#dff7ff,#9be6ff_42%,#70c8f5)] px-7 text-sm font-semibold uppercase tracking-[0.22em] text-slate-950 shadow-[0_18px_40px_rgba(84,181,239,0.24)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105"
            >
              Open Analyze a Trip
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
