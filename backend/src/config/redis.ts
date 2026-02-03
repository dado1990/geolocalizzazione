import Redis from 'ioredis';
import 'dotenv/config';

// Redis connection
export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'redis123',
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
});

redis.on('connect', () => {
  console.log('🔴 Redis: connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function cacheSet(
  key: string,
  value: any,
  ttlSeconds?: number
): Promise<void> {
  const data = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, data);
  } else {
    await redis.set(key, data);
  }
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

// Pub/Sub for real-time updates
export const redisPub = redis.duplicate();
export const redisSub = redis.duplicate();

export default redis;
