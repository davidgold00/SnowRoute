# Database and account readiness

## Important status

Accounts and cloud persistence are **not operational in this repository**.

The current application has:

- an `/account` page that explains optional account value and precise-location privacy;
- PostgreSQL schema foundations at `db/migrations/0001_account_trip_history.sql` and `0002_structured_trip_locations.sql`;
- reserved environment-variable names;
- local guest history in IndexedDB/localStorage.

It does **not** have:

- a PostgreSQL driver, ORM, connection pool, or runtime repository layer;
- an automated migration tool or deployment migration job;
- an OIDC/authentication library, callback route, session cookie, verification flow, sign-up, or sign-in;
- authenticated trip CRUD endpoints;
- cloud history UI or synchronization;
- guest-to-account import;
- account deletion or retention cleanup workers;
- a provisioned database demonstrated by this repository.

Setting `DATABASE_URL`, `AUTH_ISSUER`, or `AUTH_SECRET` only changes the account-readiness explanation. It does not create a secure login or database connection. Do not remove the disabled state until the runtime integration and security tests below are complete.

## Why PostgreSQL

The planned data is relational and ownership-sensitive: one verified user owns trips; a trip has ordered stops and multiple versioned analyses. PostgreSQL provides transactions, constraints, JSONB for bounded compact summaries, indexes for history queries, and row-level security as defense in depth.

The browser guest store remains the only active persistence mechanism. A user can analyze, review local history, delete entries, and re-analyze without an account.

## Schema foundation

Migration `0001_account_trip_history.sql` creates the account/trip/analysis foundation in one transaction and enables `pgcrypto` for UUID generation. Additive migration `0002_structured_trip_locations.sql` evolves future trip rows for city-first endpoints without guessing structure for legacy rows. Neither migration is connected to runtime application code.

### `snowroute_users`

Planned application profile linked to an external identity:

- opaque UUID primary key;
- unique `auth_subject` supplied by a future verified OIDC provider;
- bounded email and optional display name;
- created/updated timestamps with timezone;
- nullable `deleted_at` for account-deletion workflow state.

No password or password hash is stored. The migration deliberately does not invent session/account tables because those must follow the selected authentication library/provider.

An active-row, case-insensitive unique email index is included. Before activation, decide whether email uniqueness belongs in SnowRoute or exclusively in the identity provider, and define how verified email changes are synchronized.

### `trips`

Planned user-owned route record:

- UUID primary key and required `user_id` foreign key;
- optional bounded title;
- bounded origin/destination effective labels and checked effective coordinates;
- planned departure and IANA client timezone;
- optional SHA-256-sized route fingerprint;
- favorite flag;
- created/updated timestamps and nullable soft-delete timestamp.

Deleting a user cascades to trips. Normal future queries must exclude `deleted_at IS NOT NULL` even though row-level security enforces ownership.

After migration 0002, the table can also retain:

- `location_schema_version` (`1` legacy flat values or `2` structured city-first values);
- bounded `origin_selection` and `destination_selection` JSON objects;
- `same_city` and endpoint city-fallback flags;
- effective precision values;
- geocoder-provider label.

The flat labels/coordinates remain the effective routing compatibility columns. This avoids requiring every read/query to decode JSON and preserves version-1 rows honestly.

### `trip_stops`

Ordered optional intermediate stops:

- UUID primary key and cascading trip foreign key;
- checked position `1–8` and a unique `(trip_id, position)` constraint;
- bounded label and checked coordinates;
- creation timestamp.

The current product UI/API allows at most two stops. The wider database constraint preserves room for a future product change, but runtime validation remains authoritative for the current release.

### `trip_analyses`

Planned immutable or mostly immutable compact analysis record:

- UUID primary key;
- required trip and user foreign keys;
- risk-model and analysis-pipeline versions;
- route/weather/geocoder provider labels;
- checked decision, confidence, risk label, and 0–100 scores;
- bounded JSONB summary (maximum 256 KiB serialized text);
- analysis, expiration, and creation timestamps.

The design stores a normalized summary, not raw route/weather provider responses. The future repository must validate the JSON structure before writing and should prefer re-analysis for fresh conditions instead of treating an old forecast as current.

## Constraints and indexes

The schema foundations include:

- primary and foreign keys;
- cascade behavior for user/trip deletion;
- non-null constraints on ownership and core route/analysis fields;
- latitude/longitude ranges;
- bounded labels, email, display name, title, timezone, and JSON size;
- structured-location JSON shape/32 KiB limits, fallback consistency, and equality between JSON effective coordinates and flat coordinates for version-2 trips;
- checked decision/confidence/risk values and score ranges;
- unique identity, active email, and stop-position constraints;
- timezone-aware timestamps and server defaults;
- update-time triggers for users and trips.

Indexes match planned queries:

- active trips by `(user_id, created_at DESC, id DESC)`;
- active trips by `(user_id, updated_at DESC, id DESC)`;
- active favorites by `(user_id, favorite DESC, updated_at DESC, id DESC)`;
- analyses by `(trip_id, analyzed_at DESC, id DESC)`;
- analyses by `(user_id, analyzed_at DESC, id DESC)`.

Future cloud history should use stable keyset/cursor pagination based on the timestamp plus UUID, not unbounded offset scans.

## Ownership and row-level security

Row-level security is enabled on all four tables. Policies compare ownership with:

```sql
nullif(current_setting('app.user_id', true), '')::uuid
```

Without a valid per-transaction setting, policies evaluate without a matching owner and fail closed. Stops inherit ownership through their parent trip. Analysis rows carry `user_id` for history indexes, while a composite `(trip_id, user_id)` foreign key and an RLS parent-trip existence check prevent an analysis from pairing the current user with another user's trip.

This is defense in depth, not a complete authorization implementation. A future request transaction must:

1. verify the OIDC/session token server-side;
2. resolve the internal SnowRoute user from a trusted subject;
3. acquire a pooled connection;
4. begin a transaction;
5. set `app.user_id` locally using a parameterized mechanism;
6. execute parameterized queries that also include ownership predicates;
7. commit or roll back, ensuring the setting cannot leak to another pooled request.

The runtime application role must not own the tables and must not have `BYPASSRLS`. Consider `FORCE ROW LEVEL SECURITY` after testing the migration/maintenance role design. Administrative jobs should use a separate, tightly controlled role and explicit audit process.

Never accept `userId`, `auth_subject`, or email from the browser as proof of identity. Return `404` for an opaque trip ID that is missing or not owned, so the API does not reveal another user's record.

## Transactions

Use a transaction for operations that must remain atomic:

- create a trip, stops, and its first analysis;
- write a new analysis and update any latest-analysis pointer introduced later;
- import a deduplicated group of guest trips;
- delete a trip with associated data if not entirely handled by cascade;
- delete/anonymize account data and record completion state.

Do not hold a database transaction open while waiting on routing or weather providers. Run external analysis first, validate/bound its result, then start the shortest possible persistence transaction. If the user requests “save and analyze,” decide and document how a provider failure affects an existing saved trip.

## Migration execution

There is no migration runner in `package.json`. The SQL file should not be applied automatically merely because it exists. Before running it:

1. provision a non-production managed PostgreSQL database;
2. choose and add a maintained driver/ORM and migration system compatible with the hosting platform;
3. record checksums and migration state;
4. review the SQL with database/security owners;
5. confirm `pgcrypto` extension permissions;
6. back up any existing schema;
7. test the application role, RLS, indexes, and rollback/forward-fix plan.

For an isolated developer database only, the current foundations can be inspected/applied in order with PostgreSQL's client:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f db/migrations/0001_account_trip_history.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f db/migrations/0002_structured_trip_locations.sql
```

This command is documentation for future integration, not part of current application setup. Verify the hostname/database name interactively before running it. Never use a production URL from `.env.local`, never run tests or seed scripts against production, and never paste a credential into a shell history or commit.

The migrations have no down migrations. For a pre-release disposable database, restore/recreate from a known state. For a database containing real data, prefer a reviewed forward-fix migration; destructive rollback requires a backup, impact assessment, and explicit approval.

### Structured-location additive rollout

Migration 0002 temporarily gives `location_schema_version` a default of `1` while adding columns, so existing rows remain valid. It then drops the default: every future writer must deliberately choose version 1 or 2 rather than silently creating a legacy row.

Version-1 rows retain flat labels/coordinates and nullable structured columns. The migration does not infer a city from an old address label or reuse an arbitrary old coordinate as a city center. A version-2 row must provide both bounded structured selections, same-city/fallback flags, effective precisions, provider label, and JSON effective coordinates equal to the flat routing coordinates within `0.0000001` degrees.

Migration 0002 expects the constraint names/schema created by 0001 and must run after it. It is additive at the data level, but dropping/recreating label-length constraints still requires the usual lock/rollout review on a populated table.

The repository has not demonstrated an already-migrated database. If any environment previously applied an older copy of 0001, editing that file does not update the database. Before accounts are enabled, create a new forward migration that adds/verifies `UNIQUE (id, user_id)`, the composite analysis-to-trip foreign key, and the parent-trip RLS existence checks rather than assuming the revised 0001 was replayed.

## Environment separation

At minimum, future deployment needs separate databases and credentials for:

- local development;
- automated tests;
- preview/staging;
- production.

Use the hosting secret manager. Grant the application role only the statements/schema it needs. A migration role may own schema changes but should not be used by normal request handlers. Test configuration must include a hard guard that refuses hosts/database names designated production.

`DATABASE_URL` is reserved in `.env.example`. The account-readiness page checks only whether its name and the placeholder auth settings are present; no code opens a connection or executes a query. If the selected platform requires separate pooled and direct migration URLs, add clearly named variables only when the database adapter is implemented and document which process may use each one.

## Authentication integration requirements

Choose a maintained authentication library or managed OIDC provider that supports the Next.js version in this repository. Do not build password storage or bespoke cryptography.

Required work includes:

- issuer/audience/signature/nonce/state/PKCE validation as applicable;
- verified-email policy and account-linking rules;
- secure `HttpOnly`, `Secure`, scoped `SameSite` cookies;
- session rotation, expiration, revocation, and sign-out;
- recovery and email-change handling through the provider;
- strict redirect/callback allowlists;
- CSRF/origin protection on state-changing endpoints;
- rate limits for sign-in, callbacks, verification, import, and deletion;
- protection against session fixation and account enumeration;
- recent-authentication confirmation for account deletion;
- integration and end-to-end tests for success and failure paths.

`AUTH_ISSUER` and `AUTH_SECRET` are placeholders, not a complete provider configuration contract. Replace/extend them according to the selected, audited integration. Merely detecting their presence must never enable a sign-in button.

## Authenticated repository/API requirements

Before exposing cloud history, add a narrow server-only repository with parameterized methods such as:

- create/list/get/update/delete owned trip;
- create/list latest analysis for an owned trip;
- clear owned history;
- import guest summaries transactionally;
- begin/complete account deletion.

Handlers must derive the user from the server session, set the RLS transaction identity, enforce bounded inputs/outputs, return stable typed envelopes, and avoid caching private responses in a shared public cache. Deletion and update endpoints need CSRF/origin controls and suitable confirmation in the UI.

Authorization tests must create at least two users and prove that user A cannot read, update, delete, analyze-as-owner, enumerate, or infer the addresses of user B. Test missing session, expired/revoked session, malformed opaque ID, soft-deleted record, and RLS identity leakage across pooled connections.

## Guest-to-account import design

Import must be explicit and optional. A recommended flow:

1. Show what stays local and what would be uploaded.
2. Let the newly authenticated user select import or skip.
3. Re-validate every browser record server-side; browser storage is untrusted. Version-2 guest history carries structured endpoint intent, while migrated v1 history requires city confirmation and must not be silently promoted to cloud city selections.
4. Deduplicate by an HMAC/fingerprint of normalized coordinates and stop order, not by a public predictable ID.
5. Insert owned trips and bounded summaries in one or small bounded transactions.
6. Return per-item success/failure without duplicating a partially imported batch.
7. Clear local entries only after confirmed cloud persistence and explicit user choice.
8. Mark imported analyses with their original analysis time/model version and stale status.

Never silently upload precise local history upon sign-in.

## Retention and deletion

The schema includes `deleted_at` for users/trips and optional `expires_at` for analyses, but no scheduled purge exists. A production account release needs a published, implemented policy. A reasonable starting design is:

- exclude soft-deleted trips immediately from normal APIs;
- permanently delete them after a short documented recovery window;
- delete analyses/stops through cascades;
- permanently delete or irreversibly anonymize account records after account-deletion completion;
- expire old analysis summaries while retaining only route templates if the user chooses;
- document backup expiration and how deletion propagates to backups;
- keep operational/security logs for a separately justified, finite period;
- show “Analyzed on … Conditions may have changed” on every historical result.

Do not claim erasure while data remains indefinitely in primary tables, cleanup queues, or backups. The existing SQL alone does not satisfy permanent deletion.

## Backups and recovery

Use managed encrypted backups with access controls, regional/residency review, point-in-time recovery appropriate to the product, finite retention, and periodic restore tests. Record recovery-point and recovery-time objectives before launch.

Backups contain sensitive route data. Restrict restore permissions, log access, and never restore production data into developer environments. A restored system must preserve account deletion/retention tombstones or replay deletions before serving users.

## Seed and test data

No seed script exists. If one is added:

- generate obviously synthetic coordinates/accounts;
- never copy production addresses or identities;
- refuse to run when production markers/hosts are detected unless a separately audited administrative procedure explicitly permits it;
- keep seed rows bounded and deterministic;
- clean the isolated test database between authorization suites.

## Activation checklist

- [ ] Managed PostgreSQL instances provisioned separately for dev/test/preview/prod.
- [ ] Maintained driver/ORM and serverless-safe pooling integrated.
- [ ] Migration tooling tracks applied versions/checksums and applies 0001 before 0002.
- [ ] Migrations tested, including extension permission, structured-location constraints, indexes, composite analysis ownership, and RLS.
- [ ] Non-owner application role and separate migration role configured.
- [ ] OIDC/authentication library integrated and threat-reviewed.
- [ ] Secure session/callback/sign-out/recovery/account-deletion flows implemented.
- [ ] Parameterized authenticated repository and API added.
- [ ] Ownership derived from the verified session and set transaction-locally for RLS.
- [ ] Cross-account isolation and pooled-connection leakage tests pass.
- [ ] Auth/API rate limits and CSRF/origin controls active.
- [ ] Guest import is consent-based, bounded, transactional, and tested.
- [ ] Retention, purge, account deletion, backup, and restore procedures implemented.
- [ ] Privacy notice and data export/deletion behavior reviewed.
- [ ] Production monitoring, database alerts, and incident response configured.

Until every applicable item is complete, SnowRoute should continue to show **Continue without an account** and must not imply that cloud history is available.
