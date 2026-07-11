# Security and privacy

SnowRoute processes precise route locations and calls external providers, so privacy and cost-abuse controls are part of the architecture even though guest analysis does not require an account. This document describes implemented controls, their limits, and requirements for any future authenticated release.

## Security posture at a glance

Implemented:

- server-only openrouteservice and Redis credentials;
- Zod city/place/effective-endpoint validation plus coordinate/timezone/range checks;
- independently typed starting/destination city and place errors;
- fixed external-provider hosts (no user-controlled fetch URLs);
- stable public error codes without raw upstream errors or stack traces;
- correlation IDs and structured server-side failure logs;
- Content Security Policy and defensive response headers;
- no-store API response policy;
- configurable shared rate limiting with an expiring development fallback;
- explicit provider timeouts and limited transient retries;
- bounded, validated browser history with user deletion controls;
- confirmation before destructive history actions;
- no unsafe HTML rendering of provider/user strings;
- PostgreSQL ownership policies in the inactive schema foundation.

Not implemented:

- sign-up, sign-in, OIDC callbacks, sessions, or account recovery;
- authenticated trip APIs, cloud synchronization, or guest import;
- database runtime access, retention workers, or account deletion;
- a WAF/bot-management layer;
- official alert or road-condition provider authentication;
- end-to-end production monitoring/alerting configuration.

No account or database capability should be represented as operational until those missing controls and their tests exist.

## Data classification

### Sensitive data

Origin, destination, optional stop labels/coordinates, departure time, timezone, and repeated route patterns can reveal home, work, health, religious, or travel behavior. Treat this as sensitive location data even though it is not currently linked to a SnowRoute account.

### Secrets

The following must remain server-side and out of version control, browser bundles, screenshots, support tickets, and public logs:

- `ORS_API_KEY`
- `UPSTASH_REDIS_REST_TOKEN`
- `RATE_LIMIT_SALT`
- future `DATABASE_URL`
- future `AUTH_SECRET` and provider credentials

Only variables prefixed with `NEXT_PUBLIC_` are eligible for browser bundling. In this project, `NEXT_PUBLIC_APP_URL` is public by design.

Use distinct credentials for local, preview, and production environments. Rotate a credential immediately if it is pasted into a chat, issue, log, screenshot, or commit. Revocation/rotation at the provider is necessary; deleting the local text alone does not invalidate it.

## Trust boundaries

1. **Browser input is untrusted.** Labels, coordinates, timestamps, timezones, storage records, provider-shaped objects, headers, and route IDs must be validated again on the server or at the persistence boundary.
2. **External providers are untrusted upstreams.** Status codes, payload shapes, missing fields, coordinates, and text are validated/normalized; provider error bodies are not forwarded.
3. **Forwarded network headers are deployment-controlled input.** Rate-limit identity uses the host-provided `x-forwarded-for`/`x-real-ip` address without partitioning on attacker-controlled user-agent values. Configure the hosting proxy to overwrite these headers; do not expose a deployment where clients can spoof a trusted forwarding chain.
4. **Browser storage is untrusted and ephemeral.** History records are parsed and length/range checked on every read. Invalid versions and malformed records are discarded.
5. **Future database identity must come from a verified server session.** A client-supplied user ID can never establish ownership.

## Input validation

Location endpoints enforce separate contracts:

- `POST /api/locations/cities`: 2–120 query characters, optional 2/3-letter country code, declared body at most 4 KiB;
- `POST /api/locations/places`: 2–160 query characters, a fully validated selected city, optional nearby flag, declared body at most 16 KiB;
- compatibility `POST /api/geocode`: 2–200 query characters, declared body at most 4 KiB;
- `POST /api/analyze`: declared body at most 32 KiB.

The size checks use the declared `Content-Length`; hosting/platform request-size limits remain necessary for absent or dishonest headers. `POST /api/analyze` validates:

- non-empty labels with bounded length;
- finite latitude in `[-90, 90]` and longitude in `[-180, 180]`;
- distinct origin and destination;
- optional effective-endpoint coordinates agree with the legacy-compatible routing coordinates within `0.000001` degrees;
- at most two waypoints in the current UI/API schema;
- an offset-aware UTC departure timestamp;
- a valid IANA timezone;
- a current/future departure and maximum 15-day forecast horizon.

Origin and destination are inspected independently before the full request parse, allowing both field errors in one response. Route construction still determines whether selected coordinates are connected by a drivable route.

Request validation protects application assumptions; it does not cryptographically bind a provider ID/label to coordinates. The normal UI derives effective coordinates from provider-selected city/place objects, but a hostile client can call APIs directly. The server's effective-coordinate equality check prevents two contradictory representations in one request, not forged coordinates. Future cloud persistence should revalidate the complete structured selection and may need provider re-resolution based on product risk.

## External-provider resilience

Provider adapters use constant base URLs. User input is encoded as query parameters or JSON coordinates and cannot choose a scheme, hostname, port, redirect target, or local-network address. This materially reduces SSRF risk.

Pelias geocoding has an 8-second timeout per attempt and at most two attempts. Network errors and HTTP `408`, `429`, or `5xx` may receive one short retry; invalid successful payloads and other statuses do not. Directions has a 12-second timeout. Each weather attempt has an 8-second timeout and weather makes at most two attempts for transient network, quota, or server failures. Up to 16 coordinates are sent in each supported weather batch, with at most three batches in flight. The analysis request has a 35-second overall deadline and propagates client cancellation to route/weather fetches. Bounded caches, in-flight search/forecast coalescing, and batching reduce duplicate provider work.

Timeouts and retry limits are application resilience controls, not service-level guarantees. Deployment-level function timeouts should leave enough margin for SnowRoute to return its own typed `504` response instead of being terminated by the platform.

## Public endpoint rate limiting

Current anonymous policies:

- geocoding: 45 requests per 60 seconds;
- analysis: 8 requests per 10 minutes.

`lib/rate-limit.ts` hashes a host-derived client address with `RATE_LIMIT_SALT`; changing the user agent does not create another bucket. With Upstash Redis configured, an atomic Lua script increments a shared fixed-window counter. The Redis call has a 1.5-second timeout. Responses include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`; rejected calls also include `Retry-After` and a typed `429` error.

The single geocoding policy covers city, place, and legacy waypoint search. A client therefore receives one combined 45-request budget, not 45 requests for each route.

If Redis is missing or unavailable, the code fails over to an expiring in-memory map and logs `rate_limit_degraded` once per process in production. Above 2,000 entries it removes expired records and evicts oldest records until 1,800 remain. This fallback is acceptable for local development and graceful degradation, but it is not strong distributed protection: each instance has an independent counter, instances can restart, and an unknown/spoofable client identity can collapse or bypass buckets depending on proxy configuration.

Production requirements:

- configure `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and a high-entropy `RATE_LIMIT_SALT`;
- restrict and rotate the Redis token;
- monitor degraded warnings and `429` rates;
- enforce trusted proxy/header behavior;
- add platform/WAF controls for volumetric abuse;
- set provider quota/billing alerts;
- create separate, stricter policies before adding authentication endpoints.

The current fixed window is intentionally simple. If abuse patterns require it, move to a reviewed sliding-window/token-bucket design rather than raising limits without evidence.

## Error handling and logging

Public errors contain only a stable internal code, user-safe title/message, field, retryability, and correlation ID. They do not contain:

- raw provider bodies;
- API keys or authorization headers;
- environment values;
- stack traces;
- internal URLs or database statements;
- full request payloads.

Server failure logs are JSON records with the route stage, provider name, code, status, duration, retryability, technical context, and stack. Successful city/place logs contain correlation/duration, provider label, query character count, country code, result counts, cache status, and a unit-note flag—not the query, address, coordinates, or provider IDs. The current `usedUnitFallback` field means a unit note was present and should not be interpreted as proof that a second provider request ran. Hosting log access must be restricted and retention bounded. Do not add raw origin/destination labels, precise coordinates, full IP addresses, or entire provider payloads to logs. Correlation IDs are diagnostic references, not secrets or authentication credentials.

`lib/location-analytics.ts` dispatches same-page custom events with a restricted metadata type and no network adapter. The events can include safe counts, country/precision/type/fallback flags, duration, and internal error code. Any future analytics listener becomes a new data-processing boundary and must continue excluding query text, labels, coordinates, and provider IDs.

Unexpected React errors are caught by route/global boundaries. Browser console reporting should likewise avoid precise trip data.

## Browser rendering and XSS

React renders user/provider labels as text. The code does not use `dangerouslySetInnerHTML` for location, weather, or history content. URLs for API/provider access are fixed by code. Continue to avoid HTML-capable markdown or rich-text rendering for provider/user fields unless a tested sanitizer and restrictive allowlist are introduced.

City and place autocomplete use ARIA combobox/listbox semantics, keyboard selection, cancellation, and bounded result sets. Editing selected text clears trusted coordinates. Reducer transitions also clear dependent places when a parent city changes, and outside-city candidates require an explicit city-change decision.

## Response headers

`next.config.ts` applies these controls to all paths:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- restrictive `Permissions-Policy`
- `Cross-Origin-Opener-Policy: same-origin`
- production-only HSTS with a two-year max age, subdomains, and preload directive
- removal of the `X-Powered-By` header

The CSP restricts the default, script, style, image, font, connection, worker, object, base, form, and framing sources. OpenStreetMap tile images are explicitly allowed. Development adds WebSocket connectivity and `unsafe-eval` for tooling. Inline script/style execution is currently allowed because of framework/chart/map runtime requirements; reducing those allowances with nonces/hashes is a future hardening opportunity and should be tested against Next.js streaming and third-party rendering before rollout.

All `/api/*` responses receive `Cache-Control: no-store` and `X-Robots-Tag: noindex`; city/place handlers explicitly use `private, no-store`. Provider search requests use `cache: no-store`, while SnowRoute's bounded in-process search caches operate behind the response. Those internal caches never make a private API response publicly cacheable.

HSTS and `upgrade-insecure-requests` assume a correctly configured HTTPS production deployment. Verify headers in the actual preview/production environment because hosting middleware can add, merge, or override them.

## CSRF and state changes

Current geocode and analysis POST requests are stateless computations. Guest history mutation occurs entirely in same-origin browser storage and does not modify a server account. There are currently no authentication cookies or server-side personal-data mutations, so a token-based CSRF mechanism has not been added.

Before authenticated persistence is introduced:

- use `Secure`, `HttpOnly`, appropriately scoped `SameSite` session cookies;
- validate `Origin`/`Host` on state-changing requests;
- add CSRF tokens where the chosen framework/session pattern requires them;
- never use GET for state mutation;
- require recent authentication/confirmation for account deletion or security changes;
- keep destructive UI confirmations, while recognizing that confirmation dialogs are not authorization.

## Database and authorization

No application code currently opens a database connection. The SQL migrations in `db/migrations/` are inactive design foundations with UUID keys, coordinate and score constraints, bounded structured-location/analysis JSON, timestamps with timezone, indexes, foreign-key cascades, soft-delete columns, and PostgreSQL row-level security policies.

Those policies expect the runtime transaction to set `app.user_id` from a verified server session. Because no such runtime exists, the presence of RLS SQL must not be treated as proof of authorization. A future adapter must:

- use parameterized queries through a maintained driver/ORM;
- set/reset the session identity safely inside every transaction;
- derive it only from a verified session;
- return `404` for unowned opaque IDs;
- test cross-account read/write/delete isolation;
- use a serverless-compatible connection pool;
- enforce transaction boundaries for trip+analysis creation, import, and deletion.

See [Database and account readiness](DATABASE.md).

## Guest privacy and retention

New version-2 local history records store:

- validated city/place endpoint selections, effective labels/coordinates, same-city and city-fallback flags, geocoder label, and up to two stop labels/coordinates;
- local/UTC departure and timezone;
- decision label/summary, risk, confidence, key hazards, and worst segment summary;
- model version, analysis timestamp, route distance, and duration.

It does not store raw weather responses, full route geometry, provider authorization, full API envelopes, or a user account identifier.

Retention is bounded to 20 unique structured-intent summaries. Fingerprints distinguish a city fallback from an exact place even at the same coordinate. A newer analysis of the same structured route replaces the older record. Users can delete one entry or clear all entries, and clearing browser site data also removes them. Valid legacy v1 history is normalized to v2 without inventing city selections; re-analysis requires city confirmation. localStorage/IndexedDB sources are rewritten only after a successful migration, and legacy localStorage is removed after that rewrite.

Browser storage is not encrypted by SnowRoute. It is available to scripts running on the same origin and to anyone with access to the browser profile/device. Shared-device and high-risk users should clear history or use private browsing according to their browser's behavior.

No guest data is sent to a SnowRoute account or database. Route inputs necessarily transit the SnowRoute server and external routing/weather providers to perform an analysis; review those providers' policies before production use.

### External data flow

- The SnowRoute server receives city/place search text, the selected city object for contextual place search, and selected route labels/coordinates, optional stops, departure time, and timezone for analysis.
- The openrouteservice-hosted Pelias service receives city/place search parameters and context; openrouteservice directions receives ordered coordinates. The server authenticates these calls with `ORS_API_KEY`.
- Open-Meteo receives rounded route-bucket coordinates, the required forecast-day count, and requested hourly field names. It does not receive SnowRoute account data or human-readable route labels from this implementation.
- OpenStreetMap tile servers receive browser-originated tile requests for the map viewport. As with ordinary web requests, the tile host can receive network/request metadata; map use is subject to that provider's policy.
- Upstash Redis, when configured, receives only salted hashes used as rate-limit keys plus counters/expiry—not route labels, coordinates, or analysis payloads.

Provider terms, data processing locations, retention, quotas, and attribution requirements must be reviewed for the actual production deployment. SnowRoute's own local-history policy cannot control an upstream provider's logs.

The hosted Pelias version, details endpoint, dataset release, and language behavior are not exposed or pinned by SnowRoute. Application cache keys are SHA-256 digests of search/context, but hashes are not anonymization and cached values contain location results in process memory.

## Future cloud retention policy

Before cloud storage is enabled, publish and implement a precise policy covering:

- what normalized route and analysis fields are stored;
- default retention for active records;
- soft-deletion visibility and short cleanup window;
- permanent trip and account deletion;
- backup expiration and restoration handling;
- operational/security log retention;
- explicit, optional guest import and deduplication;
- access/export expectations.

The current schema foundations include `deleted_at` and `expires_at` fields but no cleanup worker. Therefore, they do not implement permanent deletion or a retention schedule by themselves.

## Security review checklist

Before production deployment:

- [ ] Rotate any credential that has ever been exposed outside the secret manager.
- [ ] Configure separate production values for all required environment variables.
- [ ] Confirm shared Redis limiting is active; investigate degraded warnings.
- [ ] Verify CSP/security headers and TLS/HSTS on the deployed origin.
- [ ] Run `npm run test`, `npm run lint`, and `npm run build`.
- [ ] Review dependency advisories with the team's approved tooling.
- [ ] Confirm provider quotas, billing caps, and request timeout margins.
- [ ] Restrict log access and retention; search for accidental precise-location logging.
- [ ] Validate invalid/ambiguous address, no-route, timeout, offline, and rate-limit recovery.
- [ ] Smoke-test duplicate city names, structured numeric addresses, US/Canadian postal extraction, unit fallback, outside-city warnings, and explicit city fallback against the preview provider.
- [ ] Confirm location success logs and browser custom events contain no query text, addresses, coordinates, or provider IDs.
- [ ] Check keyboard, screen-reader, reduced-motion, and narrow-screen behavior.
- [ ] Confirm no database/auth UI is enabled merely because placeholder variables exist.

Additional requirements before accounts:

- [ ] Select and integrate a maintained OIDC/authentication library.
- [ ] Complete session, callback, CSRF, recovery, sign-out, and account-deletion threat review.
- [ ] Implement the database adapter and reviewed migration runner.
- [ ] Add authenticated endpoint rate limits and audit-safe events.
- [ ] Add cross-user authorization, session-fixation, CSRF, and deletion tests.
- [ ] Implement and test guest import consent and rollback behavior.
- [ ] Implement retention/cleanup and backup-deletion procedures.

## Safety disclaimer

Security controls do not make forecast guidance a guarantee. SnowRoute provides planning suggestions based on limited third-party forecast and route data. It cannot determine whether a trip is safe, and it is not liable for accidents or other travel outcomes. Drivers remain responsible for checking official sources, obeying closures and emergency instructions, using a suitable vehicle, and proceeding with caution.
