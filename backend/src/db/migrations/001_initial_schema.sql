-- Migration 001: Initial Database Schema
-- Bus Tracker System - 10 bus version

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

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

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users Table
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

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role) WHERE active = true;

COMMENT ON TABLE users IS 'Utenti del sistema (admin, operatori)';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt della password';

-- Devices Table
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

CREATE UNIQUE INDEX idx_devices_uuid ON devices(uuid);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at DESC) WHERE status = 'active';
CREATE INDEX idx_devices_metadata ON devices USING GIN(metadata);

COMMENT ON TABLE devices IS 'Dispositivi mobili a bordo autobus';
COMMENT ON COLUMN devices.token_hash IS 'Hash SHA256 del JWT token';

-- Lines Table
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

CREATE UNIQUE INDEX idx_lines_code ON lines(code);
CREATE INDEX idx_lines_active ON lines(active);

COMMENT ON TABLE lines IS 'Linee di trasporto pubblico';
COMMENT ON COLUMN lines.code IS 'Codice alfanumerico univoco (es. L05)';

-- Buses Table
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

CREATE INDEX idx_buses_device_id ON buses(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX idx_buses_line_id ON buses(line_id) WHERE line_id IS NOT NULL;
CREATE INDEX idx_buses_status ON buses(status);
CREATE INDEX idx_buses_plate ON buses(plate);

COMMENT ON TABLE buses IS 'Autobus della flotta';
COMMENT ON COLUMN buses.label IS 'Nome identificativo visibile (es. Bus 42)';

-- Stops Table
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

CREATE INDEX idx_stops_point ON stops USING GIST(point);
CREATE INDEX idx_stops_code ON stops(code) WHERE code IS NOT NULL;
CREATE INDEX idx_stops_active ON stops(active);

COMMENT ON TABLE stops IS 'Fermate/punti di interesse lungo i percorsi';
COMMENT ON COLUMN stops.point IS 'Geometria PostGIS (SRID 4326 - WGS84)';

-- Routes Table
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

CREATE INDEX idx_routes_line_id ON routes(line_id);
CREATE INDEX idx_routes_active_period ON routes(active_from, active_to);

COMMENT ON TABLE routes IS 'Percorsi delle linee (con varianti e direzioni)';
COMMENT ON COLUMN routes.polyline IS 'Polyline codificata (Google Encoded Polyline)';

-- Route_Stops Junction Table
CREATE TABLE route_stops (
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  metadata JSONB DEFAULT '{}', -- es. tempo stimato, distanza

  PRIMARY KEY (route_id, stop_id),
  CONSTRAINT unique_sequence_per_route UNIQUE(route_id, sequence)
);

CREATE INDEX idx_route_stops_route ON route_stops(route_id, sequence);
CREATE INDEX idx_route_stops_stop ON route_stops(stop_id);

COMMENT ON TABLE route_stops IS 'Associazione percorso-fermate con ordine di sequenza';

-- Locations Table (NON partitioned per 10 bus, dati piccoli)
CREATE TABLE locations (
  id BIGSERIAL PRIMARY KEY,
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
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_locations_device_time ON locations(device_id, created_at DESC);
CREATE INDEX idx_locations_bus_time ON locations(bus_id, created_at DESC) WHERE bus_id IS NOT NULL;
CREATE INDEX idx_locations_point ON locations USING GIST(point);
CREATE INDEX idx_locations_timestamp ON locations(timestamp DESC);
CREATE INDEX idx_locations_created_at ON locations(created_at DESC);

COMMENT ON TABLE locations IS 'Storico posizioni GPS';
COMMENT ON COLUMN locations.timestamp IS 'Timestamp GPS dal dispositivo';
COMMENT ON COLUMN locations.created_at IS 'Timestamp server ricezione';

-- Last_Positions Table (cache ultima posizione)
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

CREATE INDEX idx_last_positions_bus ON last_positions(bus_id) WHERE bus_id IS NOT NULL;
CREATE INDEX idx_last_positions_updated ON last_positions(updated_at DESC);
CREATE INDEX idx_last_positions_point ON last_positions USING GIST(point);

COMMENT ON TABLE last_positions IS 'Ultima posizione nota per ogni dispositivo (cache rapida)';

-- Audit_Logs Table
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

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Log di audit per azioni amministrative';

-- Nonces Table (Anti-Replay)
CREATE TABLE nonces (
  nonce UUID PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_nonces_device ON nonces(device_id);
CREATE INDEX idx_nonces_expires ON nonces(expires_at);

COMMENT ON TABLE nonces IS 'Nonces per prevenzione replay attacks (TTL 10 min)';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-populate geometry point for stops
CREATE OR REPLACE FUNCTION update_stop_point()
RETURNS TRIGGER AS $$
BEGIN
  NEW.point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-populate geometry point for locations
CREATE OR REPLACE FUNCTION update_location_point()
RETURNS TRIGGER AS $$
BEGIN
  NEW.point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
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

-- Geometry point triggers
CREATE TRIGGER trigger_update_stop_point
BEFORE INSERT OR UPDATE OF latitude, longitude ON stops
FOR EACH ROW
EXECUTE FUNCTION update_stop_point();

CREATE TRIGGER trigger_update_location_point
BEFORE INSERT OR UPDATE OF latitude, longitude ON locations
FOR EACH ROW
EXECUTE FUNCTION update_location_point();

CREATE TRIGGER trigger_update_last_position_point
BEFORE INSERT OR UPDATE OF latitude, longitude ON last_positions
FOR EACH ROW
EXECUTE FUNCTION update_location_point();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Fleet Status View
CREATE OR REPLACE VIEW v_fleet_status AS
SELECT
  b.id AS bus_id,
  b.label,
  b.plate,
  b.status AS bus_status,
  l.id AS line_id,
  l.name AS line_name,
  l.code AS line_code,
  l.color AS line_color,
  lp.latitude,
  lp.longitude,
  lp.speed,
  lp.heading,
  lp.battery_level,
  lp.timestamp AS last_gps_timestamp,
  lp.updated_at AS last_update,
  CASE
    WHEN lp.updated_at IS NULL THEN 'offline'
    WHEN lp.updated_at < NOW() - INTERVAL '5 minutes' THEN 'offline'
    WHEN lp.speed IS NULL OR lp.speed < 1 THEN 'stopped'
    ELSE 'moving'
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

-- ============================================================================
-- SAMPLE DATA (Admin User)
-- ============================================================================

-- Insert default admin user (password: Admin123!)
-- Password hash generated with bcrypt rounds=10
INSERT INTO users (email, password_hash, name, role) VALUES
('admin@bustracker.local', '$2b$10$YourBcryptHashHere', 'System Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Migration completed
SELECT 'Migration 001 completed successfully' AS status;
