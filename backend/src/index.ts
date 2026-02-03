import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import 'dotenv/config';

// Import routes
import { authRoutes } from './routes/auth.routes.js';
import { deviceRoutes } from './routes/device.routes.js';
import { telemetryRoutes } from './routes/telemetry.routes.js';
import { fleetRoutes } from './routes/fleet.routes.js';
import { adminRoutes } from './routes/admin.routes.js';

// Import config
import { pool } from './config/database.js';
import { redis, redisSub } from './config/redis.js';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    pg: typeof pool;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number; type: 'user' | 'device'; role?: 'admin' | 'operator' };
    user: { id: number; type: 'user' | 'device'; role?: 'admin' | 'operator' };
  }
}

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Add pg pool to fastify instance
app.decorate('pg', pool);

// CORS
await app.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true,
});

// JWT
await app.register(jwt, {
  secret: process.env.JWT_SECRET || (() => { throw new Error('FATAL: JWT_SECRET environment variable is not defined!'); })(),
});

// Authentication decorator
app.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
});

// Rate Limiting
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    // Use user ID if authenticated, otherwise IP
    return request.user?.id?.toString() || request.ip;
  },
});

// WebSocket
await app.register(websocket);

// Swagger Documentation
await app.register(swagger, {
  openapi: {
    info: {
      title: 'Bus Tracker API',
      description: 'API per tracciamento autobus in tempo reale',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Device', description: 'Device registration and management' },
      { name: 'Telemetry', description: 'Location data endpoints' },
      { name: 'Fleet', description: 'Fleet monitoring and management' },
    ],
  },
});

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// Health Check
app.get('/health', async () => {
  // Check database connection
  let dbStatus = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    dbStatus = 'error';
  }

  // Check Redis connection
  let redisStatus = 'ok';
  try {
    await redis.ping();
  } catch (err) {
    redisStatus = 'error';
  }

  return {
    status: dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  };
});

// Root endpoint
app.get('/', async () => {
  return {
    message: 'Bus Tracker API',
    version: '1.0.0',
    docs: '/docs',
    endpoints: {
      health: '/health',
      auth: '/auth/login',
      device: '/device/register',
      fleet: '/fleet/live',
    },
  };
});

// Register API routes
await app.register(authRoutes);
await app.register(deviceRoutes);
await app.register(telemetryRoutes);
await app.register(fleetRoutes);
await app.register(adminRoutes);

// WebSocket endpoint for real-time updates
app.get('/ws/fleet', { websocket: true }, (connection, req) => {
  console.log('🔌 WebSocket client connected');

  // Subscribe to Redis channel for location updates
  redisSub.subscribe('bus_locations', (err) => {
    if (err) {
      console.error('Redis subscribe error:', err);
    }
  });

  // Forward Redis messages to WebSocket client
  const messageHandler = (channel: string, message: string) => {
    if (channel === 'bus_locations') {
      connection.socket.send(message);
    }
  };

  redisSub.on('message', messageHandler);

  // Handle client messages
  connection.socket.on('message', (message) => {
    const data = message.toString();
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'ping') {
        connection.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch {
      // Ignore invalid JSON
    }
  });

  // Cleanup on disconnect
  connection.socket.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    redisSub.off('message', messageHandler);
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down...');
  await app.close();
  await pool.end();
  await redis.quit();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server listening on http://localhost:${port}`);
    console.log(`📚 API Docs available at http://localhost:${port}/docs`);
    console.log(`🔌 WebSocket available at ws://localhost:${port}/ws/fleet`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
