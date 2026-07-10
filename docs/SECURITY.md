# Security and privacy

SnowRoute processes precise route locations and calls external providers, so privacy and cost-abuse controls are part of the architecture even though guest analysis does not require an account. This document describes implemented controls, their limits, and requirements for any future authenticated release.

## Security posture at a glance

Implemented:

- server-only openrouteservice and Redis credentials;
- Zod request validation and coordinate/timezone/range checks;
- independently typed origin and destination validation;
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

`POST /api/geocode` accepts one normalized query between 2 and 120 characters. It rejects declared bodies above 4 KiB; analysis rejects declared bodies above 32 KiB. `POST /api/analyze` validates:

- non-empty labels with bounded length;
- finite latitude in `[-90, 90]` and longitude in `[-180, 180]`;
- distinct origin and destination;
- at most two waypoints in the current UI/API schema;
- an offset-aware UTC departure timestamp;
- a valid IANA timezone;
- a current/future departure and maximum 15-day forecast horizon.

Origin and destination are inspected independently before the full request parse, allowing both field errors in one response. Route construction still determines whether selected coordinates are connected by a drivable route.

Request validation protects application assumptions; it does not prove a label matches its coordinates. The normal UI only submits provider-selected suggestions, but a hostile client can call APIs directly. Any future saved-location feature should preserve provider provenance and, if needed, verify/re-resolve inputs server-side.

## External-provider resilience

Provider adapters use constant base URLs. User input is encoded as query parameters or JSON coordinates and cannot choose a scheme, hostname, port, redirect target, or local-network address. This materially reduces SSRF risk.

Geocoding has an 8-second timeout, directions has a 12-second timeout, and each weather attempt has an 8-second timeout. Weather makes at most two attempts with short jittered backoff; only transient network, quota, or server failures are candidates for the second attempt. Up to 16 coordinates are sent in each provider-supported batch, with at most three batches in flight. The analysis request has a 35-second overall deadline and propagates client cancellation to route/weather fetches. Validation, invalid-payload, and semantic no-route failures are not blindly retried. Bounded caches, in-flight forecast coalescing, and batching reduce duplicate provider work.

Timeouts and retry limits are application resilience controls, not service-level guarantees. Deployment-level function timeouts should leave enough margin for SnowRoute to return its own typed `504` response instead of being terminated by the platform.

## Public endpoint rate limiting

Current anonymous policies:

- geocoding: 45 requests per 60 seconds;
- analysis: 8 requests per 10 minutes.

`lib/rate-limit.ts` hashes a host-derived client address with `RATE_LIMIT_SALT`; changing the user agent does not create another bucket. With Upstash Redis configured, an atomic Lua script increments a shared fixed-window counter. The Redis call has a 1.5-second timeout. Responses include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`; rejected calls also include `Retry-After` and a typed `429` error.

If Redis is missing or unavailable, the code fails over to an expiring in-memory map and logs `rate_limit_degraded` once per process in production. Cleanup is opportunistic after the map grows, so active keys can still consume memory under a distributed attack. This fallback is acceptable for local development and graceful degradation, but it is not strong distributed protection: each instance has an independent counter, instances can restart, and an unknown/spoofable client identity can collapse or bypass buckets depending on proxy configuration.

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

Server failure logs are JSON records with the route stage, provider name, code, status, duration, retryability, technical context, and stack. Hosting log access must be restricted and retention bounded. Do not add raw origin/destination labels, precise coordinates, full IP addresses, or entire provider payloads to logs. Correlation IDs are diagnostic references, not secrets or authentication credentials.

Unexpected React errors are caught by route/global boundaries. Browser console reporting should likewise avoid precise trip data.

## Browser rendering and XSS

React renders user/provider labels as text. The code does not use `dangerouslySetInnerHTML` for location, weather, or history content. URLs for API/provider access are fixed by code. Continue to avoid HTML-capable markdown or rich-text rendering for provider/user fields unless a tested sanitizer and restrictive allowlist are introduced.

Autocomplete uses ARIA combobox/listbox semantics, keyboard selection, cancellation, and a bounded result set. Editing a selected label clears trusted coordinates instead of silently retaining stale hidden values.

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

All `/api/*` responses receive `Cache-Control: no-store` and `X-Robots-Tag: noindex`. The adapters may still use server-side provider caches; those caches never make a private API response publicly cacheable.

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

No application code currently opens a database connection. The SQL migration in `db/migrations/` is an inactive design foundation with UUID keys, coordinate and score constraints, bounded JSON, timestamps with timezone, indexes, foreign-key cascades, soft-delete columns, and PostgreSQL row-level security policies.

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

The local history record stores:

- normalized origin, destination, and up to two stop labels/coordinates;
- local/UTC departure and timezone;
- decision label/summary, risk, confidence, key hazards, and worst segment summary;
- model version, analysis timestamp, route distance, and duration.

It does not store raw weather responses, full route geometry, provider authorization, full API envelopes, or a user account identifier.

Retention is bounded to 20 unique coordinate-sequence summaries. A newer analysis of the same route replaces the older record. Users can delete one entry or clear all entries, and clearing browser site data also removes them. localStorage fallback records are migrated to IndexedDB when possible and removed from the fallback after a successful migration.

Browser storage is not encrypted by SnowRoute. It is available to scripts running on the same origin and to anyone with access to the browser profile/device. Shared-device and high-risk users should clear history or use private browsing according to their browser's behavior.

No guest data is sent to a SnowRoute account or database. Route inputs necessarily transit the SnowRoute server and external routing/weather providers to perform an analysis; review those providers' policies before production use.

### External data flow

- The SnowRoute server receives selected route labels/coordinates, optional stops, departure time, and timezone in order to perform the requested analysis.
- openrouteservice receives search text for autocomplete, and receives ordered coordinates for directions. The server authenticates these calls with `ORS_API_KEY`.
- Open-Meteo receives rounded route-bucket coordinates, the required forecast-day count, and requested hourly field names. It does not receive SnowRoute account data or human-readable route labels from this implementation.
- OpenStreetMap tile servers receive browser-originated tile requests for the map viewport. As with ordinary web requests, the tile host can receive network/request metadata; map use is subject to that provider's policy.
- Upstash Redis, when configured, receives only salted hashes used as rate-limit keys plus counters/expiry—not route labels, coordinates, or analysis payloads.

Provider terms, data processing locations, retention, quotas, and attribution requirements must be reviewed for the actual production deployment. SnowRoute's own local-history policy cannot control an upstream provider's logs.

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

The current migration has `deleted_at` and `expires_at` fields but no cleanup worker. Therefore, it does not implement permanent deletion or a retention schedule by itself.

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
