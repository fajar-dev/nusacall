import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxPollerService } from '../src/modules/meta/application/OutboxPollerService';
import type { DomainEventRecord, DomainEventRepositoryPort } from '../src/modules/meta/domain/ports/DomainEventRepositoryPort';
import type { EventPublisherPort } from '../src/modules/meta/domain/ports/EventPublisherPort';

describe('E3-T7: Outbox domain_events & Poller Publisher', () => {
  let pendingEvents: DomainEventRecord[];
  let mockEventRepo: DomainEventRepositoryPort;
  let mockPublisher: EventPublisherPort;

  beforeEach(() => {
    pendingEvents = [
      {
        id: '01J8EVT0000000000000000010',
        organizationId: '01J8ORG0000000000000000001',
        aggregateType: 'WABA',
        aggregateId: 'WABA1',
        eventType: 'waba.status_changed',
        payload: { status: 'RESTRICTED' },
        status: 'PENDING',
        publishedAt: null,
        createdAt: new Date(),
      },
      {
        id: '01J8EVT0000000000000000011',
        organizationId: '01J8ORG0000000000000000001',
        aggregateType: 'PHONE_NUMBER',
        aggregateId: 'PNID1',
        eventType: 'phone_number.status_changed',
        payload: { status: 'ACTIVE' },
        status: 'PENDING',
        publishedAt: null,
        createdAt: new Date(),
      },
    ];

    mockEventRepo = {
      save: vi.fn(),
      fetchPending: vi.fn().mockImplementation(async (limit: number) => {
        return pendingEvents.slice(0, limit);
      }),
      markPublished: vi.fn().mockImplementation(async (ids: string[]) => {
        pendingEvents.forEach((evt) => {
          if (ids.includes(evt.id)) {
            evt.status = 'PUBLISHED';
            evt.publishedAt = new Date();
          }
        });
      }),
      markFailed: vi.fn().mockImplementation(async (id: string) => {
        const evt = pendingEvents.find((e) => e.id === id);
        if (evt) evt.status = 'FAILED';
      }),
    };

    mockPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should poll pending events, publish them, and mark as PUBLISHED', async () => {
    const poller = new OutboxPollerService(mockEventRepo, mockPublisher);

    const count = await poller.pollAndPublish(50);

    expect(count).toBe(2);
    expect(mockPublisher.publish).toHaveBeenCalledTimes(2);
    expect(mockEventRepo.markPublished).toHaveBeenCalledWith([
      '01J8EVT0000000000000000010',
      '01J8EVT0000000000000000011',
    ]);
    expect(pendingEvents[0]!.status).toBe('PUBLISHED');
    expect(pendingEvents[1]!.status).toBe('PUBLISHED');
  });

  it('should mark event as FAILED when publisher throws error', async () => {
    mockPublisher.publish = vi.fn().mockImplementation(async (evt: DomainEventRecord) => {
      if (evt.id === '01J8EVT0000000000000000010') {
        throw new Error('Kafka broker unavailable');
      }
    });

    const poller = new OutboxPollerService(mockEventRepo, mockPublisher);

    const count = await poller.pollAndPublish(50);

    expect(count).toBe(1);
    expect(mockEventRepo.markFailed).toHaveBeenCalledWith('01J8EVT0000000000000000010', 'Kafka broker unavailable');
    expect(mockEventRepo.markPublished).toHaveBeenCalledWith(['01J8EVT0000000000000000011']);
    expect(pendingEvents[0]!.status).toBe('FAILED');
    expect(pendingEvents[1]!.status).toBe('PUBLISHED');
  });

  it('should return 0 when no pending events exist', async () => {
    pendingEvents = [];
    const poller = new OutboxPollerService(mockEventRepo, mockPublisher);

    const count = await poller.pollAndPublish(50);

    expect(count).toBe(0);
    expect(mockPublisher.publish).not.toHaveBeenCalled();
    expect(mockEventRepo.markPublished).not.toHaveBeenCalled();
  });
});
