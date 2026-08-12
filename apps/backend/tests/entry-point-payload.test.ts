import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntryPointPayloadService } from '../src/modules/routing/application/EntryPointPayloadService';
import type { EntryPointPayloadRecord, EntryPointPayloadRepositoryPort } from '../src/modules/routing/domain/ports/EntryPointPayloadRepositoryPort';
import { NotFoundError, ValidationError } from '../src/shared/errors/AppError';

describe('E4-T5: EntryPointPayloadService', () => {
  let eppStore: EntryPointPayloadRecord[];
  let mockEppRepo: EntryPointPayloadRepositoryPort;
  const org1 = '01J8ORG0000000000000000001';
  const phone1 = '01J8PN00000000000000000001';

  beforeEach(() => {
    eppStore = [];

    mockEppRepo = {
      create: vi.fn().mockImplementation(async (data: Partial<EntryPointPayloadRecord>) => {
        const record: EntryPointPayloadRecord = {
          id: data.id || '01J8EPP0000000000000000001',
          organizationId: data.organizationId!,
          phoneNumberId: data.phoneNumberId!,
          payload: data.payload!,
          targetQueueId: data.targetQueueId!,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        eppStore.push(record);
        return record;
      }),
      findById: vi.fn().mockImplementation(async (orgId: string, id: string) => {
        return eppStore.find((r) => r.organizationId === orgId && r.id === id) || null;
      }),
      findByPhoneAndPayload: vi.fn().mockImplementation(async (orgId: string, phoneId: string, payload: string) => {
        return eppStore.find((r) => r.organizationId === orgId && r.phoneNumberId === phoneId && r.payload === payload) || null;
      }),
      listByOrg: vi.fn().mockImplementation(async (orgId: string) => {
        return eppStore.filter((r) => r.organizationId === orgId);
      }),
      update: vi.fn().mockImplementation(async (orgId: string, id: string, patch: Partial<EntryPointPayloadRecord>) => {
        const idx = eppStore.findIndex((r) => r.organizationId === orgId && r.id === id);
        if (idx === -1) throw new NotFoundError('Pemetaan tidak ditemukan');
        const updated = { ...eppStore[idx]!, ...patch, updatedAt: new Date() };
        eppStore[idx] = updated;
        return updated;
      }),
      delete: vi.fn().mockImplementation(async (orgId: string, id: string) => {
        const idx = eppStore.findIndex((r) => r.organizationId === orgId && r.id === id);
        if (idx !== -1) {
          eppStore.splice(idx, 1);
          return true;
        }
        return false;
      }),
    };
  });

  it('should create and list entry point payload mappings scoped by organization', async () => {
    const service = new EntryPointPayloadService(mockEppRepo);

    const mapping = await service.createPayloadMapping(org1, phone1, 'VIP_CAMPAIGN', 'QUEUE_VIP');

    expect(mapping.payload).toBe('VIP_CAMPAIGN');
    expect(mapping.targetQueueId).toBe('QUEUE_VIP');

    const list = await service.listPayloadMappings(org1);
    expect(list.length).toBe(1);
  });

  it('should resolve target queue by phone number ID and payload', async () => {
    const service = new EntryPointPayloadService(mockEppRepo);
    await service.createPayloadMapping(org1, phone1, 'SUMMER_DEAL', 'QUEUE_SALES');

    const targetQueue = await service.resolveTargetQueue(org1, phone1, 'SUMMER_DEAL');
    expect(targetQueue).toBe('QUEUE_SALES');

    const notFound = await service.resolveTargetQueue(org1, phone1, 'UNKNOWN');
    expect(notFound).toBeNull();
  });

  it('should throw ValidationError on missing required fields', async () => {
    const service = new EntryPointPayloadService(mockEppRepo);

    await expect(service.createPayloadMapping('', phone1, 'PAYLOAD', 'Q1')).rejects.toThrow(ValidationError);
    await expect(service.createPayloadMapping(org1, '', 'PAYLOAD', 'Q1')).rejects.toThrow(ValidationError);
    await expect(service.createPayloadMapping(org1, phone1, '', 'Q1')).rejects.toThrow(ValidationError);
  });
});
