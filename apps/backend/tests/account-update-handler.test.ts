import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetaAccountUpdateHandler, type AuditNotificationPort } from '../src/modules/meta/application/MetaAccountUpdateHandler';
import type { WebhookEventRecord } from '../src/modules/meta/domain/ports/WebhookRepositoryPort';
import type { WabaRepositoryPort, WabaRecord } from '../src/modules/meta/domain/ports/WabaRepositoryPort';
import type { PhoneNumberRepositoryPort, PhoneNumberRecord } from '../src/modules/meta/domain/ports/PhoneNumberRepositoryPort';

describe('E3-T6: Handler account_update & account_settings_update + notification', () => {
  let sampleWaba: WabaRecord;
  let samplePhone: PhoneNumberRecord;
  let mockWabaRepo: WabaRepositoryPort;
  let mockPhoneRepo: PhoneNumberRepositoryPort;
  let mockNotifier: AuditNotificationPort;

  beforeEach(() => {
    sampleWaba = {
      id: '01J8WABA000000000000000001',
      organizationId: '01J8ORG0000000000000000001',
      wabaId: 'WABA_100',
      name: 'Test WABA',
      status: 'ACTIVE',
    };

    samplePhone = {
      id: '01J8PNID000000000000000001',
      organizationId: '01J8ORG0000000000000000001',
      phoneNumberId: 'PNID_100',
      displayPhoneNumber: '+628123456789',
      status: 'ACTIVE',
    };

    mockWabaRepo = {
      findByWabaId: vi.fn().mockImplementation(async (wabaId: string) => {
        if (wabaId === sampleWaba.wabaId) return sampleWaba;
        return null;
      }),
      updateStatus: vi.fn().mockImplementation(async (wabaId: string, status: string) => {
        if (wabaId === sampleWaba.wabaId) sampleWaba.status = status;
      }),
    };

    mockPhoneRepo = {
      findByPhoneNumberId: vi.fn().mockImplementation(async (pnId: string) => {
        if (pnId === samplePhone.phoneNumberId) return samplePhone;
        return null;
      }),
      updateStatus: vi.fn().mockImplementation(async (pnId: string, status: string) => {
        if (pnId === samplePhone.phoneNumberId) samplePhone.status = status;
      }),
    };

    mockNotifier = {
      notifyAccountRestriction: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should process account_update and update WABA status to RESTRICTED with notification', async () => {
    const handler = new MetaAccountUpdateHandler(mockWabaRepo, mockPhoneRepo, mockNotifier);
    const event: WebhookEventRecord = {
      id: '01J8EVT0000000000000000003',
      metaAppId: 'APP1',
      organizationId: '01J8ORG0000000000000000001',
      dedupeKey: 'dedupe789',
      field: 'account_update',
      wabaId: 'WABA_100',
      phoneNumberId: null,
      payload: {
        entry: [
          {
            changes: [
              {
                value: {
                  event: 'RESTRICTED',
                  restriction_info: 'Policy violation',
                },
              },
            ],
          },
        ],
      },
      signatureValid: true,
      receivedAt: new Date(),
      status: 'PENDING',
      attempts: 0,
      lastError: null,
    };

    await handler.handleAccountUpdate(event);

    expect(mockWabaRepo.updateStatus).toHaveBeenCalledWith('WABA_100', 'RESTRICTED');
    expect(sampleWaba.status).toBe('RESTRICTED');
    expect(mockNotifier.notifyAccountRestriction).toHaveBeenCalledWith({
      organizationId: '01J8ORG0000000000000000001',
      targetType: 'WABA',
      targetId: 'WABA_100',
      newStatus: 'RESTRICTED',
      reason: 'Policy violation',
    });
  });

  it('should process account_update and update phone number status to DISABLED with notification', async () => {
    const handler = new MetaAccountUpdateHandler(mockWabaRepo, mockPhoneRepo, mockNotifier);
    const event: WebhookEventRecord = {
      id: '01J8EVT0000000000000000004',
      metaAppId: 'APP1',
      organizationId: '01J8ORG0000000000000000001',
      dedupeKey: 'dedupe790',
      field: 'account_update',
      wabaId: null,
      phoneNumberId: 'PNID_100',
      payload: {
        account_status: 'DISABLED',
        reason: 'Payment issue',
      },
      signatureValid: true,
      receivedAt: new Date(),
      status: 'PENDING',
      attempts: 0,
      lastError: null,
    };

    await handler.handleAccountUpdate(event);

    expect(mockPhoneRepo.updateStatus).toHaveBeenCalledWith('PNID_100', 'DISABLED');
    expect(samplePhone.status).toBe('DISABLED');
    expect(mockNotifier.notifyAccountRestriction).toHaveBeenCalledWith({
      organizationId: '01J8ORG0000000000000000001',
      targetType: 'PHONE_NUMBER',
      targetId: 'PNID_100',
      newStatus: 'DISABLED',
      reason: 'Payment issue',
    });
  });

  it('should process account_settings_update and update WABA status when status is provided', async () => {
    const handler = new MetaAccountUpdateHandler(mockWabaRepo, mockPhoneRepo, mockNotifier);
    const event: WebhookEventRecord = {
      id: '01J8EVT0000000000000000005',
      metaAppId: 'APP1',
      organizationId: '01J8ORG0000000000000000001',
      dedupeKey: 'dedupe791',
      field: 'account_settings_update',
      wabaId: 'WABA_100',
      phoneNumberId: null,
      payload: {
        status: 'ACTIVE',
      },
      signatureValid: true,
      receivedAt: new Date(),
      status: 'PENDING',
      attempts: 0,
      lastError: null,
    };

    await handler.handleAccountSettingsUpdate(event);

    expect(mockWabaRepo.updateStatus).toHaveBeenCalledWith('WABA_100', 'ACTIVE');
    expect(sampleWaba.status).toBe('ACTIVE');
  });
});
