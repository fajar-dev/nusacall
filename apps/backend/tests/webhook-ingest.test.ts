import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { WebhookIngestService } from '../src/modules/meta/application/WebhookIngestService';
import { createMetaWebhookRouter } from '../src/modules/meta/interface/http/MetaWebhookController';
import type { MetaAppRecord, MetaAppRepositoryPort } from '../src/modules/meta/domain/ports/MetaAppRepositoryPort';
import type { WebhookEventRecord, WebhookRepositoryPort } from '../src/modules/meta/domain/ports/WebhookRepositoryPort';
import type { QueuePort } from '../src/modules/meta/domain/ports/QueuePort';

describe('E3-T3: POST /webhooks/meta/:metaAppId Raw Body, HMAC Verification, Ingestion & Enqueueing', () => {
  const sampleMetaApp: MetaAppRecord = {
    id: '01J8METAAPP000000000000001',
    appId: '123456789',
    name: 'Test Meta App',
    verifyToken: 'secret_verify_token',
    appSecret: 'test_meta_app_secret_999',
  };

  const storedEvents = new Map<string, WebhookEventRecord>();

  let mockMetaAppRepo: MetaAppRepositoryPort;
  let mockWebhookRepo: WebhookRepositoryPort;
  let mockQueuePort: QueuePort;
  let service: WebhookIngestService;

  beforeEach(() => {
    storedEvents.clear();

    mockMetaAppRepo = {
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === '01J8METAAPP000000000000001') return sampleMetaApp;
        return null;
      }),
    };

    mockWebhookRepo = {
      save: vi.fn().mockImplementation(async (evt: Partial<WebhookEventRecord>) => {
        const dedupeKey = evt.dedupeKey!;
        if (storedEvents.has(dedupeKey)) {
          return { inserted: false, id: storedEvents.get(dedupeKey)!.id };
        }
        const record = { ...evt } as WebhookEventRecord;
        storedEvents.set(dedupeKey, record);
        return { inserted: true, id: record.id };
      }),
      findById: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
      deleteOlderThan: vi.fn().mockResolvedValue(0),
    };

    mockQueuePort = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    service = new WebhookIngestService(mockMetaAppRepo, mockWebhookRepo, mockQueuePort);
  });

  const generateSignature = (body: string, secret: string) => {
    const hmac = createHmac('sha256', secret).update(body).digest('hex');
    return `sha256=${hmac}`;
  };

  it('DoD 1: should accept valid HMAC signature, save pending event, enqueue job, and return 200', async () => {
    const app = createMetaWebhookRouter(mockMetaAppRepo, service);
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA123',
          changes: [
            {
              field: 'calls',
              value: {
                metadata: { phone_number_id: 'PNID456' },
              },
            },
          ],
        },
      ],
    });
    const sig = generateSignature(body, sampleMetaApp.appSecret);

    const res = await app.request('/meta/01J8METAAPP000000000000001', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': sig,
        'content-type': 'application/json',
      },
      body,
    });

    expect(res.status).toBe(200);
    expect(mockWebhookRepo.save).toHaveBeenCalledTimes(1);
    expect(mockQueuePort.enqueue).toHaveBeenCalledTimes(1);
    expect(mockQueuePort.enqueue).toHaveBeenCalledWith(
      'webhook.process',
      'process-webhook',
      expect.objectContaining({ webhookEventId: expect.any(String) }),
      expect.anything()
    );

    const savedRecord = Array.from(storedEvents.values())[0];
    expect(savedRecord).toBeDefined();
    expect(savedRecord?.signatureValid).toBe(true);
    expect(savedRecord?.status).toBe('PENDING');
    expect(savedRecord?.wabaId).toBe('WABA123');
    expect(savedRecord?.phoneNumberId).toBe('PNID456');
  });

  it('DoD 2: should handle invalid HMAC signature by saving skipped event, NOT enqueueing job, and returning 200', async () => {
    const app = createMetaWebhookRouter(mockMetaAppRepo, service);
    const body = JSON.stringify({ event: 'test' });
    const invalidSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

    const res = await app.request('/meta/01J8METAAPP000000000000001', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': invalidSig,
      },
      body,
    });

    expect(res.status).toBe(200);
    expect(mockWebhookRepo.save).toHaveBeenCalledTimes(1);
    expect(mockQueuePort.enqueue).not.toHaveBeenCalled();

    const savedRecord = Array.from(storedEvents.values())[0];
    expect(savedRecord).toBeDefined();
    expect(savedRecord?.signatureValid).toBe(false);
    expect(savedRecord?.status).toBe('SKIPPED');
  });

  it('DoD 3: should handle missing signature header by saving skipped event and NOT enqueueing job', async () => {
    const app = createMetaWebhookRouter(mockMetaAppRepo, service);
    const body = JSON.stringify({ event: 'test_no_sig' });

    const res = await app.request('/meta/01J8METAAPP000000000000001', {
      method: 'POST',
      body,
    });

    expect(res.status).toBe(200);
    expect(mockQueuePort.enqueue).not.toHaveBeenCalled();

    const savedRecord = Array.from(storedEvents.values())[0];
    expect(savedRecord).toBeDefined();
    expect(savedRecord?.signatureValid).toBe(false);
    expect(savedRecord?.status).toBe('SKIPPED');
  });

  it('DoD 4: duplicate payloads should result in only ONE enqueued job', async () => {
    const app = createMetaWebhookRouter(mockMetaAppRepo, service);
    const body = JSON.stringify({ event: 'duplicate_test', id: 100 });
    const sig = generateSignature(body, sampleMetaApp.appSecret);

    // First request
    const res1 = await app.request('/meta/01J8METAAPP000000000000001', {
      method: 'POST',
      headers: { 'x-hub-signature-256': sig },
      body,
    });
    expect(res1.status).toBe(200);
    expect(mockQueuePort.enqueue).toHaveBeenCalledTimes(1);

    // Second request (identical body & dedupeKey)
    const res2 = await app.request('/meta/01J8METAAPP000000000000001', {
      method: 'POST',
      headers: { 'x-hub-signature-256': sig },
      body,
    });
    expect(res2.status).toBe(200);
    // Queue should STILL be called only once
    expect(mockQueuePort.enqueue).toHaveBeenCalledTimes(1);
  });

  it('DoD 5: processing speed should be < 300 ms', async () => {
    const app = createMetaWebhookRouter(mockMetaAppRepo, service);
    const body = JSON.stringify({ speed: 'fast' });
    const sig = generateSignature(body, sampleMetaApp.appSecret);

    const start = Date.now();
    const res = await app.request('/meta/01J8METAAPP000000000000001', {
      method: 'POST',
      headers: { 'x-hub-signature-256': sig },
      body,
    });
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(300);
  });
});
