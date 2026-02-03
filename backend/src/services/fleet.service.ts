import { query } from '../config/database.js';
import type { LiveBus, Line, Bus, Stop } from '../types/index.js';

export class FleetService {
  // Get live bus positions (main endpoint for monitoring)
  async getLiveBuses(options?: {
    line_id?: number;
    status?: 'moving' | 'stopped' | 'offline' | 'all';
  }): Promise<LiveBus[]> {
    let sql = `
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
        END AS signal_strength
      FROM buses b
      LEFT JOIN lines l ON b.line_id = l.id
      LEFT JOIN devices d ON b.device_id = d.id
      LEFT JOIN last_positions lp ON d.id = lp.device_id
      WHERE b.status = 'active'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (options?.line_id) {
      sql += ` AND b.line_id = $${paramIndex}`;
      params.push(options.line_id);
      paramIndex++;
    }

    sql += ' ORDER BY b.label';

    const result = await query(sql, params);

    let buses: LiveBus[] = result.rows.map((row) => ({
      bus_id: row.bus_id,
      label: row.label,
      plate: row.plate,
      line_id: row.line_id,
      line_name: row.line_name,
      line_code: row.line_code,
      line_color: row.line_color,
      latitude: row.latitude,
      longitude: row.longitude,
      heading: row.heading,
      speed: row.speed,
      battery_level: row.battery_level,
      last_update: row.last_update?.toISOString() || null,
      status: row.movement_status as 'moving' | 'stopped' | 'offline',
      signal_strength: row.signal_strength as 'strong' | 'medium' | 'weak' | 'none',
    }));

    // Filter by status if specified
    if (options?.status && options.status !== 'all') {
      buses = buses.filter((bus) => bus.status === options.status);
    }

    return buses;
  }

  // Get all lines
  async getLines(activeOnly: boolean = true): Promise<Line[]> {
    let sql = 'SELECT * FROM lines';
    const params: any[] = [];

    if (activeOnly) {
      sql += ' WHERE active = true';
    }

    sql += ' ORDER BY code';

    const result = await query<Line>(sql, params);
    return result.rows;
  }

  // Get line by ID
  async getLineById(id: number): Promise<Line | null> {
    const result = await query<Line>('SELECT * FROM lines WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  // Get all buses
  async getBuses(options?: {
    line_id?: number;
    status?: 'active' | 'inactive' | 'maintenance';
  }): Promise<Bus[]> {
    let sql = 'SELECT * FROM buses WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.line_id) {
      sql += ` AND line_id = $${paramIndex}`;
      params.push(options.line_id);
      paramIndex++;
    }

    if (options?.status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    sql += ' ORDER BY label';

    const result = await query<Bus>(sql, params);
    return result.rows;
  }

  // Get bus by ID
  async getBusById(id: number): Promise<Bus | null> {
    const result = await query<Bus>('SELECT * FROM buses WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  // Get all stops
  async getStops(activeOnly: boolean = true): Promise<Stop[]> {
    let sql = 'SELECT * FROM stops';
    const params: any[] = [];

    if (activeOnly) {
      sql += ' WHERE active = true';
    }

    sql += ' ORDER BY name';

    const result = await query<Stop>(sql, params);
    return result.rows;
  }

  // Count buses by status
  async getBusStats(): Promise<{
    total: number;
    active: number;
    moving: number;
    stopped: number;
    offline: number;
  }> {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE b.status = 'active') AS total,
        COUNT(*) FILTER (WHERE b.status = 'active' AND lp.updated_at >= NOW() - INTERVAL '5 minutes') AS active,
        COUNT(*) FILTER (WHERE b.status = 'active' AND lp.updated_at >= NOW() - INTERVAL '5 minutes' AND lp.speed >= 1) AS moving,
        COUNT(*) FILTER (WHERE b.status = 'active' AND lp.updated_at >= NOW() - INTERVAL '5 minutes' AND (lp.speed IS NULL OR lp.speed < 1)) AS stopped,
        COUNT(*) FILTER (WHERE b.status = 'active' AND (lp.updated_at IS NULL OR lp.updated_at < NOW() - INTERVAL '5 minutes')) AS offline
      FROM buses b
      LEFT JOIN devices d ON b.device_id = d.id
      LEFT JOIN last_positions lp ON d.id = lp.device_id
    `);

    const stats = result.rows[0];
    return {
      total: parseInt(stats.total) || 0,
      active: parseInt(stats.active) || 0,
      moving: parseInt(stats.moving) || 0,
      stopped: parseInt(stats.stopped) || 0,
      offline: parseInt(stats.offline) || 0,
    };
  }
}

export const fleetService = new FleetService();
