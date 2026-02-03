import { FastifyInstance } from 'fastify';
import { fleetService } from '../services/fleet.service.js';
import type { FleetLiveResponse } from '../types/index.js';

export async function fleetRoutes(app: FastifyInstance) {
  // GET /fleet/live - Get live bus positions
  app.get(
    '/fleet/live',
    {
      preHandler: [app.authenticate],
      schema: {
        description: 'Get live positions of all buses',
        tags: ['Fleet'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            line_id: { type: 'number' },
            status: { type: 'string', enum: ['moving', 'stopped', 'offline', 'all'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              buses: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    bus_id: { type: 'number' },
                    label: { type: 'string' },
                    plate: { type: 'string', nullable: true },
                    line_id: { type: 'number', nullable: true },
                    line_name: { type: 'string', nullable: true },
                    line_code: { type: 'string', nullable: true },
                    line_color: { type: 'string', nullable: true },
                    latitude: { type: 'number', nullable: true },
                    longitude: { type: 'number', nullable: true },
                    heading: { type: 'number', nullable: true },
                    speed: { type: 'number', nullable: true },
                    battery_level: { type: 'number', nullable: true },
                    last_update: { type: 'string', nullable: true },
                    status: { type: 'string', enum: ['moving', 'stopped', 'offline'] },
                    signal_strength: { type: 'string', enum: ['strong', 'medium', 'weak', 'none'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = request.user as { id: number; type: string };

      // Only users can view fleet
      if (payload.type !== 'user') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Only users can view fleet status',
        });
      }

      const { line_id, status } = request.query as {
        line_id?: number;
        status?: 'moving' | 'stopped' | 'offline' | 'all';
      };

      const buses = await fleetService.getLiveBuses({ line_id, status });

      const response: FleetLiveResponse = {
        timestamp: new Date().toISOString(),
        buses,
      };

      return response;
    }
  );

  // GET /fleet/stats - Get fleet statistics
  app.get(
    '/fleet/stats',
    {
      preHandler: [app.authenticate],
      schema: {
        description: 'Get fleet statistics',
        tags: ['Fleet'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              active: { type: 'number' },
              moving: { type: 'number' },
              stopped: { type: 'number' },
              offline: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = request.user as { id: number; type: string };

      if (payload.type !== 'user') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Only users can view fleet stats',
        });
      }

      const stats = await fleetService.getBusStats();
      return stats;
    }
  );

  // GET /lines - Get all lines
  app.get(
    '/lines',
    {
      preHandler: [app.authenticate],
      schema: {
        description: 'Get all lines',
        tags: ['Fleet'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            active: { type: 'boolean', default: true },
          },
        },
      },
    },
    async (request, reply) => {
      const { active } = request.query as { active?: boolean };
      const lines = await fleetService.getLines(active !== false);
      return { lines };
    }
  );

  // GET /buses - Get all buses
  app.get(
    '/buses',
    {
      preHandler: [app.authenticate],
      schema: {
        description: 'Get all buses',
        tags: ['Fleet'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            line_id: { type: 'number' },
            status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { line_id, status } = request.query as {
        line_id?: number;
        status?: 'active' | 'inactive' | 'maintenance';
      };

      const buses = await fleetService.getBuses({ line_id, status });
      return { buses };
    }
  );

  // GET /stops - Get all stops
  app.get(
    '/stops',
    {
      preHandler: [app.authenticate],
      schema: {
        description: 'Get all stops',
        tags: ['Fleet'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            active: { type: 'boolean', default: true },
          },
        },
      },
    },
    async (request, reply) => {
      const { active } = request.query as { active?: boolean };
      const stops = await fleetService.getStops(active !== false);
      return { stops };
    }
  );
}
