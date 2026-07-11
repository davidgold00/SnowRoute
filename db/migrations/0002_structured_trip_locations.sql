-- Additive structured-location foundation for the city-first route flow.
-- Existing flat labels/coordinates remain the effective routing values and the
-- compatibility read path. Version-1 rows are not guessed or destructively backfilled.

BEGIN;

ALTER TABLE trips
  DROP CONSTRAINT trips_origin_label_length,
  DROP CONSTRAINT trips_destination_label_length,
  ALTER COLUMN origin_label TYPE varchar(240),
  ALTER COLUMN destination_label TYPE varchar(240),
  ADD COLUMN location_schema_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN origin_selection jsonb,
  ADD COLUMN destination_selection jsonb,
  ADD COLUMN same_city boolean,
  ADD COLUMN origin_uses_city_fallback boolean,
  ADD COLUMN destination_uses_city_fallback boolean,
  ADD COLUMN origin_effective_precision varchar(24),
  ADD COLUMN destination_effective_precision varchar(24),
  ADD COLUMN geocoder_provider varchar(80),
  ADD CONSTRAINT trips_origin_label_length
    CHECK (length(origin_label) BETWEEN 1 AND 240),
  ADD CONSTRAINT trips_destination_label_length
    CHECK (length(destination_label) BETWEEN 1 AND 240),
  ADD CONSTRAINT trips_location_schema_version
    CHECK (location_schema_version IN (1, 2)),
  ADD CONSTRAINT trips_origin_selection_object
    CHECK (origin_selection IS NULL OR jsonb_typeof(origin_selection) = 'object'),
  ADD CONSTRAINT trips_destination_selection_object
    CHECK (destination_selection IS NULL OR jsonb_typeof(destination_selection) = 'object'),
  ADD CONSTRAINT trips_origin_selection_bounded
    CHECK (origin_selection IS NULL OR octet_length(origin_selection::text) <= 32768),
  ADD CONSTRAINT trips_destination_selection_bounded
    CHECK (destination_selection IS NULL OR octet_length(destination_selection::text) <= 32768),
  ADD CONSTRAINT trips_origin_selection_shape
    CHECK (
      origin_selection IS NULL OR COALESCE((
        jsonb_typeof(origin_selection -> 'city') = 'object'
        AND jsonb_typeof(origin_selection -> 'effectiveLatitude') = 'number'
        AND jsonb_typeof(origin_selection -> 'effectiveLongitude') = 'number'
        AND jsonb_typeof(origin_selection -> 'effectiveDisplayName') = 'string'
        AND jsonb_typeof(origin_selection -> 'effectiveFormattedAddress') = 'string'
        AND jsonb_typeof(origin_selection -> 'usesCityFallback') = 'boolean'
      ), false)
    ),
  ADD CONSTRAINT trips_destination_selection_shape
    CHECK (
      destination_selection IS NULL OR COALESCE((
        jsonb_typeof(destination_selection -> 'city') = 'object'
        AND jsonb_typeof(destination_selection -> 'effectiveLatitude') = 'number'
        AND jsonb_typeof(destination_selection -> 'effectiveLongitude') = 'number'
        AND jsonb_typeof(destination_selection -> 'effectiveDisplayName') = 'string'
        AND jsonb_typeof(destination_selection -> 'effectiveFormattedAddress') = 'string'
        AND jsonb_typeof(destination_selection -> 'usesCityFallback') = 'boolean'
      ), false)
    ),
  ADD CONSTRAINT trips_origin_effective_precision
    CHECK (
      origin_effective_precision IS NULL OR origin_effective_precision IN (
        'city', 'municipality', 'town', 'village', 'locality',
        'rooftop', 'parcel', 'entrance', 'street', 'intersection',
        'postal', 'approximate', 'unknown'
      )
    ),
  ADD CONSTRAINT trips_destination_effective_precision
    CHECK (
      destination_effective_precision IS NULL OR destination_effective_precision IN (
        'city', 'municipality', 'town', 'village', 'locality',
        'rooftop', 'parcel', 'entrance', 'street', 'intersection',
        'postal', 'approximate', 'unknown'
      )
    ),
  ADD CONSTRAINT trips_geocoder_provider_length
    CHECK (geocoder_provider IS NULL OR length(geocoder_provider) BETWEEN 1 AND 80),
  ADD CONSTRAINT trips_structured_location_completeness
    CHECK (
      location_schema_version = 1 OR (
        origin_selection IS NOT NULL
        AND destination_selection IS NOT NULL
        AND same_city IS NOT NULL
        AND origin_uses_city_fallback IS NOT NULL
        AND destination_uses_city_fallback IS NOT NULL
        AND origin_effective_precision IS NOT NULL
        AND destination_effective_precision IS NOT NULL
        AND geocoder_provider IS NOT NULL
        AND origin_selection -> 'usesCityFallback' = to_jsonb(origin_uses_city_fallback)
        AND destination_selection -> 'usesCityFallback' = to_jsonb(destination_uses_city_fallback)
        AND abs(
          (origin_selection ->> 'effectiveLatitude')::double precision - origin_lat
        ) < 0.0000001
        AND abs(
          (origin_selection ->> 'effectiveLongitude')::double precision - origin_lon
        ) < 0.0000001
        AND abs(
          (destination_selection ->> 'effectiveLatitude')::double precision - destination_lat
        ) < 0.0000001
        AND abs(
          (destination_selection ->> 'effectiveLongitude')::double precision - destination_lon
        ) < 0.0000001
      )
    );

-- Existing rows retain version 1. Future writers must deliberately choose and
-- validate a schema version rather than relying on a silent legacy default.
ALTER TABLE trips
  ALTER COLUMN location_schema_version DROP DEFAULT;

COMMENT ON COLUMN trips.origin_selection IS
  'Validated city-first RouteEndpointSelection JSON; NULL only for legacy schema-version-1 rows.';
COMMENT ON COLUMN trips.destination_selection IS
  'Validated city-first RouteEndpointSelection JSON; NULL only for legacy schema-version-1 rows.';
COMMENT ON COLUMN trips.origin_lat IS
  'Effective routing latitude retained for compatibility and route lookup.';
COMMENT ON COLUMN trips.destination_lat IS
  'Effective routing latitude retained for compatibility and route lookup.';

COMMIT;
