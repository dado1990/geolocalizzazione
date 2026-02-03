import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { redis } from '../config/redis.js';
import type { User, UserWithPassword } from '../types/index.js';

const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

export class AuthService {
  // Validate user credentials
  async validateUser(email: string, password: string): Promise<User | null> {
    const result = await query<UserWithPassword>(
      'SELECT * FROM users WHERE email = $1 AND active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return null;
    }

    // Update last login
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Generate refresh token
  generateRefreshToken(): string {
    return `rt_${crypto.randomBytes(32).toString('hex')}`;
  }

  // Store refresh token in Redis
  async storeRefreshToken(
    userId: number,
    refreshToken: string,
    type: 'user' | 'device'
  ): Promise<void> {
    const key = `refresh:${type}:${refreshToken}`;
    await redis.setex(key, REFRESH_TOKEN_TTL, userId.toString());
  }

  // Validate refresh token
  async validateRefreshToken(
    refreshToken: string,
    type: 'user' | 'device'
  ): Promise<number | null> {
    const key = `refresh:${type}:${refreshToken}`;
    const userId = await redis.get(key);
    return userId ? parseInt(userId) : null;
  }

  // Revoke refresh token
  async revokeRefreshToken(
    refreshToken: string,
    type: 'user' | 'device'
  ): Promise<void> {
    const key = `refresh:${type}:${refreshToken}`;
    await redis.del(key);
  }

  // Get user by ID
  async getUserById(id: number): Promise<User | null> {
    const result = await query<User>(
      'SELECT id, email, name, role, active, created_at, last_login FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // Log audit action
  async logAudit(
    userId: number | null,
    action: string,
    resourceType?: string,
    resourceId?: number,
    changes?: Record<string, any>,
    ipAddress?: string
  ): Promise<void> {
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, resourceType, resourceId, JSON.stringify(changes), ipAddress]
    );
  }
}

export const authService = new AuthService();
