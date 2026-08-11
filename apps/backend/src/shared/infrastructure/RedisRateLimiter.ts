import type Redis from 'ioredis';
import type { RateLimiterPort, RateLimitResult } from '../domain/ports/RateLimiterPort';

export class RedisRateLimiter implements RateLimiterPort {
  constructor(private readonly redis: Redis) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    const ttl = await this.redis.ttl(key);
    const resetInSeconds = ttl > 0 ? ttl : windowSeconds;

    if (current > limit) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - current),
      resetInSeconds,
    };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
