import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import type { LoginRequest, LoginResponse } from '../types/index.js';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refresh_token: z.string().startsWith('rt_'),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login
  app.post<{ Body: LoginRequest }>(
    '/auth/login',
    {
      schema: {
        description: 'Login utente (admin/operator)',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              access_token: { type: 'string' },
              refresh_token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  email: { type: 'string' },
                  name: { type: 'string', nullable: true },
                  role: { type: 'string', enum: ['admin', 'operator'] },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = loginSchema.parse(request.body);

      const user = await authService.validateUser(email, password);

      if (!user) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      // Generate tokens
      const accessToken = app.jwt.sign(
        { id: user.id, type: 'user', role: user.role },
        { expiresIn: '15m' }
      );

      const refreshToken = authService.generateRefreshToken();
      await authService.storeRefreshToken(user.id, refreshToken, 'user');

      // Log audit
      await authService.logAudit(
        user.id,
        'LOGIN',
        'users',
        user.id,
        null,
        request.ip
      );

      const response: LoginResponse = {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          active: user.active,
          created_at: user.created_at,
          last_login: user.last_login,
        },
      };

      return response;
    }
  );

  // POST /auth/refresh
  app.post<{ Body: { refresh_token: string } }>(
    '/auth/refresh',
    {
      schema: {
        description: 'Refresh access token',
        tags: ['Auth'],
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
              access_token: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { refresh_token } = refreshSchema.parse(request.body);

      const userId = await authService.validateRefreshToken(refresh_token, 'user');

      if (!userId) {
        return reply.status(401).send({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or expired',
        });
      }

      const user = await authService.getUserById(userId);

      if (!user || !user.active) {
        return reply.status(401).send({
          error: 'USER_INACTIVE',
          message: 'User account is inactive',
        });
      }

      const accessToken = app.jwt.sign(
        { id: user.id, type: 'user', role: user.role },
        { expiresIn: '15m' }
      );

      return { access_token: accessToken };
    }
  );

  // GET /auth/me - Get current user info
  app.get(
    '/auth/me',
    {
      preHandler: [app.authenticate],
      schema: {
        description: 'Get current user info',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              email: { type: 'string' },
              name: { type: 'string', nullable: true },
              role: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = request.user as { id: number; type: string; role: string };

      if (payload.type !== 'user') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'This endpoint is only for users',
        });
      }

      const user = await authService.getUserById(payload.id);

      if (!user) {
        return reply.status(404).send({
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      return user;
    }
  );
}
