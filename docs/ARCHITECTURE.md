# SnowRoute architecture

This document describes the SnowRoute2 implementation in this repository. It distinguishes current runtime behavior from account/database foundations that are not yet connected.

## System boundaries

SnowRoute is a Next.js App Router application with a browser-facing UI and same-origin route handlers. Browser code never receives the openrouteservice key, Redis token, future database credentials, or future authentication secrets.

```text
Browser
  ├─ homepage launcher / planner / results / history
  ├─ POST /api/geocode ────────────────┐
  └─ POST /api/analyze ────────────────┼─ Next.js server
                                       │   ├─ validation + typed errors
                                       │   ├─ rate limiting
                                       │   ├─ provider normalization + caches
                                       │   └─ hazard + decision engines
                                       │
                                       ├─ openrouteservice geocoding/directions
                                       ├─ Open-Meteo hourly forecast
                                       └─ optional Upstash Redis rate-limit store

Browser-only guest storage
  └─ IndexedDB, with a localStorage fallback

Future, not wired to runtime
  ├─ managed PostgreSQL
  └─ audited OIDC/session provider
```

OpenStreetMap tile requests are made by Leaflet in the browser. Tiles provide map presentation only and do not affect analysis.

## Primary routes

| Route | Responsibility |
| --- | --- |
| `/` | Product explanation and compact trip launcher. |
| `/analyze-trip` | Three-stage trip input, analysis, and strategy experience. |
| `/history` | Bounded, device-local guest history with re-analysis and deletion. |
| `/account` | Account value/privacy explanation and explicit disabled state. It is not a sign-in implementation. |
| `/about` | Method, data-source, and safety explanation. |
| `POST /api/geocode` | Validates a search query and returns normalized structured suggestions. |
| `POST /api/analyze` | Validates trip input and runs the route/weather/risk/decision pipeline. |
| `GET /api/health` | Shallow application/configuration readiness; no provider probe. |

App-level, global, and not-found boundaries keep recoverable page failures from becoming a blank screen. A valid text result does not depend on map tiles being available.

## Request flow

### 1. Location resolution

1. The combobox waits for at least two characters and debounces input for 300 ms.
2. A new query aborts the superseded browser request.
3. The hook checks a small in-page query cache, then sends `POST /api/geocode`.
4. The route handler validates length with Zod, creates a correlation ID, applies the geocode rate-limit policy, and calls the server-only routing adapter.
5. The adapter normalizes whitespace, checks its cache, and calls openrouteservice with a server-side key and an 8-second provider timeout.
6. `lib/location.ts` converts Pelias/openrouteservice features into stable `LocationSuggestion` records and removes duplicates.
7. The client displays the primary label plus locality, region, postal code, country, place type, precision, and approximation information when available.
8. Coordinates are considered selected only after the user chooses a suggestion. Editing the text after selection invalidates those coordinates.

The normalized location representation includes:

- SnowRoute and provider IDs;
- display and formatted address labels;
- latitude and longitude;
- locality, region, postal code, country, and country code when supplied;
- place/location type;
- conservative precision (`street`, `postal`, `city`, `region`, or `unknown`);
- approximation flag and provider confidence when supplied.

The provider does not guarantee rooftop accuracy. Even house-number results are classified conservatively as street-level; SnowRoute does not invent parcel or rooftop precision.

### 2. Trip submission

The browser sends selected origin/destination coordinates, up to two selected waypoints, a UTC departure timestamp, and an IANA client timezone to `POST /api/analyze`. Duplicate submissions are disabled in the UI and the prior analysis request is abortable.

The server validates origin and destination independently before the main Zod parse so one response can identify both field problems. It then validates coordinates, waypoint count, timestamp, timezone, past/future constraints, and the 15-day forecast horizon. Provider keys and user IDs are never accepted from the client.

### 3. Route construction and sampling

`lib/routing.ts` sends an ordered `[origin, ...waypoints, destination]` coordinate list to openrouteservice `driving-car` directions. It requests encoded geometry without turn instructions, decodes the polyline, and rejects incomplete responses.

`lib/sampling.ts` calculates cumulative distance along the decoded route and selects a bounded number of checkpoints. Each checkpoint receives:

- coordinate;
- distance from route start;
- progress ratio;
- ETA, derived from the provider route duration and departure time.

This is a route-relative estimate, not live traffic prediction.

### 4. Forecast normalization

The selected departure and eligible hourly departure candidates share one route geometry. Past hours are removed for a same-day trip; a future travel day retains up to 24 valid, unique local hours (daylight-saving gaps are excluded). Every comparison preserves the minute from the selected departure so the selected option and any suggested time are represented accurately.

`lib/weather.ts`:

1. rounds checkpoints to two decimal places for forecast buckets;
2. deduplicates bucket requests;
3. batches up to 16 coordinate buckets into one supported multi-location provider request and runs at most three batches concurrently;
4. requests only the forecast-day range needed for the route/candidates;
5. converts Open-Meteo's local hourly timestamps to UTC;
6. matches each ETA to the closest hourly row within two hours;
7. reuses matches by coordinate bucket and UTC hour.

Weather requests have an 8-second timeout per attempt and at most two attempts. Only transient network, quota, or server failures are candidates for the second attempt; invalid normalized payloads fail immediately. With at most 48 route buckets, this produces at most three batched Open-Meteo HTTP requests for a cold cache instead of 48 independent calls. Directions use a 12-second timeout and are not retried automatically. The route handler propagates browser disconnect/cancel signals and applies a 35-second overall analysis deadline.

If no selected-route checkpoint has a supported forecast match, analysis fails responsibly. Coverage below 60% also returns a typed partial-forecast failure instead of allowing missing data to resemble low risk.

An exact match is within 30 minutes. A farther supported match is marked `nearest`; no match within two hours is `unavailable`. Missing snowfall or visibility remains `null` and is included in data-quality/confidence notes.

### 5. Hazard detection

`lib/hazard-engine.ts` owns detection thresholds, compound-hazard rules, confidence, and version metadata. Detectors return structured internal findings with:

- stable hazard type;
- `MINOR`, `MODERATE`, `MAJOR`, or `EXTREME` severity;
- score contribution;
- title and explanation;
- source/provenance;
- `FORECAST` or `INFERRED` status;
- confidence;
- raw normalized value and unit where applicable.

Implemented detector families are:

- snow and heavy snow;
- freezing rain/drizzle and a clearly labeled possible-icing proxy;
- fog and measured low visibility;
- sustained wind/gusts;
- heavy rain and a clearly labeled hydroplaning-risk proxy;
- thunderstorms, severe thunderstorms, and hail from WMO weather codes;
- extreme cold and heat exposure;
- night as a compounding factor only;
- compound snow/wind/visibility, heavy-rain/visibility/wind, and multi-family rules;
- data uncertainty.

Unsupported inputs—official alerts, flood observations, road-surface temperature, closures, elevation/exposure, traffic, wildfire smoke, and road restrictions—are not synthesized.

The strongest hazard family contributes fully; additional families have diminishing weights. Conservative score floors prevent a severe direct or compound signal from being diluted. Checkpoint labels use `Low` (0–24), `Moderate` (25–49), `High` (50–74), and `Severe` (75–100).

Current model metadata:

| Field | Value |
| --- | --- |
| Risk model | `risk-model-2.0.0` |
| Analysis pipeline | `route-analysis-2.0.0` |
| Weather provider | `Open-Meteo Forecast API` |
| Route provider | `openrouteservice Directions API` |
| Geocoder provider | `openrouteservice Geocoding API` |

Any material threshold, detector, interaction, or aggregation change must update the relevant version and tests. Historical summaries retain the version used at analysis time.

### 6. Route aggregation and decisions

`lib/risk.ts` converts checkpoint findings into user-facing factors and guidance. High/Severe checkpoints are grouped into danger windows; a one-checkpoint lower-risk gap may be bridged to avoid noisy fragmentation.

The route score blends duration-by-sample average exposure with the worst checkpoint:

```text
overallScore = round(averageScore × 0.6 + maxScore × 0.4)
```

Severe-window coverage can independently escalate the recommendation. `lib/decision-engine.ts` then combines the route summary, danger windows, confidence/data quality, material-hazard confidence/provenance, hold position, and hourly departure comparison into `GO`, `CAUTION`, `DELAY`, `HOLD`, or `AVOID` guidance. A material inferred or lower-confidence hazard caps trip-level confidence and adds a user-facing reason.

Hold locations are the closest sampled checkpoint immediately before a danger window when available. They are not verified exits, parking areas, shelters, or legal stopping facilities.

### 7. Departure comparison

`lib/departure-optimization.ts` ranks eligible hourly candidates by route score, worst checkpoint, danger-window counts, severe-window counts, and forecast coverage. Past same-day candidates are excluded, the exact selected instant/minute is preserved, and future dates retain up to 24 unique valid local-hour candidates. Incomplete candidates remain visible but are not promoted over complete candidates when complete coverage is available. Near ties are described as ties rather than false precision.

## API contracts and error taxonomy

`lib/app-error.ts` is the single source for stable public codes, default user copy, field association, retryability, and HTTP status. It covers:

- empty, invalid, ambiguous, imprecise, same, or unsupported locations;
- no drivable route and routing provider failures;
- forecast range, partial coverage, and weather provider failures;
- request/offline/abort/timeout states;
- invalid request, missing configuration, and unexpected analysis failure.

Route handlers return a discriminated envelope:

```ts
type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      meta: { correlationId: string; durationMs: number };
    }
  | {
      ok: false;
      error: {
        code: AppErrorCode;
        title: string;
        message: string;
        field?: "origin" | "destination" | "departure" | "general";
        retryable: boolean;
        correlationId?: string;
        fieldErrors?: Record<string, PublicFieldError>;
      };
    };
```

Clients branch on `ok` and stable `code`, never provider-message substrings. Provider responses and exception messages are mapped on the server. Structured error logs include event, timestamp, correlation ID, stage, provider, internal error code, status, duration, retryability, technical context, and server stack. Public responses omit technical context and stacks.

## Cache and concurrency strategy

| Data | Key | TTL | Scope |
| --- | --- | --- | --- |
| Geocoding | normalized lowercase query | 12 hours | Next fetch cache plus process memory |
| Directions | ordered coordinate list | 10 minutes | process memory |
| Forecast | 0.01° bucket and forecast-day count | 15 minutes | Next fetch cache plus process memory |
| Browser autocomplete | normalized lowercase query | current page lifetime | browser memory |
| Guest trip history | route-coordinate fingerprint | until deleted/evicted | IndexedDB/localStorage on one browser |

Forecast calls are bucketed, sent in provider-supported 16-coordinate batches, and parallelized with a three-batch cap. Selected-time and departure-comparison checkpoint requests are resolved together. Browser search is capped at 100 entries; geocode, route, and forecast process caches are capped at 500, 250, and 500 entries respectively. Caches never contain authentication sessions because account persistence is not implemented.

Process-memory caches do not coordinate across serverless instances and disappear on restart. A shared route/weather cache could be introduced later only after privacy, staleness, provider terms, and key design are reviewed.

## Rate limiting

`lib/rate-limit.ts` provides fixed-window policies for anonymous expensive endpoints:

| Scope | Limit | Window |
| --- | --- | --- |
| Geocode | 45 requests | 60 seconds |
| Analysis | 8 requests | 10 minutes |

The host-forwarded client address is hashed with `RATE_LIMIT_SALT`; the raw address is not used as a Redis key, and attacker-controlled user-agent changes do not create new buckets. With `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, the counter is shared through an atomic Redis script. The Redis request times out after 1.5 seconds. Responses expose standard limit, remaining, reset, and retry-after information.

If Redis is missing, times out, or returns an invalid response, limiting falls back to an expiring in-process map. Cleanup is opportunistic and active keys can still grow under a distributed attack. This keeps local development usable but is degraded in production because separate instances have separate counters. Production must configure the shared backend and monitor the `rate_limit_degraded` warning.

## Guest storage

`lib/guest-trip-history.ts` provides a versioned persistence boundary instead of letting UI components write arbitrary storage objects. It validates stored values on read, drops malformed/unsupported entries, bounds user-controlled strings, recalculates fingerprints, sorts newest-first, deduplicates, and keeps at most 20 records.

IndexedDB is primary. localStorage is a fallback and is opportunistically migrated into IndexedDB on a successful read. sessionStorage carries one re-analysis request back to the planner. Storage events and an application event keep open views synchronized within browser limits.

Guest records are compact decision summaries. They are not raw analysis responses and are not uploaded. See [Security and privacy](SECURITY.md) for the retained fields.

## Authenticated persistence boundary

There is no authenticated runtime path. `db/migrations/0001_account_trip_history.sql` is a reviewed PostgreSQL foundation only. The `/account` page detects configuration names to explain readiness, but deliberately provides no credential form, cookie, callback, or cloud write.

Before activation, the project needs all of the following:

- managed PostgreSQL with separate non-production and production instances;
- an audited OIDC/authentication library and callback validation;
- secure server-managed sessions;
- a parameterized database adapter and connection pooling;
- authenticated CRUD APIs that derive ownership from the verified session;
- guest-import, deletion, account-deletion, and retention jobs;
- integration, authorization, CSRF, and cross-account isolation tests.

See [Database and account readiness](DATABASE.md).

## Observability and health

Every geocode/analysis request receives a correlation ID and success duration. Successful analyses emit server-side routing, sampling, forecast, risk-analysis, departure-comparison, and total timings. Failures are emitted as single-line structured JSON with a stage and duration for ingestion by the hosting platform. Logs should be configured with access controls and finite retention; exact addresses and raw request bodies should not be added.

`GET /api/health` checks that the application process is running and whether the routing key exists. It does not make live provider, Redis, authentication, or database calls, so `ready` is configuration readiness rather than an end-to-end service guarantee.

## Design constraints for future work

- Keep all external-provider access in server-only adapters.
- Add data only when a real provider supplies it; preserve provenance and uncertainty.
- Version material model changes and keep old history labels honest.
- Keep guest analysis fully functional without an account.
- Do not share precise route data or authenticated responses through public caches.
- Derive identity and ownership from a verified server session, never a client field.
- Prefer bounded records, queries, payloads, retries, concurrency, and retention.
- Keep textual decisions usable if optional maps/charts fail.
