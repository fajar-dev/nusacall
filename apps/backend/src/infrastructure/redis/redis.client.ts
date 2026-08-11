import Redis, { type RedisOptions } from 'ioredis';
import { config } from '../../bootstrap/config';

export function getRedisOptions(): RedisOptions {
  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ compatibility
  };
}

export function createRedisClient(): Redis {
  return new Redis(getRedisOptions());
}
