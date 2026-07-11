# Location search

SnowRoute uses a city-first location workflow for route endpoints. A traveler confirms a city, optionally selects an address, business, landmark, airport, transit location, street, intersection, or postal result within that context, and then analyzes the effective coordinates. Leaving the optional place blank is supported and explicitly routes from or to an approximate city point.

This document describes the implementation in `lib/geocoding.ts`, `lib/location.ts`, `hooks/use-location-search.ts`, and `lib/route-location-state.ts`. The older `POST /api/geocode` path remains for waypoint and compatibility search; it is not the primary origin/destination workflow.

## Confirmed causes of the previous search problems

The pre-city-first implementation followed `LocationInput → useGeocodeSearch → POST /api/geocode → openrouteservice Pelias /geocode/search`. It sent only free text, requested at most 10 mixed results, and used forward search as if it were an autocomplete endpoint. Code review and sanitized live probes confirmed several concrete problems:

- The provider received no separately confirmed city, region, country, city focus point, or administrative bounds. Unqualified street probes could return a different city or state, while structured/city-bounded probes materially improved relevance.
- Localities, streets, addresses, and venues competed in one list even though they represent different user decisions and require different context.
- Every query used unstructured forward search. Numeric addresses did not receive structured `address`, `locality`, `region`, `postalcode`, and `country` fields.
- Apartment, suite, floor, and unit suffixes were passed as part of the routable address. A unit is often not a separate geocoded or road-routable point, so literal unit text could suppress an otherwise valid building match.
- Empty arrays could remain in the page-level client cache indefinitely, while server-side empty results used the same 12-hour TTL as successful searches. Identical concurrent server searches were not coalesced.
- The flat analysis/draft contract did not carry provider bounding boxes or raw layer/confidence/source details as coherent city/place context, so those signals could not drive dependent state, membership, and ranking.
- Provider IDs alone were insufficient deduplication for repeated representations of the same street or postal area.
- Results were not classified against an explicitly selected city, so the UI could not distinguish a plausible in-city match from an outside-city result or explain why a city should change.
- Selecting a city coordinate was technically possible but was not modeled as a deliberate, visible approximation distinct from a selected place.
- Flat origin/destination draft state could restore stale coordinates and did not centrally invalidate every city-dependent selection when its parent city changed.

The prior 300 ms debounce and browser request cancellation were already present and were not the root causes. The new design keeps those protections while adding separate city/place contracts, staged provider queries, bounded positive and negative caches, in-flight coalescing, explicit membership/ranking, reducer-owned invalidation, structured draft migration, and a first-class city fallback. It cannot repair missing or stale upstream map data.

## Provider boundary and versioning

The server calls `https://api.openrouteservice.org`; browser code never receives `ORS_API_KEY`. The key is sent in the `Authorization` header, not in query strings.

The [official openrouteservice geocoder documentation](https://giscience.github.io/openrouteservice/api-reference/endpoints/geocoder/) states that the hosted geocoder is a Pelias instance and is part of the public API rather than the self-hosted openrouteservice core. SnowRoute uses:

- `GET /geocode/autocomplete` for type-ahead city search and non-address place search;
- `GET /geocode/search/structured` for address-like queries; openrouteservice documents this surface as beta;
- `GET /geocode/search` for focused/qualified fallback and the legacy waypoint search.

The hosted API also exposes reverse geocoding, but this implementation does not call it. Route coordinates always come from a selected forward-search result or the explicit city fallback.

The application identifies this dependency as `openrouteservice-pelias` in location-search API metadata and logs. It does **not** pin or discover a Pelias/geocoder version, and the URL has no geocoder version segment. The openrouteservice core version shown elsewhere in its API documentation is not evidence of the hosted Pelias version. The implementation does not call or rely on a provider details/version endpoint, and it does not request a specific result language. Upstream ranking, fields, sources, language, coverage, beta behavior, and defaults may therefore change without a SnowRoute dependency update.

SnowRoute validates only the Pelias fields it consumes and ignores additional fields. Provider responses are treated as untrusted input. A successful provider match is not proof of rooftop accuracy, current business operation, legal access, or road routability.

## User flow

For each endpoint:

1. Enter at least two city characters.
2. Wait for the 250 ms city debounce and choose a city result with region/country context.
3. Optionally enter at least two place characters after the city is confirmed.
4. Wait for the 300 ms place debounce and choose a confirmed result.
5. Leave the optional place blank to use the selected city's approximate provider point.

The destination defaults to a separate-city workflow. The traveler can enable **same city**, which reuses the confirmed starting city for destination place search. Typed text alone never becomes a selected coordinate. Editing selected city/place text clears its structured selection or dependent place before another route can be submitted.

Both the homepage launcher and full planner use the same reducer and field components. Waypoints still use the compatibility free-text geocoder and require a selected suggestion.

## City API contract

`POST /api/locations/cities`

Request:

```json
{
  "query": "Detroit",
  "countryCode": "US"
}
```

- `query`: required, trimmed, 2–120 characters.
- `countryCode`: optional 2- or 3-letter code, normalized to uppercase.
- declared request bodies above 4 KiB receive `413`.

The current UI searches globally and does not supply `countryCode`; it disambiguates with region and country labels. The contract supports a country boundary for future callers.

Success data:

```json
{
  "results": [
    {
      "providerId": "…",
      "displayName": "Detroit, Michigan, United States",
      "cityName": "Detroit",
      "regionName": "Michigan",
      "regionCode": "MI",
      "countryName": "United States",
      "countryCode": "USA",
      "postalCode": null,
      "latitude": 42.3314,
      "longitude": -83.0458,
      "boundingBox": {
        "west": -83.2878,
        "south": 42.255,
        "east": -82.9104,
        "north": 42.4502
      },
      "timezone": null,
      "precision": "locality",
      "providerConfidence": 1
    }
  ]
}
```

SnowRoute requests Pelias `locality,localadmin` layers. It requires valid coordinates, city name, country name, and country code, then returns at most 10 results. Current normalization maps `locality` to locality precision and `localadmin` to municipality precision. It does not receive a timezone from this adapter; other app logic may infer one from the chosen city context.

## Place API contract

`POST /api/locations/places`

Request:

```json
{
  "query": "100 Queen's Park, Apt 4, M5S 2C6",
  "city": {
    "providerId": "…",
    "displayName": "Toronto, Ontario, Canada",
    "cityName": "Toronto",
    "regionName": "Ontario",
    "regionCode": "ON",
    "countryName": "Canada",
    "countryCode": "CAN",
    "postalCode": null,
    "latitude": 43.6532,
    "longitude": -79.3832,
    "boundingBox": {
      "west": -79.6393,
      "south": 43.581,
      "east": -79.115,
      "north": 43.8555
    },
    "timezone": null,
    "precision": "locality",
    "providerConfidence": 1
  },
  "includeNearby": true
}
```

- `query`: required, trimmed, 2–160 characters.
- `city`: required and fully validated with the city-selection schema.
- `includeNearby`: optional; nearby results are included unless explicitly `false`.
- declared request bodies above 16 KiB receive `413`.

Success data:

```json
{
  "results": [],
  "nearbyResults": [],
  "normalizedQuery": "100 Queen's Park, Apt 4, M5S 2C6",
  "unitRoutingNote": "Routing uses the building address because Apt 4 is not a separate routable point."
}
```

`results` contains up to 10 candidates not classified as explicitly outside the selected city. It can include `WITHIN_SELECTED_CITY`, `NEAR_SELECTED_CITY`, and `CITY_MEMBERSHIP_UNKNOWN` candidates; administrative membership is a heuristic, not a polygon guarantee. `nearbyResults` contains up to five explicitly outside-city candidates within 150 km when requested. Choosing an outside candidate does not silently accept it—the UI asks the traveler to change the city or keep searching.

Every normalized place includes display/formatted text, coordinates, type, conservative precision, locality/region/country/postal context, membership classification, provider confidence/match type/source when supplied, and an optional provider ID.

### Common response envelope

Both endpoints wrap success data as:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "correlationId": "SR-…",
    "durationMs": 42,
    "cache": "hit",
    "provider": "openrouteservice-pelias"
  }
}
```

`cache` is `hit`, `miss`, or `coalesced`. Failures use the standard `{ "ok": false, "error": { … } }` envelope with a stable code, safe title/message, retryability, field, and correlation ID. Search responses include rate-limit headers and `Cache-Control: private, no-store`; a `429` also includes `Retry-After`.

## Provider query stages

### City stage

SnowRoute sends normalized city text to autocomplete with:

- layers `locality,localadmin`;
- optional `boundary.country` when the API caller supplied a country code.

### Address-like place stage

A query is address-like when it begins with a house number, resembles an intersection, or contains a supported US/Canadian postal code.

1. Normalize Unicode/punctuation/spacing.
2. Extract a supported postal code without removing the house number.
3. Send structured `address`, `locality`, optional `region`, `postalcode`, and `country` fields.
4. If a recognized unit suffix is present and the structured response has no primary eligible result, retry structured search with the unit removed.
5. If fewer than five primary eligible results remain, run the focused/qualified fallback described below.

Recognized suffixes include common apartment, unit, suite, floor, and `#` forms at the end of a numeric street address. SnowRoute preserves the user's original text for display but routes to the provider's building point and explains that the unit is not separately routable. It does not claim the provider verified a specific unit.

Canadian postal codes are normalized with a space; US ZIP and ZIP+4 formats are supported. Other national postal formats are passed through as ordinary text rather than parsed into the structured `postalcode` field.

### Named-place stage

For a business, landmark, airport, transit location, street, or postal search without an address-like pattern, SnowRoute first calls autocomplete with:

- layers `address,venue,street,postalcode`;
- the selected city as `focus.point`;
- `boundary.country` from the selected city;
- the city bounding rectangle when present and not crossing the antimeridian.

### Focused/qualified fallback

When the first stage yields fewer than five primary eligible results, SnowRoute calls forward search with a query qualified by missing city, region, and country context. It avoids duplicating context already present in pasted text. The request always has the city focus point and country boundary. It applies the city rectangle only when an earlier primary result already exists; an empty first stage is allowed a broader focused search so incomplete provider locality metadata is less likely to hide the intended result.

Results from all stages are normalized, combined, ranked, and deduplicated before limits are applied.

## Membership, ranking, and deduplication

Membership is classified in this order:

1. A conflicting normalized country code is outside.
2. A matching provider locality name is within.
3. A point inside the selected city bounding rectangle is within.
4. A region-compatible point within a tolerant city radius is near. The radius is 35–80 km based on 75% of the bounding-box diagonal, or 35 km without bounds.
5. A candidate with conflicting/available locality, region, or country context is outside.
6. A candidate without enough context is unknown.

This is deliberately tolerant because provider administrative labels and boxes are incomplete. The stricter reducer check used to preserve a selected place across city changes accepts only matching country plus matching city name or a point inside the new city bounds.

Place ranking combines:

- city relationship (`within` > `near` > `unknown` > `outside`);
- exact/prefix/contains text match;
- address preference for address-like input;
- venue/landmark/airport/transit preference for named input;
- Pelias `match_type` and confidence when present;
- distance from the selected city, with a capped penalty.

City ranking prioritizes exact city-name match, then city-name prefix, then display-name containment, plus provider confidence.

Cities are deduplicated by provider ID and a semantic key containing normalized city, region, country, and coordinates rounded to four decimals. Places are deduplicated by provider ID. Street and postal candidates also use a normalized type/address semantic key so repeated segments collapse. Distinct address/venue provider IDs are retained to avoid incorrectly merging entrances, units, or businesses.

## Place types and precision

Provider layers are normalized as follows:

| Provider signal | SnowRoute type | SnowRoute precision |
| --- | --- | --- |
| `address` | address | street |
| `street` with intersection-like input | street | intersection |
| other `street` | street | street |
| `postalcode` | postal | postal |
| `venue` with airport terms | airport | approximate |
| `venue` with transit terms | transit | approximate |
| `venue` with selected landmark/institution terms | landmark | approximate |
| other `venue` | business | approximate |
| unsupported layer | unknown | unknown |

Even a provider `accuracy=point` address is labeled street-level. The current adapter never emits rooftop, parcel, or entrance precision because the hosted response does not establish those guarantees.

## Effective endpoints and city fallback

`RouteEndpointSelection` retains both user intent and effective routing values:

- the confirmed city;
- optional confirmed place;
- effective latitude/longitude and display/formatted labels;
- `usesCityFallback`.

With a selected place, the route uses the place coordinates. Without one, it uses the city feature coordinates and labels the endpoint `Central <city>`, with `usesCityFallback: true`. “Central” means the provider's representative point; it is not guaranteed to be a civic center, downtown, safe stopping location, or city-boundary centroid.

The analysis request sends both the legacy-compatible effective label/coordinates and an `effectiveEndpoints` summary. The server verifies that both coordinate representations match within `0.000001` degrees before routing. Endpoints within 25 m are rejected as effectively identical even if their labels differ.

## Reducer transitions

`routeLocationReducer` centralizes dependent-field behavior:

- Editing or clearing a city invalidates that city selection and its dependent place.
- Changing one city in different-city mode preserves the other endpoint.
- Editing place text immediately clears the selected place/coordinates while retaining its city.
- Enabling same-city mode saves the previous different-city destination, reuses the starting city, and retains the destination place only if it belongs to the shared city under the stricter membership check.
- Disabling same-city mode restores the saved different-city destination when available.
- Destination-city edit/select/clear actions are ignored while same-city mode is active.
- Changing the shared starting city clears a destination place that does not belong to the new city and emits a notice.
- Stored reducer state is schema-validated. A stored place is kept only when it belongs to its stored city.
- Reset returns both endpoints, same-city state, saved destination, and notices to their initial values.

Cities are equivalent when provider IDs match, or when normalized city/region/country values match. Equivalence does not rely only on display text.

## Cache and request behavior

### Browser cache

A shared in-memory map stores at most 150 city/place search records:

| Result | TTL |
| --- | --- |
| non-empty city | 30 minutes |
| non-empty place | 10 minutes |
| empty city/place | 30 seconds |

Keys include mode, normalized debounced query, and country/city context. A retry removes the active client entry. Superseded requests are aborted and protected by a monotonic sequence so late responses cannot replace current results. Browser cache state is lost on reload.

### Server cache

Server keys are SHA-256 digests of normalized search/context fields. Hashing keeps precise text out of map keys and ordinary diagnostics, but it is not encryption or anonymization; values still contain provider results in process memory.

| Search | Positive TTL | Empty TTL | Maximum entries |
| --- | ---: | ---: | ---: |
| city | 12 hours | 60 seconds | 250 |
| place | 15 minutes | 30 seconds | 500 |
| legacy waypoint/geocode | 30 minutes | 30 seconds | 250 |

The oldest insertion is evicted at the cap. Identical server searches coalesce onto one in-flight provider promise and return cache status `coalesced` to additional callers. Aborting one caller stops that caller from waiting but does not cancel a shared provider request needed by other callers; the completed result can still populate the cache. Caches and in-flight registries are per process, disappear on restart, and are not shared across serverless instances.

Search API responses are `private, no-store`. Provider requests also use `cache: no-store`; the bounded application cache is the authoritative search cache. The compatibility `/api/geocode` response is also covered by the global no-store API header.

## Rate limits and resilience

All three search routes—cities, places, and legacy geocode—use the shared anonymous geocode policy of 45 requests per 60 seconds. This is a combined per-client budget, not 45 requests per route. Upstash Redis provides shared fixed-window enforcement when configured; otherwise each process uses the documented bounded in-memory fallback. See [Security and privacy](SECURITY.md).

Each Pelias request has an 8-second timeout and at most two attempts. Network failures and HTTP `408`, `429`, or `5xx` responses may receive one retry. A valid `Retry-After` delay is capped at one second; otherwise retry jitter is 100–199 ms. Invalid successful payloads and non-transient statuses fail without retry. Client/request aborts stop that caller, while shared in-flight work follows the coalescing behavior above.

Provider failures are mapped to stable SnowRoute codes and safe status classes; raw provider messages and bodies are not returned to the browser.

Current city/place request-schema failures use the general `INVALID_REQUEST` code, and provider failures use `GEOCODER_*`. The broader `START_CITY_*`, `START_PLACE_*`, `DESTINATION_CITY_*`, and `DESTINATION_PLACE_*` taxonomy supports field-level form behavior and future server mappings; callers should not assume every defined code is currently emitted by a search route.

## Observability and privacy

Successful server search logs contain correlation ID, duration, provider label, query character count, country code, result counts, and cache status. Place logs also contain nearby count and a unit-note boolean. They do not contain exact query text, formatted addresses, coordinates, provider IDs, API keys, or response payloads. The current `usedUnitFallback` log field is derived from the presence of a unit routing note; interpret it as “recognized unit suffix” rather than proof that the second structured provider request occurred.

Browser code dispatches `snowroute:location-analytics` custom events with a privacy-bounded metadata type: event/mode/endpoint, character or result counts, duration, provider label, safe country/precision/type/fallback flags, and internal error code. SnowRoute does not attach a network analytics adapter, so dispatch alone does not transmit the event. Any future listener must preserve the exclusion of query text, labels, coordinates, and provider IDs.

Exact search text and the selected city object necessarily pass through the SnowRoute server to openrouteservice. The place response also returns `normalizedQuery` to the requesting browser. Response and provider caches must not be mistaken for anonymous data merely because cache keys are hashed.

## Guest history and draft migration

New guest history records use schema version 2 and require structured origin/destination endpoints. They persist city/place intent, effective coordinates, fallback flags, same-city mode, provider label, compact analysis fields, and at most two legacy-format waypoints. The normal 20-entry limit, validation, deletion, and stale-analysis warnings still apply.

Version-1 history is read without inventing city selections. Valid legacy labels/coordinates become v2 compatibility fields, `requiresCityConfirmation` is set, the untrusted old fingerprint is recomputed, and the route remains displayable. Re-analysis requires both cities to be confirmed; old address coordinates are not silently reused as city centers.

IndexedDB database version 2 reuses the `trip-history` object store. On the first successful read, valid IndexedDB/localStorage v1 and v2 records are merged, normalized, deduplicated, rewritten as v2, and legacy localStorage is removed only after the rewrite succeeds. If rewriting fails, parsed entries are returned and the old source remains for retry. Restore queues read and clear both v2 and v1 keys.

Trip drafts use schema version 3. A valid legacy v2 draft can preserve text and selections that are provably city features, but every legacy draft path is marked for location confirmation because it does not prove city-first structured state. Homepage launch payloads use v2, expire after 10 minutes, and read the legacy v1 launch key for compatibility.

Provider IDs are useful provenance but may become stale. Valid saved coordinates are preserved; re-analysis does not automatically re-geocode every structured history record. Users are shown the prior-analysis timestamp and should review endpoints before requesting a fresh forecast.

## Database rollout

`db/migrations/0002_structured_trip_locations.sql` is an additive, inactive PostgreSQL foundation for future cloud persistence. It preserves flat effective labels/coordinates for compatibility and adds bounded structured selections, schema version, same-city/fallback flags, effective precision, and geocoder-provider fields. It deliberately leaves existing rows as version 1 instead of fabricating city/place structure. See [Database and account readiness](DATABASE.md).

No current request handler opens PostgreSQL. The SQL file is not evidence of deployed storage or account support.

## Tests

Run the focused location suite:

```bash
npm run test -- \
  tests/location-search.test.ts \
  tests/location-search-provider.test.ts \
  tests/location-search-api.test.ts \
  tests/route-location-state.test.ts \
  tests/guest-trip-history.test.ts
```

The suite covers normalization, unit/postal handling, qualified queries, duplicate city names, membership, ranking/deduplication, endpoint fallback, request schemas, provider headers/stages, in-flight coalescing, retry/negative expiry, safe API metadata, reducer invalidation/same-city restoration, and history migration.

Provider adapter tests use mocked responses. They verify SnowRoute behavior but do not prove that the live hosted Pelias dataset or beta structured endpoint currently returns a particular address.

Before release, also run:

```bash
npm run test
npm run lint
npm run build
```

## Deployment checklist

1. Configure a server-only `ORS_API_KEY` separately for preview and production.
2. Configure `RATE_LIMIT_SALT` and shared Upstash Redis values for a multi-instance production deployment.
3. Run the focused suite, full tests, lint, and production build.
4. Use a preview deployment to smoke-test duplicate city names, same-city transitions, a named place, an exact numeric address, US and Canadian postal forms, a unit suffix, outside-city warning, explicit city fallback, cancellation, empty results, provider failure, and keyboard/mobile behavior.
5. Verify `Cache-Control: private, no-store`, rate-limit headers, typed errors, and that logs/events contain no search text or coordinates.
6. Monitor provider latency, `429`/timeout/unavailable errors, cache hit/coalesced ratios, empty-result rates, outside-city warnings, and city-fallback usage without adding precise location data.
7. Treat hosted geocoder changes as a compatibility risk because no Pelias version is pinned. Re-run contract/smoke tests after provider announcements or unexplained result shifts.
8. Keep account/database controls disabled unless the separate requirements in `DATABASE.md` are implemented and audited.

Working on or pushing a feature branch does not deploy the production site.

## Known limitations

- Exact address, venue, postal, and city coverage depends on the hosted Pelias datasets and can be missing, stale, duplicated, or differently ranked.
- The structured endpoint is beta, and SnowRoute does not pin or report its Pelias version.
- City membership uses names, rectangular bounds, region compatibility, and distance—not authoritative municipal polygons.
- The current UI has no country selector for city search; users disambiguate by region/country context.
- Only US and Canadian postal patterns receive dedicated extraction.
- Unit text is not separately routed; the building/provider point is used.
- City fallback is an approximate provider point, not a verified downtown or stopping facility.
- Search and legacy waypoint caches are per instance; Redis is used for rate limiting, not shared result caching.
- Restored structured endpoints are not automatically re-geocoded, so provider IDs or coordinates may outlive upstream changes.
- The analysis request receives effective endpoint summaries rather than the full city/place selections. It verifies duplicate coordinate representations but cannot independently re-run city-membership or provider-ID checks.
- Provider tests are mocked; deployment smoke tests remain necessary.
- Accounts and cloud persistence remain unavailable.
