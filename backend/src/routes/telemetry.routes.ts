import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { telemetryService } from '../services/telemetry.service.js';
import type { LocationPayload, LocationResponse } from '../types/index.js';

// Validation schema
const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
  altitude: z.number().optional(),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  timestamp: z.string().datetime(),
  provider: z.enum(['gps', 'network', 'fused']).optional(),
  battery_level: z.number().min(0).max(100).optional(),
  network_type: z.enum(['wifi', 'cellular', 'none']).optional(),
  nonce: z.string().uuid().optional(),
});

const batchSchema = z.object({
  locations: z.array(locationSchema).min(1),
  sent_at: z.string().datetime().optional(),
});

export async function telemetryRoutes(app: FastifyInstance) {
  // POST /telemetry/location - Submit device location
  app.post<{ Body: any }>(
    '/telemetry/location',
    {
      preHandler: [app.authenticate],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      schema: {
        description: 'Invia posizione GPS dal dispositivo',
        tags: ['Telemetry'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['latitude', 'longitude', 'accuracy', 'timestamp'],
          properties: {
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            accuracy: { type: 'number', minimum: 0 },
            altitude: { type: 'number' },
            speed: { type: 'number', minimum: 0 },
            heading: { type: 'number', minimum: 0, maximum: 360 },
            timestamp: { type: 'string', format: 'date-time' },
            provider: { type: 'string', enum: ['gps', 'network', 'fused'] },
            battery_level: { type: 'number', minimum: 0, maximum: 100 },
            network_type: { type: 'string', enum: ['wifi', 'cellular', 'none'] },
            nonce: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          202: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              status: { type: 'string', enum: ['accepted', 'queued', 'throttled'] },
              received_at: { type: 'string', format: 'date-time' },
              next_expected_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = request.user as { id: number; type: string };

      // Only devices can submit locations
      if (payload.type !== 'device') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Only devices can submit locations',
        });
      }

      const deviceId = payload.id;
      const batchParsed = batchSchema.safeParse(request.body);

      // Batch mode
      if (batchParsed.success) {
        let accepted = 0;
        let rejected = 0;
        const ids: number[] = [];

        for (const loc of batchParsed.data.locations) {
          if (loc.nonce) {
            const isValidNonce = await telemetryService.validateNonce(loc.nonce, deviceId);
            if (!isValidNonce) {
              rejected += 1;
              continue;
            }
          }
          const result = await telemetryService.storeLocation(deviceId, loc);
          accepted += 1;
          ids.push(result.id);
        }

        const now = new Date();
        const nextExpected = new Date(now.getTime() + 120000);

        return reply.status(202).send({
          accepted,
          rejected,
          ids,
          received_at: now.toISOString(),
          next_expected_at: nextExpected.toISOString(),
        });
      }

      // Single mode
      const data = locationSchema.parse(request.body);

      if (data.nonce) {
        const isValidNonce = await telemetryService.validateNonce(data.nonce, deviceId);
        if (!isValidNonce) {
          return reply.status(409).send({
            error: 'DUPLICATE_NONCE',
            message: 'This location update has already been processed',
          });
        }
      }

      const result = await telemetryService.storeLocation(deviceId, data);

      const now = new Date();
      const nextExpected = new Date(now.getTime() + 120000); // 2 minutes

      const response: LocationResponse = {
        id: result.id,
        status: 'accepted',
        received_at: now.toISOString(),
        next_expected_at: nextExpected.toISOString(),
      };

      return reply.status(202).send(response);
    }
  );

  // GET /telemetry/history - Get location history (admin/operator)
  app.get(
    '/telemetry/history',
    {
      preHandler: [app.authenticate],
      schema: {
        description: 'Get location history for a device/bus',
        tags: ['Telemetry'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['bus_id'],
          properties: {
            bus_id: { type: 'number' },
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time' },
            limit: { type: 'number', default: 100, maximum: 1000 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              bus_id: { type: 'number' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    speed: { type: 'number', nullable: true },
                    heading: { type: 'number', nullable: true },
                    accuracy: { type: 'number', nullable: true },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = request.user as { id: number; type: string; role?: string };

      // Only users (admin/operator) can view history
      if (payload.type !== 'user') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Only users can view location history',
        });
      }

      const { bus_id, from, to, limit } = request.query as {
        bus_id: number;
        from?: string;
        to?: string;
        limit?: number;
      };

      // Get device for bus
      const busResult = await app.pg.query(
        'SELECT device_id FROM buses WHERE id = $1',
        [bus_id]
      );

      if (busResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'BUS_NOT_FOUND',
          message: 'Bus not found',
        });
      }

      const deviceId = busResult.rows[0].device_id;

      if (!deviceId) {
        return reply.status(404).send({
          error: 'NO_DEVICE',
          message: 'Bus has no device assigned',
        });
      }

      const locations = await telemetryService.getLocationHistory(
        deviceId,
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
        limit || 100
      );

      return {
        total: locations.length,
        bus_id,
        data: locations.map((loc) => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
          speed: loc.speed,
          heading: loc.heading,
          accuracy: loc.accuracy,
          timestamp: loc.timestamp,
        })),
      };
    }
  );
}
