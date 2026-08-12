import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookReplayService } from '../src/modules/meta/application/WebhookReplayService';
import type { WebhookEventRecord, WebhookRepositoryPort } from '../src/modules/meta/domain/ports/WebhookRepositoryPort';
import type { QueuePort } from '../src/modules/meta/domain/ports/QueuePort';
import { NotFoundError, ConflictError } from '../src/shared/errors/AppError';

describe('E3-T5: Webhook Replay & DLQ Strategy', () => {
  let sampleEvent: WebhookEventRecord;
  let mockWebhookRepo: WebhookRepositoryPort;
  let mockQueue: QueuePort;

  beforeEach(() => {
    sampleEvent = {
      id: '01J8EVT0000000000000000002',
      metaAppId: 'APP1',
      organizationId: '01J8ORG0000000000000000001',
      dedupeKey: 'dedupe456',
      field: 'calls',
      wabaId: 'WABA1',
      phoneNumberId: 'PNID1',
      payload: { call: 'offer' },
      signatureValid: true,
      receivedAt: new Date(),
      status: 'FAILED',
      attempts: 5,
      lastError: 'Network timeout',
    };

    mockWebhookRepo = {
      save: vi.fn(),
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === sampleEvent.id) return sampleEvent;
        return null;
      }),
      update: vi.fn().mockImplementation(async (id: string, patch: Partial<WebhookEventRecord>) => {
        if (id === sampleEvent.id) {
          Object.assign(sampleEvent, patch);
        }
      }),
    };

    mockQueue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should reset failed event status to PENDING and re-enqueue job for replay', async () => {
    const replayService = new WebhookReplayService(mockWebhookRepo, mockQueue);

    await replayService.replayEvent(sampleEvent.id, '01J8ORG0000000000000000001');

    expect(sampleEvent.status).toBe('PENDING');
    expect(sampleEvent.attempts).toBe(0);
    expect(sampleEvent.lastError).toBeNull();
    expect(mockQueue.enqueue).toHaveBeenCalledWith('webhook-process', 'webhook.process', { webhookEventId: sampleEvent.id });
  });

  it('should throw NotFoundError if event does not exist', async () => {
    const replayService = new WebhookReplayService(mockWebhookRepo, mockQueue);

    await expect(replayService.replayEvent('non_existent_id', null)).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError if event belongs to different organization', async () => {
    const replayService = new WebhookReplayService(mockWebhookRepo, mockQueue);

    await expect(replayService.replayEvent(sampleEvent.id, 'OTHER_ORG')).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError if event is already PROCESSED', async () => {
    sampleEvent.status = 'PROCESSED';
    const replayService = new WebhookReplayService(mockWebhookRepo, mockQueue);

    await expect(replayService.replayEvent(sampleEvent.id, '01J8ORG0000000000000000001')).rejects.toThrow(ConflictError);
  });
});
