# SnowRoute

SnowRoute is a route-aware driving-condition advisor built with the Next.js App Router. It combines a real road route with hourly forecast data at estimated arrival times, then presents an explainable `GO`, `CAUTION`, `DELAY`, `HOLD`, or `AVOID` planning decision.

The application is designed to support a decision, not make one for the driver. It does not know the live condition of pavement, closures, traffic, vehicle readiness, or driver ability. Always check official weather and transportation sources before departure. SnowRoute is not liable for accidents, injuries, property damage, delays, or other outcomes arising from travel decisions.

## Current release status

This branch includes the SnowRoute2 guest experience, city-first endpoint search, multi-hazard analysis, local trip history, typed API errors, server-side provider access, security headers, and optional distributed rate limiting.

Account and cloud-persistence work is intentionally **not operational**. The repository contains an account-readiness screen and a PostgreSQL schema foundation, but there is no runtime database adapter, OIDC callback/session implementation, authenticated trip API, or guest-to-account importer. Setting database or authentication environment variables does not enable accounts. See [Database and account readiness](docs/DATABASE.md).

## What SnowRoute does

- Resolves a confirmed city first, then searches optional addresses, businesses, landmarks, airports, transit locations, streets, intersections, and postal areas in that context.
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

A fresh visit defaults to approximately one hour ahead of the current time. Location drafts may be retained for convenience, but a previous departure timestamp is not reused. Each endpoint requires a selected city; its exact place is optional. Leaving the place blank explicitly uses the provider's approximate city point. Editing a selected city or place invalidates its stored coordinates and dependent fields until another result is selected.

The homepage has a compact trip launcher. It passes a short-lived trip draft through browser session storage to the full planner; it does not call providers directly from the browser.

## Providers and data provenance

### openrouteservice

The server calls the openrouteservice-hosted Pelias geocoder for city autocomplete, structured address search, and focused place fallback, then uses openrouteservice `driving-car` directions. Provider identifiers, address components, city relationship, precision, and approximation flags are normalized before reaching the client. The API key is sent only in server-side authorization headers.

The hosted geocoder is not part of the versioned openrouteservice core, and SnowRoute does not pin or discover its Pelias version. Exact results and upstream ranking can change independently. See [Location search](docs/LOCATION_SEARCH.md) for contracts, query stages, caches, and limitations.

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
- A repeat analysis of the same structured route intent replaces the older summary; exact-place and city-fallback routes remain distinct even at the same coordinates.
- Version-2 entries contain validated city/place endpoints, effective coordinates, fallback/same-city flags, departure information, compact decision fields, provider/model versions, and timestamps—not raw provider responses or full forecast payloads.
- Users can delete one trip or clear all history.
- **Analyze again** restores route inputs but deliberately chooses a fresh default departure, because an old forecast is stale.
- Legacy version-1 history remains readable, but its city selections are not invented; cities must be reconfirmed before re-analysis.
- Clearing site data, private-browsing behavior, or browser storage policy can remove the history.

Precise routes can reveal home, work, and travel patterns. Guest data remains in the current browser and is not uploaded or synchronized by this implementation.

## API behavior

Public route handlers validate input on the server and return stable internal error codes rather than raw provider messages. City search uses `POST /api/locations/cities`; contextual place search uses `POST /api/locations/places`; `POST /api/geocode` remains for waypoints/compatibility. Successful search and analysis calls use:

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
    "code": "GEOCODER_UNAVAILABLE",
    "title": "Location search is temporarily unavailable.",
    "message": "Your entry is preserved. Try the search again in a moment.",
    "field": "general",
    "retryable": true,
    "correlationId": "SR-…"
  }
}
```

The internal taxonomy can target starting/destination city or place independently, while legacy origin/destination fields remain supported by the analysis contract. Current search handlers use `INVALID_REQUEST` for request-schema failures and stable `GEOCODER_*` codes for upstream failures; form selection errors are resolved locally before analysis. Expected status classes include `400` invalid input, `413` declared body too large, `422` valid structure with unresolved/invalid route semantics, `429` rate limited, `502` invalid upstream response, `503` unavailable or misconfigured, and `504` provider timeout. Technical context and stack traces stay in structured server logs.

`GET /api/health` reports application and route-key configuration readiness without calling paid/external providers or revealing secrets. It is a shallow health check, not proof that providers are currently reachable.

## Repository map

- `app/` — pages, layouts, error boundaries, and API route handlers
- `components/` — planner, results, navigation, map, charts, suggestions, and history UI
- `hooks/` — debounced/cancellable city/place search and guest-history state
- `lib/geocoding.ts`, `lib/location.ts`, and `lib/route-location-state.ts` — provider staging, normalization/ranking, effective endpoints, and dependent location state
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
- Smoke-test the hosted Pelias city, structured-address, unit/postal fallback, outside-city, and city-fallback paths; the geocoder version is not pinned.
- Do not enable account controls until managed PostgreSQL, OIDC, secure sessions, authenticated APIs, ownership tests, deletion, and retention jobs are implemented and audited.
- Apply database migrations only through a reviewed deployment workflow; do not point local tests or seed tools at production.

No production deployment is performed merely by working on or pushing a feature branch.

## Further documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Location search](docs/LOCATION_SEARCH.md)
- [Security and privacy](docs/SECURITY.md)
- [Database and account readiness](docs/DATABASE.md)

## Known limitations

- Forecasts are estimates and may differ from rapidly changing local conditions.
- No live DOT/511 closures, restrictions, incidents, or road-treatment data are used.
- No official weather-alert feed is used; alerts cannot override the score in this release.
- Route-relative hold points are sampled coordinates, not verified legal or open stopping facilities.
- The model has not been calibrated as a crash/closure probability and must not be interpreted that way.
- Provider caches and the fallback limiter are bounded per-instance memory; only the optional Redis limiter is shared.
- Exact city/place coverage and ranking depend on an unpinned hosted Pelias service; the structured geocoding endpoint is beta.
- City membership is heuristic, unit text routes to a building point, and a city fallback is only an approximate provider point.
- Observability provides correlation IDs, total API duration, structured failure stages, and server-side routing/sampling/forecast/scoring/departure-comparison timings. It does not provide distributed traces or a hosted alerting configuration.
- Accounts, sessions, cross-device sync, cloud retention/deletion, and guest import are not operational.
- The SQL migrations are schema foundations, not evidence of a deployed or connected database.
- Browser history is device/browser specific and can disappear when site data is cleared.
