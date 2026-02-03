export interface Line {
  id: number;
  name: string;
  code: string;
  color?: string | null;
}

export interface LiveBus {
  bus_id: number;
  label: string;
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

export interface Route {
  id: number;
  line_id: number;
  name: string;
  polyline: string;
}
