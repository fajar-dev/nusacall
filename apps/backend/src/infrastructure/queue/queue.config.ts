import { Queue } from 'bullmq';
import { getRedisOptions } from '../redis/redis.client';

export const QUEUE_NAMES = {
  WEBHOOK_PROCESS: 'webhook.process',
  MEDIA_DOWNLOAD: 'media.download',
  CALLS_STALE_SWEEPER: 'calls.stale-sweeper',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export function createQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection: getRedisOptions(),
  });
}

export function registerQueues(): Record<QueueName, Queue> {
  const queues = {} as Record<QueueName, Queue>;
  for (const name of Object.values(QUEUE_NAMES)) {
    queues[name] = createQueue(name);
  }
  return queues;
}
