import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminService } from '../services/admin.service.js';

const adminOnly = async (request: any, reply: any) => {
  const payload = request.user as { id: number; type: string; role?: string };
  if (payload.type !== 'user' || payload.role !== 'admin') {
    return reply.status(403).send({
      error: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
};

const lineSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const busSchema = z.object({
  label: z.string().min(1),
  plate: z.string().optional(),
  device_id: z.number().optional().nullable(),
  line_id: z.number().optional().nullable(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  metadata: z.record(z.any()).optional(),
});

const stopSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const routeStopSchema = z.object({
  stop_id: z.number(),
  sequence: z.number().min(0),
});

const routeSchema = z.object({
  line_id: z.number(),
  name: z.string().min(1),
  direction: z.enum(['outbound', 'inbound']).optional().nullable(),
  polyline: z.string().min(3),
  active_from: z.string().optional().nullable(),
  active_to: z.string().optional().nullable(),
  stops: z.array(routeStopSchema).optional(),
  metadata: z.record(z.any()).optional(),
});

const assignDeviceSchema = z.object({
  bus_id: z.number(),
  device_id: z.number().nullable(),
});

const assignLineSchema = z.object({
  bus_id: z.number(),
  line_id: z.number().nullable(),
});

export async function adminRoutes(app: FastifyInstance) {
  // Lines
  app.post(
    '/lines',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        description: 'Create line (admin)',
        tags: ['Lines'],
      },
    },
    async (request, reply) => {
      const data = lineSchema.parse(request.body);
      const line = await adminService.createLine(data);
      return reply.status(201).send(line);
    }
  );

  app.put(
    '/lines/:id',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: { description: 'Update line (admin)', tags: ['Lines'] },
    },
    async (request, reply) => {
      const id = Number((request.params as any).id);
      const data = lineSchema.partial().parse(request.body);
      const line = await adminService.updateLine(id, data);
      if (!line) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Line not found' });
      return line;
    }
  );

  app.delete(
    '/lines/:id',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: { description: 'Deactivate line (admin)', tags: ['Lines'] },
    },
    async (request, reply) => {
      const id = Number((request.params as any).id);
      const line = await adminService.deactivateLine(id);
      if (!line) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Line not found' });
      return { success: true };
    }
  );

  // Buses
  app.post(
    '/buses',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Buses'] } },
    async (request, reply) => {
      const data = busSchema.parse(request.body);
      const bus = await adminService.createBus(data);
      return reply.status(201).send(bus);
    }
  );

  app.put(
    '/buses/:id',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Buses'] } },
    async (request, reply) => {
      const id = Number((request.params as any).id);
      const data = busSchema.partial().parse(request.body);
      const bus = await adminService.updateBus(id, data);
      if (!bus) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Bus not found' });
      return bus;
    }
  );

  app.delete(
    '/buses/:id',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Buses'] } },
    async (request, reply) => {
      const id = Number((request.params as any).id);
      const bus = await adminService.deactivateBus(id);
      if (!bus) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Bus not found' });
      return { success: true };
    }
  );

  // Stops
  app.post(
    '/stops',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Stops'] } },
    async (request, reply) => {
      const data = stopSchema.parse(request.body);
      const stop = await adminService.createStop(data);
      return reply.status(201).send(stop);
    }
  );

  app.put(
    '/stops/:id',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Stops'] } },
    async (request, reply) => {
      const id = Number((request.params as any).id);
      const data = stopSchema.partial().parse(request.body);
      const stop = await adminService.updateStop(id, data);
      if (!stop) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Stop not found' });
      return stop;
    }
  );

  app.delete(
    '/stops/:id',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Stops'] } },
    async (request, reply) => {
      const id = Number((request.params as any).id);
      const stop = await adminService.deactivateStop(id);
      if (!stop) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Stop not found' });
      return { success: true };
    }
  );

  // Routes
  app.post(
    '/routes',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Routes'] } },
    async (request, reply) => {
      const data = routeSchema.parse(request.body);
      const route = await adminService.createRoute(data);
      return reply.status(201).send(route);
    }
  );

  app.put(
    '/routes/:id',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Routes'] } },
    async (request, reply) => {
      const id = Number((request.params as any).id);
      const data = routeSchema.partial().parse(request.body);
      const route = await adminService.updateRoute(id, data);
      if (!route) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found' });
      return route;
    }
  );

  app.delete(
    '/routes/:id',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Routes'] } },
    async (request, reply) => {
      const id = Number((request.params as any).id);
      await adminService.deleteRoute(id);
      return { success: true };
    }
  );

  // Assignments
  app.post(
    '/assignments/device',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Fleet'] } },
    async (request, reply) => {
      const data = assignDeviceSchema.parse(request.body);
      const bus = await adminService.assignDeviceToBus(data.bus_id, data.device_id);
      if (!bus) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Bus not found' });
      return bus;
    }
  );

  app.post(
    '/assignments/bus-line',
    { preHandler: [app.authenticate, adminOnly], schema: { tags: ['Fleet'] } },
    async (request, reply) => {
      const data = assignLineSchema.parse(request.body);
      const bus = await adminService.assignBusToLine(data.bus_id, data.line_id);
      if (!bus) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Bus not found' });
      return bus;
    }
  );
}
