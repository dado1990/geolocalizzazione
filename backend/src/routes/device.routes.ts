import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { deviceService } from '../services/device.service.js';
import type { DeviceRegisterRequest, DeviceRegisterResponse } from '../types/index.js';

// Validation schemas
const registerSchema = z.object({
  uuid: z.string().uuid(),
  platform: z.enum(['android', 'ios']),
  app_version: z.string().optional(),
  device_model: z.string().optional(),
  os_version: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function deviceRoutes(app: FastifyInstance) {
  // POST /device/register - Register a new device
  app.post<{ Body: DeviceRegisterRequest }>(
    '/device/register',
    {
      schema: {
        description: 'Registra un nuovo dispositivo (PWA)',
        tags: ['Device'],
        body: {
          type: 'object',
          required: ['uuid', 'platform'],
          properties: {
            uuid: { type: 'string', format: 'uuid' },
            platform: { type: 'string', enum: ['android', 'ios'] },
            app_version: { type: 'string' },
            device_model: { type: 'string' },
            os_version: { type: 'string' },
            metadata: { type: 'object' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              device_id: { type: 'number' },
              token: { type: 'string' },
              refresh_token: { type: 'string' },
              config: {
                type: 'object',
                properties: {
                  location_interval_ms: { type: 'number' },
                  movement_threshold_meters: { type: 'number' },
                  retry_backoff_ms: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const data = registerSchema.parse(request.body);

      // Register or get existing device
      const device = await deviceService.registerDevice(data);

      if (!device) {
        return reply.status(500).send({
          error: 'REGISTRATION_FAILED',
          message: 'Failed to register device',
        });
      }

      // Generate JWT token for device
      const token = app.jwt.sign(
        { id: device.id, type: 'device' },
        { expiresIn: '30d' }
      );

      // Generate and store refresh token
      const refreshToken = deviceService.generateRefreshToken();
      await deviceService.storeRefreshToken(device.id, refreshToken);

      // Get device config
      const config = await deviceService.getDeviceConfig(device.id);

      const response: DeviceRegisterResponse = {
        device_id: device.id,
        token,
        refresh_token: refreshToken,
        config,
      };

      return reply.status(201).send(response);
    }
  );

  // POST /device/refresh - Refresh device token
  app.post<{ Body: { refresh_token: string } }>(
    '/device/refresh',
    {
      schema: {
        description: 'Refresh device access token',
        tags: ['Device'],
        body: {
          type: 'object',
          required: ['refresh_token'],
          properties: {
            refresh_token: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { refresh_token } = request.body;

      const deviceId = await deviceService.validateRefreshToken(refresh_token);

      if (!deviceId) {
        return reply.status(401).send({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or expired',
        });
      }

      const device = await deviceService.getDeviceById(deviceId);

      if (!device || device.status !== 'active') {
        return reply.status(401).send({
          error: 'DEVICE_INACTIVE',
          message: 'Device is inactive or revoked',
        });
      }

      const token = app.jwt.sign(
        { id: device.id, type: 'device' },
        { expiresIn: '30d' }
      );

      return { token };
    }
  );

  // GET /device/status - Get device status (requires auth)
  app.get(
    '/device/status',
    {
      preHandler: [app.authenticate],
      schema: {
        description: 'Get device status and configuration',
        tags: ['Device'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              device_id: { type: 'number' },
              uuid: { type: 'string' },
              status: { type: 'string' },
              bus: {
                type: 'object',
                nullable: true,
                properties: {
                  bus_id: { type: 'number' },
                  bus_label: { type: 'string' },
                  line_id: { type: 'number', nullable: true },
                },
              },
              config: {
                type: 'object',
                properties: {
                  location_interval_ms: { type: 'number' },
                  movement_threshold_meters: { type: 'number' },
                  retry_backoff_ms: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = request.user as { id: number; type: string };

      if (payload.type !== 'device') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'This endpoint is only for devices',
        });
      }

      const device = await deviceService.getDeviceById(payload.id);

      if (!device) {
        return reply.status(404).send({
          error: 'DEVICE_NOT_FOUND',
          message: 'Device not found',
        });
      }

      const bus = await deviceService.getBusForDevice(device.id);
      const config = await deviceService.getDeviceConfig(device.id);

      return {
        device_id: device.id,
        uuid: device.uuid,
        status: device.status,
        bus,
        config,
      };
    }
  );

  // GET /devices - List all devices (admin only)
  app.get(
    '/devices',
    {
      preHandler: [app.authenticate],
      schema: {
        description: 'List all devices (admin only)',
        tags: ['Device'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['active', 'inactive', 'revoked'] },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = request.user as { id: number; type: string; role?: string };

      if (payload.type !== 'user' || payload.role !== 'admin') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const { status } = request.query as { status?: 'active' | 'inactive' | 'revoked' };
      const devices = await deviceService.listDevices(status);

      return { devices };
    }
  );
}
