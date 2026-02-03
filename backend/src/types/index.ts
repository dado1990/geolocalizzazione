// User types
export interface User {
  id: number;
  email: string;
  name: string | null;
  role: 'admin' | 'operator';
  active: boolean;
  created_at: Date;
  last_login: Date | null;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

// Device types
export interface Device {
  id: number;
  uuid: string;
  platform: 'android' | 'ios';
  app_version: string | null;
  device_model: string | null;
  os_version: string | null;
  status: 'active' | 'inactive' | 'revoked';
  last_seen_at: Date | null;
  metadata: Record<string, any>;
  created_at: Date;
}

// Bus types
export interface Bus {
  id: number;
  label: string;
  plate: string | null;
  device_id: number | null;
  line_id: number | null;
  status: 'active' | 'inactive' | 'maintenance';
  metadata: Record<string, any>;
  created_at: Date;
}

// Line types
export interface Line {
  id: number;
  name: string;
  code: string;
  color: string | null;
  description: string | null;
  active: boolean;
  metadata: Record<string, any>;
  created_at: Date;
}

// Stop types
export interface Stop {
  id: number;
  name: string;
  code: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  active: boolean;
  metadata: Record<string, any>;
  created_at: Date;
}

// Route types
export interface Route {
  id: number;
  line_id: number;
  name: string;
  direction: 'outbound' | 'inbound' | null;
  polyline: string;
  active_from: Date | null;
  active_to: Date | null;
  metadata: Record<string, any>;
  created_at: Date;
}

// Location types
export interface Location {
  id: number;
  device_id: number;
  bus_id: number | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  provider: 'gps' | 'network' | 'fused' | null;
  battery_level: number | null;
  network_type: 'wifi' | 'cellular' | 'none' | null;
  timestamp: Date;
  created_at: Date;
}

export interface LastPosition {
  device_id: number;
  bus_id: number | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  provider: 'gps' | 'network' | 'fused' | null;
  battery_level: number | null;
  network_type: 'wifi' | 'cellular' | 'none' | null;
  timestamp: Date;
  updated_at: Date;
}

// API Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: Omit<User, 'password_hash'>;
}

export interface DeviceRegisterRequest {
  uuid: string;
  platform: 'android' | 'ios';
  app_version?: string;
  device_model?: string;
  os_version?: string;
  metadata?: Record<string, any>;
}

export interface DeviceRegisterResponse {
  device_id: number;
  token: string;
  refresh_token: string;
  config: {
    location_interval_ms: number;
    movement_threshold_meters: number;
    retry_backoff_ms: number;
  };
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  provider?: 'gps' | 'network' | 'fused';
  battery_level?: number;
  network_type?: 'wifi' | 'cellular' | 'none';
  nonce?: string;
}

export interface LocationResponse {
  id: number;
  status: 'accepted' | 'queued' | 'throttled';
  received_at: string;
  next_expected_at: string;
}

export interface FleetLiveResponse {
  timestamp: string;
  buses: LiveBus[];
}

export interface LiveBus {
  bus_id: number;
  label: string;
  plate: string | null;
  line_id: number | null;
  line_name: string | null;
  line_code: string | null;
  line_color: string | null;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed: number | null;
  battery_level: number | null;
  last_update: string | null;
  status: 'moving' | 'stopped' | 'offline';
  signal_strength: 'strong' | 'medium' | 'weak' | 'none';
}

// JWT Payload types
export interface JWTPayload {
  id: number;
  type: 'user' | 'device';
  role?: 'admin' | 'operator';
  iat: number;
  exp: number;
}
