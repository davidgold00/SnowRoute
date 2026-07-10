# SnowRoute

SnowRoute is a route-aware driving-condition advisor built with the Next.js App Router. It combines a real road route with hourly forecast data at estimated arrival times, then presents an explainable `GO`, `CAUTION`, `DELAY`, `HOLD`, or `AVOID` planning decision.

The application is designed to support a decision, not make one for the driver. It does not know the live condition of pavement, closures, traffic, vehicle readiness, or driver ability. Always check official weather and transportation sources before departure. SnowRoute is not liable for accidents, injuries, property damage, delays, or other outcomes arising from travel decisions.

## Current release status

This branch includes the SnowRoute2 guest experience, multi-hazard analysis, local trip history, typed API errors, server-side provider access, security headers, and optional distributed rate limiting.

Account and cloud-persistence work is intentionally **not operational**. The repository contains an account-readiness screen and a PostgreSQL schema foundation, but there is no runtime database adapter, OIDC callback/session implementation, authenticated trip API, or guest-to-account importer. Setting database or authentication environment variables does not enable accounts. See [Database and account readiness](docs/DATABASE.md).

## What SnowRoute does

- Resolves suggested addresses and places through openrouteservice geocoding.
- Builds a drivable route, including up to two optional stops.
- Samples checkpoints across the route and estimates an arrival time at each one.
- Matches each checkpoint to Open-Meteo hourly temperature, precipitation, snowfall, visibility, wind, gust, weather-code, and day/night data.
- Evaluates snow, freezing precipitation, possible icing, fog and low visibility, wind, heavy rain and hydroplaning proxies, thunderstorms and hail, temperature extremes, and compound hazards.
- Compares hourly departure options using the same route and forecast-normalization pipeline. Past same-day hours are excluded; future travel days include up to 24 valid local hours, and the selected minute is preserved.
- Groups sustained `High` and `Severe` checkpoints into danger windows and derives route-relative hold guidance.
- Stores up to 20 compact recent analyses in the user's browser for private, account-free re-analysis.

SnowRoute does **not** ingest official alerts, road closures, road-surface sensors, flood observations, traffic, elevation, bridge/open-terrain exposure, plow status, or vehicle-specific data. It never claims inferred icing, hydroplaning, drifting, flooding, or whiteout conditions are observed facts.

## Technology

- Next.js 16 App Router, React 19, and strict TypeScript
- Tailwind CSS 4
- Leaflet, React Leaflet, and OpenStreetMap map tiles
- Recharts
- Zod request validation
- date-fns and date-fns-tz
- Vitest
- openrouteservice Geocoding and Directions APIs
- Open-Meteo Forecast API
- Optional Upstash Redis REST rate-limit backend

## Local setup

Requirements: a current Node.js release compatible with Next.js 16, npm, and an openrouteservice API key.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy the environment template.

   ```bash
   cp .env.example .env.local
   ```

3. Add an openrouteservice key to `.env.local`.

   ```dotenv
   ORS_API_KEY=replace_with_your_server_side_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Start the development server.

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

Do not commit `.env.local` or any real credential. `ORS_API_KEY`, Redis credentials, database URLs, and authentication secrets are server-only. Only `NEXT_PUBLIC_APP_URL` is intentionally available to browser bundles.

## Environment variables

| Variable | Required | Runtime use |
| --- | --- | --- |
| `ORS_API_KEY` | Yes for location search and route analysis | Server-side openrouteservice geocoding and directions authentication. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Canonical metadata base; use the exact origin for the environment. |
| `UPSTASH_REDIS_REST_URL` | Required for distributed production limiting | Shared Upstash Redis REST endpoint used by public API rate limits. |
| `UPSTASH_REDIS_REST_TOKEN` | Required with the Redis URL | Server-side Redis REST bearer token. |
| `RATE_LIMIT_SALT` | Required in production | Secret salt used before hashing anonymous network/client attributes into rate-limit keys. |
| `DATABASE_URL` | Reserved; does not enable accounts | Future managed PostgreSQL connection. No database client connects with it. |
| `AUTH_ISSUER` | Reserved; does not enable accounts | Future audited OIDC issuer. No sign-in flow is implemented. |
| `AUTH_SECRET` | Reserved; does not enable accounts | Future high-entropy session/authentication secret. |

If Redis is not configured or temporarily fails, the application uses an expiring in-memory limiter and logs a degraded warning in production. That fallback is per process and is **not sufficient distributed abuse protection** for a multi-instance deployment.

## Commands

```bash
npm run dev        # Next.js development server (webpack)
npm run test       # Vitest unit suite
npm run test:watch # Vitest watch mode
npm run lint       # ESLint
npm run build      # Production Next.js build (webpack)
npm run start      # Serve a completed production build
```

Before opening a pull request or deploying, run:

```bash
npm run test
npm run lint
npm run build
```

## Product flow

The planner separates a trip into three clear views:

1. **Trip details** — origin, destination, optional stops, compact time/month/day/year controls, and timezone.
2. **Analysis** — decision, confidence, danger windows, route map, route checkpoints, and hourly departure comparison.
3. **Suggestions** — shown only after the user selects **See suggestions**; offers formal, route-relative strategy and potential pre-hazard hold points.

A fresh visit defaults to approximately one hour ahead of the current time. Location drafts may be retained for convenience, but a previous departure timestamp is not reused. Editing a selected suggestion invalidates its stored coordinates until a new result is selected.

The homepage has a compact trip launcher. It passes a short-lived trip draft through browser session storage to the full planner; it does not call providers directly from the browser.

## Providers and data provenance

### openrouteservice

The server calls openrouteservice for both address/place suggestions and `driving-car` directions. Provider identifiers, address components, precision classifications, and approximation flags are normalized before reaching the client. The API key is never sent to browser code.

### Open-Meteo

The server requests hourly forecasts with `timezone=auto`. Provider-local timestamps are converted to UTC, matched to route checkpoint ETAs, and formatted for the selected display timezone. A nearest forecast hour may be used within a bounded tolerance; that fallback and missing fields reduce confidence.

### Maps

The browser renders routes with Leaflet and OpenStreetMap raster tiles. Map code is client-only and loaded dynamically. Map presentation is secondary to the textual decision; map tiles are not an analysis data source.

No official alert provider is configured in this release. A forecast weather code is not presented as a government warning or road restriction.

## Risk and decision model

Every response includes immutable provenance metadata:

- Risk model: `risk-model-2.0.0`
- Analysis pipeline: `route-analysis-2.0.0`
- Analysis timestamp and provider names

Checkpoint scores use a 0–100 scale:

- `0–24`: Low
- `25–49`: Moderate
- `50–74`: High
- `75–100`: Severe

The engine keeps thresholds in `lib/hazard-engine.ts`. Important signals include snowfall beginning above `0.15 cm/h`, reduced visibility below `4.8 km`, wind/gust caution beginning at `48 km/h`, heavy rain beginning at `7.5 mm/h`, and icing inference when measurable precipitation occurs roughly between `-6°C` and `2°C`. Critical combinations apply conservative floors; for example, snow with strong wind and near-zero visibility can force a score of 90.

Independent hazard families are combined with diminishing weights so correlated fields do not simply add without bound. Darkness adds risk only when an underlying hazard exists. Missing data reduces confidence and is never described as evidence of safety.

Route-level risk is currently:

```text
overallScore = round(averageCheckpointScore × 0.6 + worstCheckpointScore × 0.4)
```

Sustained Severe coverage can escalate the route recommendation even when the blended score is lower. The separate decision engine considers the selected result, danger windows, forecast coverage, material-hazard inference confidence, the route-relative hold point, and materially lower-risk departure hours to choose the decision label. A decision-driving inferred or lower-confidence hazard caps the trip-level confidence and explains why.

These thresholds are explainable planning heuristics, not a statistically calibrated crash, closure, or stopping probability.

## Guest history and privacy

Guest history is local-first and optional:

- IndexedDB is the primary store; localStorage is a compatibility fallback.
- At most 20 unique route summaries are retained, newest first.
- A repeat analysis of the same coordinate sequence replaces the older summary.
- Entries contain normalized route labels/coordinates, departure information, compact decision fields, model version, and timestamps—not raw provider responses or full forecast payloads.
- Users can delete one trip or clear all history.
- **Analyze again** restores route inputs but deliberately chooses a fresh default departure, because an old forecast is stale.
- Clearing site data, private-browsing behavior, or browser storage policy can remove the history.

Precise routes can reveal home, work, and travel patterns. Guest data remains in the current browser and is not uploaded or synchronized by this implementation.

## API behavior

Public route handlers validate input on the server and return stable internal error codes rather than raw provider messages. Successful geocode and analysis calls use:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "correlationId": "SR-…",
    "durationMs": 123
  }
}
```

Failures use:

```json
{
  "ok": false,
  "error": {
    "code": "DESTINATION_NOT_FOUND",
    "title": "We couldn’t find the destination.",
    "message": "Choose a suggested address or enter a more complete location.",
    "field": "destination",
    "retryable": false,
    "correlationId": "SR-…"
  }
}
```

Field-specific errors can be returned for origin and destination together. Expected status classes include `400` invalid input, `422` resolvable request with invalid route/location semantics, `429` rate limited, `502` invalid/upstream response, `503` unavailable or misconfigured, and `504` provider timeout. Technical context and stack traces stay in structured server logs.

`GET /api/health` reports application and route-key configuration readiness without calling paid/external providers or revealing secrets. It is a shallow health check, not proof that providers are currently reachable.

## Repository map

- `app/` — pages, layouts, error boundaries, and API route handlers
- `components/` — planner, results, navigation, map, charts, suggestions, and history UI
- `hooks/` — debounced/cancellable search and guest-history state
- `lib/analysis.ts` — route-analysis orchestration
- `lib/hazard-engine.ts` — versioned multi-hazard detection and scoring
- `lib/risk.ts` and `lib/decision-engine.ts` — route aggregation and decision guidance
- `lib/routing.ts` and `lib/weather.ts` — provider adapters, normalization, caching, and resilience
- `lib/app-error.ts` — internal error taxonomy and public API envelopes
- `lib/rate-limit.ts` — shared Redis or degraded per-instance public endpoint limiting
- `lib/guest-trip-history.ts` — bounded browser-persistence abstraction
- `db/migrations/` — reviewed schema foundation for future account persistence; not connected to runtime
- `tests/` — domain, error, persistence, sampling, strategy, and risk tests

## Production checklist

- Use separate provider credentials and databases for development, preview, and production.
- Configure `ORS_API_KEY`, canonical `NEXT_PUBLIC_APP_URL`, `RATE_LIMIT_SALT`, and a shared Redis backend.
- Confirm response security headers and Content Security Policy against the deployed origin.
- Run tests, lint, and a production build.
- Review provider quotas, logs, timeout behavior, and privacy disclosures.
- Do not enable account controls until managed PostgreSQL, OIDC, secure sessions, authenticated APIs, ownership tests, deletion, and retention jobs are implemented and audited.
- Apply database migrations only through a reviewed deployment workflow; do not point local tests or seed tools at production.

No production deployment is performed merely by working on the `SnowRoute2` branch.

## Further documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security and privacy](docs/SECURITY.md)
- [Database and account readiness](docs/DATABASE.md)

## Known limitations

- Forecasts are estimates and may differ from rapidly changing local conditions.
- No live DOT/511 closures, restrictions, incidents, or road-treatment data are used.
- No official weather-alert feed is used; alerts cannot override the score in this release.
- Route-relative hold points are sampled coordinates, not verified legal or open stopping facilities.
- The model has not been calibrated as a crash/closure probability and must not be interpreted that way.
- Provider caches and the fallback limiter are bounded per-instance memory; only the optional Redis limiter is shared.
- Observability provides correlation IDs, total API duration, structured failure stages, and server-side routing/sampling/forecast/scoring/departure-comparison timings. It does not provide distributed traces or a hosted alerting configuration.
- Accounts, sessions, cross-device sync, cloud retention/deletion, and guest import are not operational.
- The SQL migration is a schema foundation, not evidence of a deployed or connected database.
- Browser history is device/browser specific and can disappear when site data is cleared.
