import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookRetentionService, type ClockPort } from '../src/modules/meta/application/WebhookRetentionService';
import type { WebhookRepositoryPort } from '../src/modules/meta/domain/ports/WebhookRepositoryPort';

describe('E3-T8: Webhook Retention Cleanup 30 Days', () => {
  let mockWebhookRepo: WebhookRepositoryPort;
  let mockClock: ClockPort;
  const fixedNow = new Date('2026-08-12T12:00:00.000Z');

  beforeEach(() => {
    mockWebhookRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      deleteOlderThan: vi.fn().mockResolvedValue(42),
    };

    mockClock = {
      now: () => fixedNow,
    };
  });

  it('should calculate 30-day cutoff date and delete older webhook_events records', async () => {
    const service = new WebhookRetentionService(mockWebhookRepo, mockClock);

    const deletedCount = await service.cleanupOldEvents(30);

    expect(deletedCount).toBe(42);
    // 30 days before 2026-08-12 is 2026-07-13T12:00:00.000Z
    const expectedCutoff = new Date('2026-07-13T12:00:00.000Z');
    expect(mockWebhookRepo.deleteOlderThan).toHaveBeenCalledWith(expectedCutoff);
  });

  it('should support custom retention period', async () => {
    const service = new WebhookRetentionService(mockWebhookRepo, mockClock);

    await service.cleanupOldEvents(10);

    // 10 days before 2026-08-12 is 2026-08-02T12:00:00.000Z
    const expectedCutoff = new Date('2026-08-02T12:00:00.000Z');
    expect(mockWebhookRepo.deleteOlderThan).toHaveBeenCalledWith(expectedCutoff);
  });
});
