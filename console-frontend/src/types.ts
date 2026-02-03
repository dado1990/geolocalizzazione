export interface Line {
  id: number;
  name: string;
  code: string;
  color?: string | null;
  description?: string | null;
  active: boolean;
}

export interface Bus {
  id: number;
  label: string;
  plate?: string | null;
  device_id?: number | null;
  line_id?: number | null;
  status: 'active' | 'inactive' | 'maintenance';
}

export interface Device {
  id: number;
  uuid: string;
  platform: string;
  status: string;
  last_seen_at?: string | null;
}

export interface Stop {
  id: number;
  name: string;
  code?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  active: boolean;
}

export interface Route {
  id: number;
  line_id: number;
  name: string;
  direction?: 'outbound' | 'inbound' | null;
  polyline: string;
  active_from?: string | null;
  active_to?: string | null;
}

export interface RouteStopInput {
  stop_id: number;
  sequence: number;
}
