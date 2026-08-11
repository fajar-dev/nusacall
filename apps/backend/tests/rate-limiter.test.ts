import { describe, it, expect, beforeEach } from 'vitest';
import Redis from 'ioredis-mock';
import { RedisRateLimiter } from '../src/shared/infrastructure/RedisRateLimiter';

describe('E1-T6: Login Rate Limiter & Lockout', () => {
  let redis: InstanceType<typeof Redis>;
  let rateLimiter: RedisRateLimiter;

  beforeEach(() => {
    redis = new Redis();
    rateLimiter = new RedisRateLimiter(redis as any);
  });

  it('should allow up to 5 login attempts within window', async () => {
    const key = 'ratelimit:login:user@example.com';
    const limit = 5;
    const windowSeconds = 900;

    for (let i = 1; i <= 5; i++) {
      const res = await rateLimiter.consume(key, limit, windowSeconds);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(5 - i);
    }
  });

  it('should reject 6th login attempt with allowed = false (lockout)', async () => {
    const key = 'ratelimit:login:user@example.com';
    const limit = 5;
    const windowSeconds = 900;

    for (let i = 1; i <= 5; i++) {
      await rateLimiter.consume(key, limit, windowSeconds);
    }

    const lockedRes = await rateLimiter.consume(key, limit, windowSeconds);
    expect(lockedRes.allowed).toBe(false);
    expect(lockedRes.remaining).toBe(0);
    expect(lockedRes.resetInSeconds).toBeGreaterThan(0);
  });

  it('should reset rate limit counter upon successful login', async () => {
    const key = 'ratelimit:login:user@example.com';
    await rateLimiter.consume(key, 5, 900);
    await rateLimiter.consume(key, 5, 900);

    await rateLimiter.reset(key);

    const freshRes = await rateLimiter.consume(key, 5, 900);
    expect(freshRes.allowed).toBe(true);
    expect(freshRes.remaining).toBe(4);
  });
});
