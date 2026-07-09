export function HowItWorks() {
  return (
    <details className="glass-panel group rounded-2xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-white outline-none transition hover:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-cyan-100/70 sm:px-6">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
            About the analysis
          </span>
          <span className="mt-1 block">Read More: How SnowRoute works</span>
        </span>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-lg text-cyan-100 transition group-open:rotate-45"
        >
          +
        </span>
      </summary>

      <div className="border-t border-white/10 px-5 py-5 sm:px-6 sm:py-6">
        <div className="max-w-4xl">
          <p className="text-sm leading-6 text-slate-200">
            SnowRoute is a forecast-matching planning tool. It does not simply show the
            weather at the start and end of a trip; it estimates what you are likely to
            encounter along the way and when you will encounter it.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
              1. Build the route
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Your selected locations are geocoded and sent through OpenRouteService for
              driving directions. The route geometry, distance, and estimated duration are
              kept server-side while the request is validated with Zod.
            </p>
          </article>

          <article className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
              2. Sample the drive
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              SnowRoute places evenly spaced checkpoints along the route. Each checkpoint
              receives an estimated arrival time based on its distance along the drive,
              so a storm arriving later can be matched to the correct part of the trip.
            </p>
          </article>

          <article className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
              3. Match hourly weather
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Hourly forecast data comes from Open-Meteo. SnowRoute requests temperature,
              precipitation, snowfall, visibility, wind, gusts, weather codes, and
              day/night state for the checkpoint coordinates. Times are converted through
              the relevant local time zone and matched to the closest forecast hour within
              a two-hour tolerance. Missing matches remain visible as data-quality notes.
            </p>
          </article>

          <article className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
              4. Explain the risk
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The explainable score weighs snowfall, freezing precipitation, temperature,
              visibility, wind, hazardous weather codes, and night driving. It applies
              conservative minimums to combinations such as snow plus strong wind plus
              very low visibility, then labels each checkpoint Low, Moderate, High, or
              Severe.
            </p>
          </article>

          <article className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
              5. Compare departure times
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The departure optimizer replays the route for each hour of the selected day.
              It compares overall risk, worst checkpoints, hazard-window counts, and
              forecast coverage. It is a planning comparison, not a guarantee that one
              hour will remain safe as conditions change.
            </p>
          </article>

          <article className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
              6. Prepare suggestions
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              When you choose See suggestions, sustained High or Severe windows become
              route-relative decision points. The hold indicator combines peak route risk
              with visibility, snowfall, wind, and near-freezing precipitation signals. It
              is an operational planning estimate—not a crash probability, road-closure
              forecast, or list of verified stopping facilities.
            </p>
          </article>
        </div>

        <div className="mt-5 rounded-xl border border-cyan-100/12 bg-cyan-300/[0.05] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
            Technology and data sources
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            The interface runs on Next.js and React. OpenRouteService supplies geocoding
            and route directions; Open-Meteo supplies the hourly weather forecast; Leaflet
            and OpenStreetMap render the route map; Recharts renders the risk timeline;
            date-fns-tz handles time-zone conversion. SnowRoute does not operate road
            sensors, dispatch plows, verify closures, or guarantee the conditions at a
            specific facility.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-cyan-50">
            <a href="https://openrouteservice.org/" target="_blank" rel="noreferrer" className="underline decoration-cyan-100/40 underline-offset-4 hover:text-white">
              OpenRouteService
            </a>
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline decoration-cyan-100/40 underline-offset-4 hover:text-white">
              Open-Meteo
            </a>
            <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer" className="underline decoration-cyan-100/40 underline-offset-4 hover:text-white">
              OpenStreetMap
            </a>
          </div>
        </div>
      </div>
    </details>
  );
}
