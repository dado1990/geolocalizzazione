# Database Schema & Migrations

## 1. SCHEMA OVERVIEW

Database: PostgreSQL 15+ con estensioni PostGIS, uuid-ossp, pg_trgm

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   users     │       │   devices    │       │    buses    │
│─────────────│       │──────────────│       │─────────────│
│ id (PK)     │       │ id (PK)      │       │ id (PK)     │
│ email       │       │ uuid (UQ)    │◄──────│ device_id   │
│ password    │       │ token_hash   │       │ line_id     │
│ role        │       │ status       │       │ label       │
│ active      │       │ last_seen_at │       │ plate       │
└─────────────┘       │ metadata     │       │ status      │
                      └──────────────┘       │ metadata    │
                                             └──────┬──────┘
                                                    │
┌─────────────┐       ┌──────────────┐            │
│   lines     │       │   routes     │            │
│─────────────│       │──────────────│            │
│ id (PK)     │◄──────│ line_id (FK) │◄───────────┘
│ name        │       │ name         │
│ code (UQ)   │       │ direction    │
│ color       │       │ polyline     │
│ active      │       │ active_from  │
└─────────────┘       │ active_to    │
                      │ metadata     │
                      └──────┬───────┘
                             │
                  ┌──────────┴───────────┐
                  │                      │
          ┌───────▼───────┐    ┌────────▼────────┐
          │ route_stops   │    │     stops       │
          │───────────────│    │─────────────────│
          │ route_id (FK) │    │ id (PK)         │
          │ stop_id (FK)  │◄───│ name            │
          │ sequence      │    │ code (UQ)       │
          │ metadata      │    │ point (GEOMETRY)│
          └───────────────┘    │ address         │
                               │ active          │
                               │ metadata        │
                               └─────────────────┘

┌──────────────────┐       ┌──────────────────────┐
│   locations      │       │   last_positions     │
│──────────────────│       │──────────────────────│
│ id (PK)          │       │ device_id (PK/UQ)    │
│ device_id (FK)   │       │ bus_id               │
│ bus_id (FK)      │       │ point (GEOMETRY)     │
│ point (GEOMETRY) │       │ latitude             │
│ latitude         │       │ longitude            │
│ longitude        │       │ accuracy             │
│ accuracy         │       │ speed                │
│ altitude         │       │ heading              │
│ speed            │       │ provider             │
│ heading          │       │ battery_level        │
│ provider         │       │ network_type         │
│ battery_level    │       │ timestamp            │
│ network_type     │       │ updated_at           │
│ timestamp        │       └──────────────────────┘
│ created_at       │
│ metadata         │
└──────────────────┘

┌──────────────────┐
│   audit_logs     │
│──────────────────│
│ id (PK)          │
│ user_id          │
│ action           │
│ resource_type    │
│ resource_id      │
│ changes (JSONB)  │
│ ip_address       │
│ created_at       │
└──────────────────┘
```

## 2. DDL COMPLETO

### 2.1 Extensions

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify PostGIS installation
SELECT PostGIS_Version();
```

### 2.2 Custom Types

```sql
-- User roles enum
CREATE TYPE user_role AS ENUM ('admin', 'operator');

-- Device status enum
CREATE TYPE device_status AS ENUM ('active', 'inactive', 'revoked');

-- Bus status enum
CREATE TYPE bus_status AS ENUM ('active', 'inactive', 'maintenance');

-- Route direction enum
CREATE TYPE route_direction AS ENUM ('outbound', 'inbound');

-- Location provider enum
CREATE TYPE location_provider AS ENUM ('gps', 'network', 'fused');

-- Network type enum
CREATE TYPE network_type AS ENUM ('wifi', 'cellular', 'none');

-- Bus movement status enum
CREATE TYPE bus_movement_status AS ENUM ('moving', 'stopped', 'offline');
```

### 2.3 Tables

#### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role user_role NOT NULL DEFAULT 'operator',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role) WHERE active = true;

-- Comments
COMMENT ON TABLE users IS 'Utenti del sistema (admin, operatori)';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt della password';
```

#### Devices Table
```sql
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE,
  token_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255),
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('android', 'ios')),
  app_version VARCHAR(50),
  device_model VARCHAR(255),
  os_version VARCHAR(100),
  status device_status NOT NULL DEFAULT 'active',
  last_seen_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_devices_uuid ON devices(uuid);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at DESC) WHERE status = 'active';
CREATE INDEX idx_devices_metadata ON devices USING GIN(metadata);

-- Comments
COMMENT ON TABLE devices IS 'Dispositivi mobili a bordo autobus';
COMMENT ON COLUMN devices.token_hash IS 'Hash SHA256 del JWT token';
COMMENT ON COLUMN devices.last_seen_at IS 'Ultimo ping ricevuto';
```

#### Lines Table
```sql
CREATE TABLE lines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7), -- HEX color #RRGGBB
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_lines_code ON lines(code);
CREATE INDEX idx_lines_active ON lines(active);

-- Comments
COMMENT ON TABLE lines IS 'Linee di trasporto pubblico';
COMMENT ON COLUMN lines.code IS 'Codice alfanumerico univoco (es. L05)';
```

#### Buses Table
```sql
CREATE TABLE buses (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  plate VARCHAR(50),
  device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  line_id INTEGER REFERENCES lines(id) ON DELETE SET NULL,
  status bus_status NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_device_per_bus UNIQUE(device_id)
);

-- Indexes
CREATE INDEX idx_buses_device_id ON buses(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX idx_buses_line_id ON buses(line_id) WHERE line_id IS NOT NULL;
CREATE INDEX idx_buses_status ON buses(status);
CREATE INDEX idx_buses_plate ON buses(plate);

-- Comments
COMMENT ON TABLE buses IS 'Autobus della flotta';
COMMENT ON COLUMN buses.label IS 'Nome identificativo visibile (es. Bus 42)';
COMMENT ON COLUMN buses.device_id IS 'Dispositivo attualmente associato';
```

#### Stops Table
```sql
CREATE TABLE stops (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  point GEOMETRY(Point, 4326) NOT NULL,
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stops_point ON stops USING GIST(point);
CREATE INDEX idx_stops_code ON stops(code) WHERE code IS NOT NULL;
CREATE INDEX idx_stops_active ON stops(active);

-- Trigger per auto-populate point da lat/lng
CREATE OR REPLACE FUNCTION update_stop_point()
RETURNS TRIGGER AS $$
BEGIN
  NEW.point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stop_point
BEFORE INSERT OR UPDATE OF latitude, longitude ON stops
FOR EACH ROW
EXECUTE FUNCTION update_stop_point();

-- Comments
COMMENT ON TABLE stops IS 'Fermate/punti di interesse lungo i percorsi';
COMMENT ON COLUMN stops.point IS 'Geometria PostGIS (SRID 4326 - WGS84)';
```

#### Routes Table
```sql
CREATE TABLE routes (
  id SERIAL PRIMARY KEY,
  line_id INTEGER NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  direction route_direction,
  polyline TEXT NOT NULL, -- Encoded polyline (Google format)
  active_from DATE,
  active_to DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_date_range CHECK (active_to IS NULL OR active_from IS NULL OR active_to >= active_from)
);

-- Indexes
CREATE INDEX idx_routes_line_id ON routes(line_id);
CREATE INDEX idx_routes_active_period ON routes(active_from, active_to);
CREATE INDEX idx_routes_metadata ON routes USING GIN(metadata);

-- Comments
COMMENT ON TABLE routes IS 'Percorsi delle linee (con varianti e direzioni)';
COMMENT ON COLUMN routes.polyline IS 'Polyline codificata (Google Encoded Polyline)';
COMMENT ON COLUMN routes.direction IS 'Andata (outbound) o Ritorno (inbound)';
```

#### Route_Stops Junction Table
```sql
CREATE TABLE route_stops (
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  metadata JSONB DEFAULT '{}', -- es. tempo stimato, distanza

  PRIMARY KEY (route_id, stop_id),
  CONSTRAINT unique_sequence_per_route UNIQUE(route_id, sequence)
);

-- Indexes
CREATE INDEX idx_route_stops_route ON route_stops(route_id, sequence);
CREATE INDEX idx_route_stops_stop ON route_stops(stop_id);

-- Comments
COMMENT ON TABLE route_stops IS 'Associazione percorso-fermate con ordine di sequenza';
COMMENT ON COLUMN route_stops.sequence IS 'Ordine fermata nel percorso (0-based)';
```

#### Locations Table (Partitioned)
```sql
CREATE TABLE locations (
  id BIGSERIAL,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  bus_id INTEGER REFERENCES buses(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  point GEOMETRY(Point, 4326) NOT NULL,
  accuracy REAL CHECK (accuracy > 0),
  altitude REAL,
  speed REAL CHECK (speed >= 0),
  heading REAL CHECK (heading >= 0 AND heading < 360),
  provider location_provider,
  battery_level SMALLINT CHECK (battery_level >= 0 AND battery_level <= 100),
  network_type network_type,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',

  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next 3 months
CREATE TABLE locations_2026_02 PARTITION OF locations
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE locations_2026_03 PARTITION OF locations
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE locations_2026_04 PARTITION OF locations
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- Indexes (create on each partition or on parent)
CREATE INDEX idx_locations_device_time ON locations(device_id, created_at DESC);
CREATE INDEX idx_locations_bus_time ON locations(bus_id, created_at DESC) WHERE bus_id IS NOT NULL;
CREATE INDEX idx_locations_point ON locations USING GIST(point);
CREATE INDEX idx_locations_timestamp ON locations(timestamp DESC);

-- Trigger per auto-populate point
CREATE OR REPLACE FUNCTION update_location_point()
RETURNS TRIGGER AS $$
BEGIN
  NEW.point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_location_point
BEFORE INSERT OR UPDATE OF latitude, longitude ON locations
FOR EACH ROW
EXECUTE FUNCTION update_location_point();

-- Comments
COMMENT ON TABLE locations IS 'Storico posizioni GPS (partitioned by month)';
COMMENT ON COLUMN locations.timestamp IS 'Timestamp GPS dal dispositivo';
COMMENT ON COLUMN locations.created_at IS 'Timestamp server ricezione';
```

#### Last_Positions Table
```sql
CREATE TABLE last_positions (
  device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  bus_id INTEGER REFERENCES buses(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  point GEOMETRY(Point, 4326) NOT NULL,
  accuracy REAL,
  altitude REAL,
  speed REAL,
  heading REAL,
  provider location_provider,
  battery_level SMALLINT,
  network_type network_type,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_last_positions_bus ON last_positions(bus_id) WHERE bus_id IS NOT NULL;
CREATE INDEX idx_last_positions_updated ON last_positions(updated_at DESC);
CREATE INDEX idx_last_positions_point ON last_positions USING GIST(point);

-- Trigger per auto-populate point
CREATE TRIGGER trigger_update_last_position_point
BEFORE INSERT OR UPDATE OF latitude, longitude ON last_positions
FOR EACH ROW
EXECUTE FUNCTION update_location_point();

-- Comments
COMMENT ON TABLE last_positions IS 'Ultima posizione nota per ogni dispositivo (cache rapida)';
```

#### Audit_Logs Table
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- CREATE, UPDATE, DELETE, LOGIN
  resource_type VARCHAR(100), -- buses, routes, lines, etc.
  resource_id INTEGER,
  changes JSONB, -- { before: {...}, after: {...} }
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_changes ON audit_logs USING GIN(changes);

-- Comments
COMMENT ON TABLE audit_logs IS 'Log di audit per azioni amministrative';
```

#### Nonces Table (Anti-Replay)
```sql
CREATE TABLE nonces (
  nonce UUID PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes
CREATE INDEX idx_nonces_device ON nonces(device_id);
CREATE INDEX idx_nonces_expires ON nonces(expires_at);

-- Auto-cleanup expired nonces (via cron job)
-- DELETE FROM nonces WHERE expires_at < NOW();

-- Comments
COMMENT ON TABLE nonces IS 'Nonces per prevenzione replay attacks (TTL 10 min)';
```

## 3. VIEWS

### 3.1 Fleet Status View
```sql
CREATE OR REPLACE VIEW v_fleet_status AS
SELECT
  b.id AS bus_id,
  b.label,
  b.plate,
  b.status AS bus_status,
  l.id AS line_id,
  l.name AS line_name,
  l.code AS line_code,
  lp.latitude,
  lp.longitude,
  lp.speed,
  lp.heading,
  lp.battery_level,
  lp.timestamp AS last_gps_timestamp,
  lp.updated_at AS last_update,
  CASE
    WHEN lp.updated_at IS NULL THEN 'offline'::bus_movement_status
    WHEN lp.updated_at < NOW() - INTERVAL '5 minutes' THEN 'offline'::bus_movement_status
    WHEN lp.speed IS NULL OR lp.speed < 1 THEN 'stopped'::bus_movement_status
    ELSE 'moving'::bus_movement_status
  END AS movement_status,
  CASE
    WHEN lp.updated_at IS NULL THEN 'none'
    WHEN lp.updated_at < NOW() - INTERVAL '5 minutes' THEN 'none'
    WHEN lp.updated_at < NOW() - INTERVAL '3 minutes' THEN 'weak'
    WHEN lp.updated_at < NOW() - INTERVAL '150 seconds' THEN 'medium'
    ELSE 'strong'
  END AS signal_strength,
  d.id AS device_id,
  d.uuid AS device_uuid
FROM buses b
LEFT JOIN lines l ON b.line_id = l.id
LEFT JOIN devices d ON b.device_id = d.id
LEFT JOIN last_positions lp ON d.id = lp.device_id
WHERE b.status = 'active';

COMMENT ON VIEW v_fleet_status IS 'Vista consolidata stato flotta per API /fleet/live';
```

### 3.2 Route Details View
```sql
CREATE OR REPLACE VIEW v_route_details AS
SELECT
  r.id AS route_id,
  r.name AS route_name,
  r.direction,
  r.polyline,
  r.active_from,
  r.active_to,
  l.id AS line_id,
  l.name AS line_name,
  l.code AS line_code,
  l.color AS line_color,
  json_agg(
    json_build_object(
      'stop_id', s.id,
      'name', s.name,
      'code', s.code,
      'latitude', s.latitude,
      'longitude', s.longitude,
      'sequence', rs.sequence
    ) ORDER BY rs.sequence
  ) AS stops
FROM routes r
JOIN lines l ON r.line_id = l.id
LEFT JOIN route_stops rs ON r.id = rs.route_id
LEFT JOIN stops s ON rs.stop_id = s.id
GROUP BY r.id, r.name, r.direction, r.polyline, r.active_from, r.active_to,
         l.id, l.name, l.code, l.color;

COMMENT ON VIEW v_route_details IS 'Vista percorsi con fermate aggregate (JSON)';
```

## 4. FUNCTIONS

### 4.1 Offline Bus Detection
```sql
CREATE OR REPLACE FUNCTION detect_offline_buses(threshold_minutes INTEGER DEFAULT 5)
RETURNS TABLE(bus_id INTEGER, last_seen TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    lp.updated_at
  FROM buses b
  JOIN devices d ON b.device_id = d.id
  LEFT JOIN last_positions lp ON d.id = lp.device_id
  WHERE b.status = 'active'
    AND (lp.updated_at IS NULL OR lp.updated_at < NOW() - (threshold_minutes || ' minutes')::INTERVAL);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_offline_buses IS 'Identifica bus senza segnale da N minuti';
```

### 4.2 Distance Calculation
```sql
CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  point1 GEOMETRY;
  point2 GEOMETRY;
BEGIN
  point1 := ST_SetSRID(ST_MakePoint(lon1, lat1), 4326);
  point2 := ST_SetSRID(ST_MakePoint(lon2, lat2), 4326);
  RETURN ST_DistanceSphere(point1, point2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_distance_meters IS 'Calcola distanza in metri tra due coordinate';
```

### 4.3 Nearest Stop Finder
```sql
CREATE OR REPLACE FUNCTION find_nearest_stop(
  input_lat DOUBLE PRECISION,
  input_lon DOUBLE PRECISION,
  max_distance_meters DOUBLE PRECISION DEFAULT 500
)
RETURNS TABLE(
  stop_id INTEGER,
  stop_name VARCHAR,
  distance_meters DOUBLE PRECISION
) AS $$
DECLARE
  input_point GEOMETRY;
BEGIN
  input_point := ST_SetSRID(ST_MakePoint(input_lon, input_lat), 4326);

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    ST_DistanceSphere(s.point, input_point) AS distance
  FROM stops s
  WHERE s.active = true
    AND ST_DWithin(s.point::geography, input_point::geography, max_distance_meters)
  ORDER BY s.point <-> input_point
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_nearest_stop IS 'Trova fermata più vicina a coordinate date';
```

## 5. TRIGGERS

### 5.1 Update Timestamp Trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_buses_updated_at
BEFORE UPDATE ON buses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_lines_updated_at
BEFORE UPDATE ON lines
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_routes_updated_at
BEFORE UPDATE ON routes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_stops_updated_at
BEFORE UPDATE ON stops
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
```

### 5.2 Audit Log Trigger
```sql
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs(user_id, action, resource_type, resource_id, changes)
    VALUES (
      current_setting('app.current_user_id', true)::INTEGER,
      'DELETE',
      TG_TABLE_NAME,
      OLD.id,
      jsonb_build_object('before', row_to_json(OLD))
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs(user_id, action, resource_type, resource_id, changes)
    VALUES (
      current_setting('app.current_user_id', true)::INTEGER,
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW))
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs(user_id, action, resource_type, resource_id, changes)
    VALUES (
      current_setting('app.current_user_id', true)::INTEGER,
      'CREATE',
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object('after', row_to_json(NEW))
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply to critical tables
CREATE TRIGGER trigger_audit_buses
AFTER INSERT OR UPDATE OR DELETE ON buses
FOR EACH ROW
EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trigger_audit_lines
AFTER INSERT OR UPDATE OR DELETE ON lines
FOR EACH ROW
EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trigger_audit_routes
AFTER INSERT OR UPDATE OR DELETE ON routes
FOR EACH ROW
EXECUTE FUNCTION audit_table_changes();
```

## 6. INDEXES SUMMARY

### Performance-Critical Indexes
```sql
-- Most queried endpoints
CREATE INDEX CONCURRENTLY idx_last_positions_bus_updated
  ON last_positions(bus_id, updated_at DESC) WHERE bus_id IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_locations_recent
  ON locations(created_at DESC) WHERE created_at > NOW() - INTERVAL '7 days';

-- Geospatial queries
CREATE INDEX CONCURRENTLY idx_stops_point_geography
  ON stops USING GIST(point::geography);

-- Frequent joins
CREATE INDEX CONCURRENTLY idx_buses_line_status
  ON buses(line_id, status) WHERE status = 'active';
```

## 7. SAMPLE DATA

```sql
-- Insert sample admin user (password: Admin123!)
INSERT INTO users (email, password_hash, name, role) VALUES
('admin@bustracker.local', '$2b$10$XYZ...', 'System Admin', 'admin');

-- Insert sample line
INSERT INTO lines (name, code, color, active) VALUES
('Linea Centro-Periferia', 'L05', '#FF5733', true);

-- Insert sample stops
INSERT INTO stops (name, code, latitude, longitude) VALUES
('Piazza Duomo', 'PD01', 45.4642, 9.1900),
('Stazione Centrale', 'SC02', 45.4869, 9.2049),
('Porta Garibaldi', 'PG03', 45.4844, 9.1882);

-- Insert sample device
INSERT INTO devices (uuid, token_hash, platform, app_version, status) VALUES
('550e8400-e29b-41d4-a716-446655440000',
 'abc123hash',
 'android',
 '1.0.0',
 'active');

-- Insert sample bus
INSERT INTO buses (label, plate, device_id, line_id, status) VALUES
('Bus 42', 'AB123CD', 1, 1, 'active');
```

## 8. MAINTENANCE SCRIPTS

### 8.1 Monthly Partition Creation
```sql
-- Function to create next month partition
CREATE OR REPLACE FUNCTION create_next_month_partition()
RETURNS void AS $$
DECLARE
  next_month DATE := date_trunc('month', NOW() + INTERVAL '1 month');
  month_after DATE := next_month + INTERVAL '1 month';
  partition_name TEXT := 'locations_' || to_char(next_month, 'YYYY_MM');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF locations FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    next_month,
    month_after
  );

  RAISE NOTICE 'Created partition: %', partition_name;
END;
$$ LANGUAGE plpgsql;

-- Schedule via cron or pg_cron extension
-- SELECT cron.schedule('create-partition', '0 0 1 * *', 'SELECT create_next_month_partition()');
```

### 8.2 Data Retention Cleanup
```sql
-- Delete locations older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_locations(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM locations
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % old location records', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Run monthly via cron
```

### 8.3 Vacuum and Analyze
```sql
-- Run after bulk operations or monthly
VACUUM ANALYZE locations;
VACUUM ANALYZE last_positions;
REINDEX INDEX CONCURRENTLY idx_locations_device_time;
```

## 9. MIGRATION SCRIPTS (Prisma/TypeORM Style)

### Migration 001 - Initial Schema
```typescript
// migrations/001_initial_schema.ts
export async function up(db: DB) {
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TYPE user_role AS ENUM ('admin', 'operator');
    CREATE TYPE device_status AS ENUM ('active', 'inactive', 'revoked');
    -- ... (rest of DDL from above)
  `);
}

export async function down(db: DB) {
  await db.query(`
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS nonces CASCADE;
    DROP TABLE IF EXISTS last_positions CASCADE;
    DROP TABLE IF EXISTS locations CASCADE;
    DROP TABLE IF EXISTS route_stops CASCADE;
    DROP TABLE IF EXISTS routes CASCADE;
    DROP TABLE IF EXISTS stops CASCADE;
    DROP TABLE IF EXISTS buses CASCADE;
    DROP TABLE IF EXISTS lines CASCADE;
    DROP TABLE IF EXISTS devices CASCADE;
    DROP TABLE IF EXISTS users CASCADE;

    DROP TYPE IF EXISTS user_role;
    DROP TYPE IF EXISTS device_status;
    -- ... (rest of cleanup)
  `);
}
```

## 10. QUERY PERFORMANCE ESTIMATES

| Query | Expected Rows | Index Used | Est. Time |
|-------|--------------|------------|-----------|
| SELECT * FROM v_fleet_status | 100 | idx_last_positions_bus_updated | <10ms |
| SELECT * FROM locations WHERE device_id=X LIMIT 100 | 100 | idx_locations_device_time | <5ms |
| Geospatial: nearest stop within 500m | 1-5 | idx_stops_point | <15ms |
| INSERT INTO locations | - | - | <2ms |
| UPDATE last_positions | - | PK | <1ms |

## 11. BACKUP STRATEGY

```bash
# Daily full backup
pg_dump -h localhost -U postgres -Fc bustracker > backup_$(date +%Y%m%d).dump

# Continuous WAL archiving (for PITR)
# In postgresql.conf:
# archive_mode = on
# archive_command = 'cp %p /path/to/wal_archive/%f'

# Restore example
pg_restore -h localhost -U postgres -d bustracker_new backup_20260203.dump
```
