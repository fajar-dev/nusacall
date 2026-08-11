import { describe, it, expect } from 'vitest';
import { getRedisOptions } from '../src/infrastructure/redis/redis.client';
import { QUEUE_NAMES, createQueue } from '../src/infrastructure/queue/queue.config';

describe('E0-T8: Redis & BullMQ Configuration', () => {
  it('getRedisOptions should return maxRetriesPerRequest: null for BullMQ compatibility', () => {
    const opts = getRedisOptions();
    expect(opts.host).toBeDefined();
    expect(opts.port).toBeDefined();
    expect(opts.maxRetriesPerRequest).toBeNull();
  });

  it('createQueue should initialize a BullMQ Queue with expected name', () => {
    const queue = createQueue(QUEUE_NAMES.WEBHOOK_PROCESS);
    expect(queue.name).toBe('webhook.process');
    // Close connection to prevent dangling handles in tests
    queue.close();
  });
});
