import { query } from '../config/database.js';
import { redis, redisPub } from '../config/redis.js';
import { deviceService } from './device.service.js';
import type { LocationPayload, Location, LastPosition } from '../types/index.js';

const NONCE_TTL = 600; // 10 minutes
const LOCATION_CACHE_PREFIX = 'last_pos:';

export class TelemetryService {
  // Store location from device
  async storeLocation(
    deviceId: number,
    payload: LocationPayload
  ): Promise<{ id: number; bus_id: number | null }> {
    // Get associated bus
    const busInfo = await deviceService.getBusForDevice(deviceId);
    const busId = busInfo?.bus_id || null;

    // Insert into locations table
    const result = await query<{ id: number }>(
      `INSERT INTO locations (
        device_id, bus_id, latitude, longitude, accuracy, altitude,
        speed, heading, provider, battery_level, network_type, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        deviceId,
        busId,
        payload.latitude,
        payload.longitude,
        payload.accuracy,
        payload.altitude || null,
        payload.speed || null,
        payload.heading || null,
        payload.provider || null,
        payload.battery_level || null,
        payload.network_type || null,
        payload.timestamp,
      ]
    );

    // Update last_positions table
    await this.updateLastPosition(deviceId, busId, payload);

    // Update device last_seen
    await deviceService.updateLastSeen(deviceId);

    // Publish to Redis for WebSocket broadcast
    await this.publishLocationUpdate(deviceId, busId, payload);

    return { id: result.rows[0].id, bus_id: busId };
  }

  // Update last position cache
  private async updateLastPosition(
    deviceId: number,
    busId: number | null,
    payload: LocationPayload
  ): Promise<void> {
    // Upsert in database
    await query(
      `INSERT INTO last_positions (
        device_id, bus_id, latitude, longitude, accuracy, altitude,
        speed, heading, provider, battery_level, network_type, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (device_id) DO UPDATE SET
        bus_id = EXCLUDED.bus_id,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        accuracy = EXCLUDED.accuracy,
        altitude = EXCLUDED.altitude,
        speed = EXCLUDED.speed,
        heading = EXCLUDED.heading,
        provider = EXCLUDED.provider,
        battery_level = EXCLUDED.battery_level,
        network_type = EXCLUDED.network_type,
        timestamp = EXCLUDED.timestamp,
        updated_at = NOW()`,
      [
        deviceId,
        busId,
        payload.latitude,
        payload.longitude,
        payload.accuracy,
        payload.altitude || null,
        payload.speed || null,
        payload.heading || null,
        payload.provider || null,
        payload.battery_level || null,
        payload.network_type || null,
        payload.timestamp,
      ]
    );

    // Cache in Redis for fast reads
    const cacheKey = `${LOCATION_CACHE_PREFIX}${deviceId}`;
    await redis.setex(
      cacheKey,
      3600, // 1 hour TTL
      JSON.stringify({
        device_id: deviceId,
        bus_id: busId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        speed: payload.speed,
        heading: payload.heading,
        battery_level: payload.battery_level,
        timestamp: payload.timestamp,
        updated_at: new Date().toISOString(),
      })
    );
  }

  // Publish location update to Redis pub/sub
  private async publishLocationUpdate(
    deviceId: number,
    busId: number | null,
    payload: LocationPayload
  ): Promise<void> {
    const message = JSON.stringify({
      type: 'location_update',
      device_id: deviceId,
      bus_id: busId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      speed: payload.speed,
      heading: payload.heading,
      battery_level: payload.battery_level,
      timestamp: payload.timestamp,
    });

    await redisPub.publish('bus_locations', message);
  }

  // Validate nonce (anti-replay)
  async validateNonce(nonce: string, deviceId: number): Promise<boolean> {
    const key = `nonce:${nonce}`;
    const exists = await redis.exists(key);

    if (exists) {
      // Nonce already used
      return false;
    }

    // Store nonce with TTL
    await redis.setex(key, NONCE_TTL, deviceId.toString());
    return true;
  }

  // Get location history for a device
  async getLocationHistory(
    deviceId: number,
    from?: Date,
    to?: Date,
    limit: number = 100
  ): Promise<Location[]> {
    let sql = 'SELECT * FROM locations WHERE device_id = $1';
    const params: any[] = [deviceId];
    let paramIndex = 2;

    if (from) {
      sql += ` AND timestamp >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      sql += ` AND timestamp <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    sql += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query<Location>(sql, params);
    return result.rows;
  }

  // Get last position from cache or database
  async getLastPosition(deviceId: number): Promise<LastPosition | null> {
    // Try cache first
    const cacheKey = `${LOCATION_CACHE_PREFIX}${deviceId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const result = await query<LastPosition>(
      'SELECT * FROM last_positions WHERE device_id = $1',
      [deviceId]
    );

    return result.rows[0] || null;
  }
}

export const telemetryService = new TelemetryService();
