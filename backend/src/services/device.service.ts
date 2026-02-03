import crypto from 'crypto';
import { query } from '../config/database.js';
import { redis } from '../config/redis.js';
import type { Device, DeviceRegisterRequest } from '../types/index.js';

const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days in seconds

export class DeviceService {
  // Register new device
  async registerDevice(data: DeviceRegisterRequest): Promise<Device | null> {
    // Check if device already exists
    const existing = await query<Device>(
      'SELECT * FROM devices WHERE uuid = $1',
      [data.uuid]
    );

    if (existing.rows.length > 0) {
      // Return existing device
      return existing.rows[0];
    }

    // Generate token hash
    const tokenHash = crypto.randomBytes(32).toString('hex');

    // Insert new device
    const result = await query<Device>(
      `INSERT INTO devices (uuid, token_hash, platform, app_version, device_model, os_version, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.uuid,
        tokenHash,
        data.platform,
        data.app_version || null,
        data.device_model || null,
        data.os_version || null,
        JSON.stringify(data.metadata || {}),
      ]
    );

    return result.rows[0];
  }

  // Get device by ID
  async getDeviceById(id: number): Promise<Device | null> {
    const result = await query<Device>(
      'SELECT * FROM devices WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // Get device by UUID
  async getDeviceByUuid(uuid: string): Promise<Device | null> {
    const result = await query<Device>(
      'SELECT * FROM devices WHERE uuid = $1',
      [uuid]
    );
    return result.rows[0] || null;
  }

  // Update device last seen
  async updateLastSeen(deviceId: number): Promise<void> {
    await query(
      'UPDATE devices SET last_seen_at = NOW() WHERE id = $1',
      [deviceId]
    );
  }

  // Generate refresh token for device
  generateRefreshToken(): string {
    return `rt_${crypto.randomBytes(32).toString('hex')}`;
  }

  // Store device refresh token
  async storeRefreshToken(deviceId: number, refreshToken: string): Promise<void> {
    const key = `refresh:device:${refreshToken}`;
    await redis.setex(key, REFRESH_TOKEN_TTL, deviceId.toString());

    // Also update in database
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query(
      'UPDATE devices SET refresh_token_hash = $1 WHERE id = $2',
      [tokenHash, deviceId]
    );
  }

  // Validate device refresh token
  async validateRefreshToken(refreshToken: string): Promise<number | null> {
    const key = `refresh:device:${refreshToken}`;
    const deviceId = await redis.get(key);
    return deviceId ? parseInt(deviceId) : null;
  }

  // Get device configuration (can be customized per device/line)
  async getDeviceConfig(deviceId: number): Promise<{
    location_interval_ms: number;
    movement_threshold_meters: number;
    retry_backoff_ms: number;
  }> {
    // Default config (could be fetched from database based on line/bus)
    return {
      location_interval_ms: 120000, // 2 minutes
      movement_threshold_meters: 50,
      retry_backoff_ms: 5000,
    };
  }

  // Get bus associated with device
  async getBusForDevice(deviceId: number): Promise<{
    bus_id: number;
    bus_label: string;
    line_id: number | null;
  } | null> {
    const result = await query(
      'SELECT id as bus_id, label as bus_label, line_id FROM buses WHERE device_id = $1',
      [deviceId]
    );
    return result.rows[0] || null;
  }

  // List all devices
  async listDevices(status?: 'active' | 'inactive' | 'revoked'): Promise<Device[]> {
    let sql = 'SELECT * FROM devices';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query<Device>(sql, params);
    return result.rows;
  }
}

export const deviceService = new DeviceService();
