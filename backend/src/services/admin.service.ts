import { query, withTransaction } from '../config/database.js';
import type { Line, Bus, Stop, Route } from '../types/index.js';

export interface RouteStopInput {
  stop_id: number;
  sequence: number;
}

export interface CreateRouteInput {
  line_id: number;
  name: string;
  direction?: 'outbound' | 'inbound' | null;
  polyline: string;
  active_from?: string | null;
  active_to?: string | null;
  stops?: RouteStopInput[];
  metadata?: Record<string, any>;
}

export class AdminService {
  // Lines
  async createLine(data: {
    name: string;
    code: string;
    color?: string | null;
    description?: string | null;
    active?: boolean;
    metadata?: Record<string, any>;
  }): Promise<Line> {
    const result = await query<Line>(
      `INSERT INTO lines (name, code, color, description, active, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.code,
        data.color || null,
        data.description || null,
        data.active ?? true,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return result.rows[0];
  }

  async updateLine(
    id: number,
    data: Partial<{
      name: string;
      code: string;
      color: string | null;
      description: string | null;
      active: boolean;
      metadata: Record<string, any>;
    }>
  ): Promise<Line | null> {
    const result = await query<Line>(
      `UPDATE lines SET
        name = COALESCE($2, name),
        code = COALESCE($3, code),
        color = COALESCE($4, color),
        description = COALESCE($5, description),
        active = COALESCE($6, active),
        metadata = COALESCE($7, metadata)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.name ?? null,
        data.code ?? null,
        data.color ?? null,
        data.description ?? null,
        data.active ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );
    return result.rows[0] || null;
  }

  async deactivateLine(id: number): Promise<Line | null> {
    const result = await query<Line>(
      'UPDATE lines SET active = false WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  // Buses
  async createBus(data: {
    label: string;
    plate?: string | null;
    device_id?: number | null;
    line_id?: number | null;
    status?: 'active' | 'inactive' | 'maintenance';
    metadata?: Record<string, any>;
  }): Promise<Bus> {
    const result = await query<Bus>(
      `INSERT INTO buses (label, plate, device_id, line_id, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.label,
        data.plate || null,
        data.device_id || null,
        data.line_id || null,
        data.status || 'active',
        JSON.stringify(data.metadata || {}),
      ]
    );
    return result.rows[0];
  }

  async updateBus(
    id: number,
    data: Partial<{
      label: string;
      plate: string | null;
      device_id: number | null;
      line_id: number | null;
      status: 'active' | 'inactive' | 'maintenance';
      metadata: Record<string, any>;
    }>
  ): Promise<Bus | null> {
    const result = await query<Bus>(
      `UPDATE buses SET
        label = COALESCE($2, label),
        plate = COALESCE($3, plate),
        device_id = COALESCE($4, device_id),
        line_id = COALESCE($5, line_id),
        status = COALESCE($6, status),
        metadata = COALESCE($7, metadata)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.label ?? null,
        data.plate ?? null,
        data.device_id ?? null,
        data.line_id ?? null,
        data.status ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );
    return result.rows[0] || null;
  }

  async deactivateBus(id: number): Promise<Bus | null> {
    const result = await query<Bus>(
      'UPDATE buses SET status = $2 WHERE id = $1 RETURNING *',
      [id, 'inactive']
    );
    return result.rows[0] || null;
  }

  // Stops
  async createStop(data: {
    name: string;
    code?: string | null;
    latitude: number;
    longitude: number;
    address?: string | null;
    active?: boolean;
    metadata?: Record<string, any>;
  }): Promise<Stop> {
    const result = await query<Stop>(
      `INSERT INTO stops (name, code, latitude, longitude, address, active, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.name,
        data.code || null,
        data.latitude,
        data.longitude,
        data.address || null,
        data.active ?? true,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return result.rows[0];
  }

  async updateStop(
    id: number,
    data: Partial<{
      name: string;
      code: string | null;
      latitude: number;
      longitude: number;
      address: string | null;
      active: boolean;
      metadata: Record<string, any>;
    }>
  ): Promise<Stop | null> {
    const result = await query<Stop>(
      `UPDATE stops SET
        name = COALESCE($2, name),
        code = COALESCE($3, code),
        latitude = COALESCE($4, latitude),
        longitude = COALESCE($5, longitude),
        address = COALESCE($6, address),
        active = COALESCE($7, active),
        metadata = COALESCE($8, metadata)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.name ?? null,
        data.code ?? null,
        data.latitude ?? null,
        data.longitude ?? null,
        data.address ?? null,
        data.active ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );
    return result.rows[0] || null;
  }

  async deactivateStop(id: number): Promise<Stop | null> {
    const result = await query<Stop>(
      'UPDATE stops SET active = false WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  // Routes
  async createRoute(data: CreateRouteInput): Promise<Route> {
    return withTransaction(async (client) => {
      const routeResult = await client.query<Route>(
        `INSERT INTO routes (line_id, name, direction, polyline, active_from, active_to, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.line_id,
          data.name,
          data.direction || null,
          data.polyline,
          data.active_from || null,
          data.active_to || null,
          JSON.stringify(data.metadata || {}),
        ]
      );

      const route = routeResult.rows[0];

      if (data.stops && data.stops.length > 0) {
        for (const stop of data.stops) {
          await client.query(
            `INSERT INTO route_stops (route_id, stop_id, sequence)
             VALUES ($1, $2, $3)`,
            [route.id, stop.stop_id, stop.sequence]
          );
        }
      }

      return route;
    });
  }

  async updateRoute(
    id: number,
    data: Partial<CreateRouteInput>
  ): Promise<Route | null> {
    return withTransaction(async (client) => {
      const result = await client.query<Route>(
        `UPDATE routes SET
          line_id = COALESCE($2, line_id),
          name = COALESCE($3, name),
          direction = COALESCE($4, direction),
          polyline = COALESCE($5, polyline),
          active_from = COALESCE($6, active_from),
          active_to = COALESCE($7, active_to),
          metadata = COALESCE($8, metadata)
         WHERE id = $1
         RETURNING *`,
        [
          id,
          data.line_id ?? null,
          data.name ?? null,
          data.direction ?? null,
          data.polyline ?? null,
          data.active_from ?? null,
          data.active_to ?? null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );

      const route = result.rows[0];
      if (!route) return null;

      if (data.stops) {
        await client.query('DELETE FROM route_stops WHERE route_id = $1', [id]);
        for (const stop of data.stops) {
          await client.query(
            `INSERT INTO route_stops (route_id, stop_id, sequence)
             VALUES ($1, $2, $3)`,
            [id, stop.stop_id, stop.sequence]
          );
        }
      }

      return route;
    });
  }

  async deleteRoute(id: number): Promise<void> {
    await query('DELETE FROM routes WHERE id = $1', [id]);
  }

  // Assignments
  async assignDeviceToBus(busId: number, deviceId: number | null): Promise<Bus | null> {
    if (deviceId) {
      await query('UPDATE buses SET device_id = NULL WHERE device_id = $1', [deviceId]);
    }
    const result = await query<Bus>(
      'UPDATE buses SET device_id = $2 WHERE id = $1 RETURNING *',
      [busId, deviceId]
    );
    return result.rows[0] || null;
  }

  async assignBusToLine(busId: number, lineId: number | null): Promise<Bus | null> {
    const result = await query<Bus>(
      'UPDATE buses SET line_id = $2 WHERE id = $1 RETURNING *',
      [busId, lineId]
    );
    return result.rows[0] || null;
  }
}

export const adminService = new AdminService();
