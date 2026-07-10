-- SnowRoute optional account persistence foundation.
-- This migration is intentionally not activated by the application until a managed
-- PostgreSQL database and an audited OIDC session provider are configured.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE snowroute_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject varchar(255) NOT NULL UNIQUE,
  email varchar(320) NOT NULL,
  display_name varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT snowroute_users_email_not_blank CHECK (length(btrim(email)) BETWEEN 3 AND 320),
  CONSTRAINT snowroute_users_display_name_length CHECK (
    display_name IS NULL OR length(display_name) BETWEEN 1 AND 120
  )
);

CREATE UNIQUE INDEX snowroute_users_email_unique_active
  ON snowroute_users (lower(email))
  WHERE deleted_at IS NULL;

CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES snowroute_users(id) ON DELETE CASCADE,
  title varchar(150),
  origin_label varchar(180) NOT NULL,
  origin_lat double precision NOT NULL,
  origin_lon double precision NOT NULL,
  destination_label varchar(180) NOT NULL,
  destination_lat double precision NOT NULL,
  destination_lon double precision NOT NULL,
  planned_departure_at timestamptz NOT NULL,
  client_time_zone varchar(80) NOT NULL,
  route_fingerprint char(64),
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT trips_title_length CHECK (title IS NULL OR length(title) BETWEEN 1 AND 150),
  CONSTRAINT trips_origin_label_length CHECK (length(origin_label) BETWEEN 1 AND 180),
  CONSTRAINT trips_destination_label_length CHECK (length(destination_label) BETWEEN 1 AND 180),
  CONSTRAINT trips_origin_latitude CHECK (origin_lat BETWEEN -90 AND 90),
  CONSTRAINT trips_origin_longitude CHECK (origin_lon BETWEEN -180 AND 180),
  CONSTRAINT trips_destination_latitude CHECK (destination_lat BETWEEN -90 AND 90),
  CONSTRAINT trips_destination_longitude CHECK (destination_lon BETWEEN -180 AND 180),
  CONSTRAINT trips_time_zone_length CHECK (length(client_time_zone) BETWEEN 1 AND 80),
  CONSTRAINT trips_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE trip_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  label varchar(180) NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_stops_position CHECK (position BETWEEN 1 AND 8),
  CONSTRAINT trip_stops_label_length CHECK (length(label) BETWEEN 1 AND 180),
  CONSTRAINT trip_stops_latitude CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT trip_stops_longitude CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT trip_stops_unique_position UNIQUE (trip_id, position)
);

CREATE TABLE trip_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES snowroute_users(id) ON DELETE CASCADE,
  risk_model_version varchar(40) NOT NULL,
  analysis_version varchar(40) NOT NULL,
  weather_provider varchar(80) NOT NULL,
  route_provider varchar(80) NOT NULL,
  geocoder_provider varchar(80) NOT NULL,
  decision varchar(12) NOT NULL,
  confidence varchar(12) NOT NULL,
  overall_risk varchar(12) NOT NULL,
  overall_score smallint NOT NULL,
  worst_segment_score smallint NOT NULL,
  summary jsonb NOT NULL,
  analyzed_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_analyses_decision CHECK (decision IN ('GO', 'CAUTION', 'DELAY', 'HOLD', 'AVOID')),
  CONSTRAINT trip_analyses_confidence CHECK (confidence IN ('High', 'Medium', 'Low')),
  CONSTRAINT trip_analyses_overall_risk CHECK (overall_risk IN ('Low', 'Moderate', 'High', 'Severe')),
  CONSTRAINT trip_analyses_score CHECK (overall_score BETWEEN 0 AND 100),
  CONSTRAINT trip_analyses_worst_score CHECK (worst_segment_score BETWEEN 0 AND 100),
  CONSTRAINT trip_analyses_summary_is_object CHECK (jsonb_typeof(summary) = 'object'),
  CONSTRAINT trip_analyses_summary_bounded CHECK (octet_length(summary::text) <= 262144),
  CONSTRAINT trip_analyses_owned_trip_fk
    FOREIGN KEY (trip_id, user_id) REFERENCES trips(id, user_id) ON DELETE CASCADE
);

CREATE INDEX trips_user_created_active_idx
  ON trips (user_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX trips_user_updated_active_idx
  ON trips (user_id, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX trips_user_favorite_active_idx
  ON trips (user_id, favorite DESC, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX trip_analyses_trip_analyzed_idx
  ON trip_analyses (trip_id, analyzed_at DESC, id DESC);
CREATE INDEX trip_analyses_user_analyzed_idx
  ON trip_analyses (user_id, analyzed_at DESC, id DESC);

CREATE FUNCTION snowroute_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER snowroute_users_set_updated_at
  BEFORE UPDATE ON snowroute_users
  FOR EACH ROW EXECUTE FUNCTION snowroute_set_updated_at();
CREATE TRIGGER trips_set_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION snowroute_set_updated_at();

-- Runtime queries must set app.user_id from the verified server session inside
-- the transaction. The policies make a missed ownership predicate fail closed.
ALTER TABLE snowroute_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY snowroute_users_own_row ON snowroute_users
  USING (id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY trips_owner_only ON trips
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY trip_stops_owner_only ON trip_stops
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_stops.trip_id
        AND trips.user_id = nullif(current_setting('app.user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_stops.trip_id
        AND trips.user_id = nullif(current_setting('app.user_id', true), '')::uuid
    )
  );

CREATE POLICY trip_analyses_owner_only ON trip_analyses
  USING (
    user_id = nullif(current_setting('app.user_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_analyses.trip_id
        AND trips.user_id = trip_analyses.user_id
    )
  )
  WITH CHECK (
    user_id = nullif(current_setting('app.user_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_analyses.trip_id
        AND trips.user_id = trip_analyses.user_id
    )
  );

COMMIT;
