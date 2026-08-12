import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookProcessorWorker } from '../src/modules/meta/application/WebhookProcessorWorker';
import type { WebhookEventRecord, WebhookRepositoryPort } from '../src/modules/meta/domain/ports/WebhookRepositoryPort';
import type { TenantResolverPort } from '../src/modules/meta/domain/ports/TenantResolverPort';

describe('E3-T4: Worker webhook.process, tenant resolution & field router', () => {
  let sampleEvent: WebhookEventRecord;
  let mockWebhookRepo: WebhookRepositoryPort;
  let mockTenantResolver: TenantResolverPort;

  beforeEach(() => {
    sampleEvent = {
      id: '01J8EVT0000000000000000001',
      metaAppId: 'APP1',
      organizationId: null,
      dedupeKey: 'dedupe123',
      field: 'calls',
      wabaId: 'WABA99',
      phoneNumberId: 'PNID99',
      payload: { call: 'offer' },
      signatureValid: true,
      receivedAt: new Date(),
      status: 'PENDING',
      attempts: 0,
      lastError: null,
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
      deleteOlderThan: vi.fn().mockResolvedValue(0),
    };

    mockTenantResolver = {
      resolveOrganizationId: vi.fn().mockResolvedValue('01J8ORG0000000000000000001'),
    };
  });

  it('should resolve organizationId if missing and route calls event to onCallsEvent handler', async () => {
    const onCallsEvent = vi.fn().mockResolvedValue(undefined);
    const worker = new WebhookProcessorWorker(mockWebhookRepo, mockTenantResolver, {
      onCallsEvent,
    });

    await worker.processJob({ webhookEventId: sampleEvent.id });

    expect(mockTenantResolver.resolveOrganizationId).toHaveBeenCalledWith('WABA99', 'PNID99');
    expect(sampleEvent.organizationId).toBe('01J8ORG0000000000000000001');
    expect(onCallsEvent).toHaveBeenCalledWith(expect.objectContaining({ id: sampleEvent.id }));
    expect(sampleEvent.status).toBe('PROCESSED');
  });

  it('should route account_update event to onAccountUpdateEvent handler', async () => {
    sampleEvent.field = 'account_update';
    const onAccountUpdateEvent = vi.fn().mockResolvedValue(undefined);
    const worker = new WebhookProcessorWorker(mockWebhookRepo, mockTenantResolver, {
      onAccountUpdateEvent,
    });

    await worker.processJob({ webhookEventId: sampleEvent.id });

    expect(onAccountUpdateEvent).toHaveBeenCalledTimes(1);
    expect(sampleEvent.status).toBe('PROCESSED');
  });

  it('should route account_settings_update event to onAccountSettingsUpdateEvent handler', async () => {
    sampleEvent.field = 'account_settings_update';
    const onAccountSettingsUpdateEvent = vi.fn().mockResolvedValue(undefined);
    const worker = new WebhookProcessorWorker(mockWebhookRepo, mockTenantResolver, {
      onAccountSettingsUpdateEvent,
    });

    await worker.processJob({ webhookEventId: sampleEvent.id });

    expect(onAccountSettingsUpdateEvent).toHaveBeenCalledTimes(1);
    expect(sampleEvent.status).toBe('PROCESSED');
  });

  it('should mark event status as SKIPPED for unknown field', async () => {
    sampleEvent.field = 'unknown_future_field';
    const worker = new WebhookProcessorWorker(mockWebhookRepo, mockTenantResolver);

    await worker.processJob({ webhookEventId: sampleEvent.id });

    expect(sampleEvent.status).toBe('SKIPPED');
    expect(sampleEvent.lastError).toContain('Unknown field router');
  });

  it('should mark event status as PENDING on retry attempt when handler fails before maxAttempts', async () => {
    const onCallsEvent = vi.fn().mockRejectedValue(new Error('Handler crashed'));
    const worker = new WebhookProcessorWorker(mockWebhookRepo, mockTenantResolver, {
      onCallsEvent,
    }, 5);

    await expect(worker.processJob({ webhookEventId: sampleEvent.id })).rejects.toThrow('Handler crashed');

    expect(sampleEvent.status).toBe('PENDING');
    expect(sampleEvent.attempts).toBe(1);
    expect(sampleEvent.lastError).toBe('Handler crashed');
  });

  it('should mark event status as FAILED when maxAttempts reached', async () => {
    sampleEvent.attempts = 4;
    const onCallsEvent = vi.fn().mockRejectedValue(new Error('Handler crashed repeatedly'));
    const worker = new WebhookProcessorWorker(mockWebhookRepo, mockTenantResolver, {
      onCallsEvent,
    }, 5);

    await expect(worker.processJob({ webhookEventId: sampleEvent.id })).rejects.toThrow('Handler crashed repeatedly');

    expect(sampleEvent.status).toBe('FAILED');
    expect(sampleEvent.attempts).toBe(5);
    expect(sampleEvent.lastError).toBe('Handler crashed repeatedly');
  });
});
