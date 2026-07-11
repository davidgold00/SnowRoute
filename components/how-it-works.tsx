export function HowItWorks() {
  return (
    <details className="surface-panel group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[var(--color-text)] outline-none transition hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] sm:px-6">
        <span>
          <span className="eyebrow block">
            About the analysis
          </span>
          <span className="mt-1 block">Read More: How SnowRoute works</span>
        </span>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--color-border)] text-lg text-[var(--color-brand)] transition group-open:rotate-45"
        >
          +
        </span>
      </summary>

      <div className="border-t border-[var(--color-border)] px-5 py-5 sm:px-6 sm:py-6">
        <div className="max-w-4xl">
          <p className="text-sm leading-6 text-[var(--color-text-muted)]">
            SnowRoute is a forecast-matching planning tool. It does not simply show the
            weather at the start and end of a trip; it estimates what you are likely to
            encounter along the way and when you will encounter it.
          </p>
        </div>

        <div className="mt-5 grid border-t border-[var(--color-border)] md:grid-cols-2">
          <article className="border-b border-[var(--color-border)] py-5 md:pr-6">
            <p className="eyebrow">
              1. Build the route
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              You choose each city first, then optionally add an address, business, or
              landmark. SnowRoute uses the city&apos;s country, center, and available bounds to
              make place search less ambiguous. A confirmed place becomes the route point;
              otherwise, the app clearly uses the provider&apos;s approximate city point.
              Validated coordinates are then sent server-side to OpenRouteService for driving
              directions.
            </p>
          </article>

          <article className="border-b border-[var(--color-border)] py-5 md:border-l md:pl-6">
            <p className="eyebrow">
              2. Sample the drive
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              SnowRoute places evenly spaced checkpoints along the route. Each checkpoint
              receives an estimated arrival time based on its distance along the drive,
              so a storm arriving later can be matched to the correct part of the trip.
            </p>
          </article>

          <article className="border-b border-[var(--color-border)] py-5 md:pr-6">
            <p className="eyebrow">
              3. Match hourly weather
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              Hourly forecast data comes from Open-Meteo. SnowRoute requests temperature,
              precipitation, snowfall, visibility, wind, gusts, weather codes, and
              day/night state for the checkpoint coordinates in supported multi-location
              batches. Times are converted through the relevant local time zone and matched
              to the closest forecast hour within a two-hour tolerance. Missing matches
              remain visible as data-quality notes, and insufficient route coverage blocks
              a deceptively low-risk result.
            </p>
          </article>

          <article className="border-b border-[var(--color-border)] py-5 md:border-l md:pl-6">
            <p className="eyebrow">
              4. Explain the risk
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              The versioned, explainable model evaluates snow and blowing snow, freezing
              precipitation and icing proxies, fog and visibility, wind, heavy rain and
              hydroplaning proxies, thunderstorms, hail, extreme temperature, and night
              driving. Related hazards use bounded weights so overlapping signals do not
              simply stack without limit. Direct forecast signals and inferred proxies are
              identified separately, and each checkpoint is labeled Low, Moderate, High,
              or Severe with a confidence assessment.
            </p>
          </article>

          <article className="border-b border-[var(--color-border)] py-5 md:pr-6">
            <p className="eyebrow">
              5. Compare departure times
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              The departure optimizer evaluates eligible future hours while preserving the
              selected minute and excluding past same-day or invalid daylight-saving-time
              choices. It compares overall risk, worst checkpoints, hazard-window counts,
              and forecast coverage. It is a planning comparison, not a guarantee that one
              hour will remain lower-risk as conditions change.
            </p>
          </article>

          <article className="border-b border-[var(--color-border)] py-5 md:border-l md:pl-6">
            <p className="eyebrow">
              6. Prepare suggestions
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              When you choose See suggestions, sustained High or Severe windows become
              route-relative decision points. The hold indicator combines peak route risk
              with visibility, snowfall, wind, and near-freezing precipitation signals. It
              is an operational planning estimate—not a crash probability, road-closure
              forecast, or list of verified stopping facilities.
            </p>
          </article>
        </div>

        <div className="mt-5 bg-[var(--color-brand-soft)] p-5">
          <p className="eyebrow">
            Technology and data sources
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
            The interface runs on Next.js and React. OpenRouteService&apos;s Pelias-based
            geocoder supplies normalized city and place candidates, and OpenRouteService
            supplies route directions. Open-Meteo supplies hourly forecast fields; Leaflet
            and OpenStreetMap render the route map; Recharts renders the risk timeline;
            date-fns-tz handles time-zone conversion. Provider calls and credentials stay
            on the server, and exact search text is excluded from SnowRoute analytics.
            SnowRoute does not ingest official alerts, operate road sensors, dispatch plows,
            verify closures or stopping facilities, or guarantee conditions at a specific
            location.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-[var(--color-brand)]">
            <a href="https://openrouteservice.org/" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-[var(--color-brand-hover)]">
              OpenRouteService
            </a>
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-[var(--color-brand-hover)]">
              Open-Meteo
            </a>
            <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-[var(--color-brand-hover)]">
              OpenStreetMap
            </a>
          </div>
        </div>
      </div>
    </details>
  );
}
