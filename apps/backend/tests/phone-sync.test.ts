import { describe, it, expect, vi } from 'vitest';
import { PhoneSyncService, type WaPhoneNumberSyncRepositoryPort, type WaPhoneNumberSyncRecord } from '../src/modules/meta/application/PhoneSyncService';
import type { GraphApiClientPort } from '../src/modules/meta/domain/ports/GraphApiClientPort';

describe('E2-T7: Connection Test & 6-Hour Scheduled Settings Sync Service', () => {
  const sampleRecord: WaPhoneNumberSyncRecord = {
    id: 'pn_1',
    organizationId: 'org_1',
    phoneNumberId: 'pn_100',
    connectionStatus: 'HEALTHY',
    lastError: null,
    lastSyncedAt: null,
    callingStatus: 'ENABLED',
    callIconVisibility: 'DEFAULT',
    restrictToUserCountries: null,
    callbackPermissionStatus: 'APPROVED',
    callHours: null,
    sipStatus: 'DISABLED',
    restrictions: null,
  };

  class InMemoryPhoneSyncRepo implements WaPhoneNumberSyncRepositoryPort {
    public records = new Map<string, WaPhoneNumberSyncRecord>([['pn_100', { ...sampleRecord }]]);

    async findByPhoneNumberId(phoneNumberId: string): Promise<WaPhoneNumberSyncRecord | null> {
      return this.records.get(phoneNumberId) || null;
    }

    async findAllPhoneNumbers(): Promise<WaPhoneNumberSyncRecord[]> {
      return Array.from(this.records.values());
    }

    async updateConnectionStatus(
      phoneNumberId: string,
      status: 'HEALTHY' | 'UNHEALTHY',
      lastError?: string | null,
      syncedAt?: Date
    ): Promise<void> {
      const existing = this.records.get(phoneNumberId);
      if (existing) {
        existing.connectionStatus = status;
        existing.lastError = lastError ?? null;
        if (syncedAt) existing.lastSyncedAt = syncedAt;
      }
    }

    async updateCallingSettings(
      phoneNumberId: string,
      data: {
        callingStatus?: string;
        callIconVisibility?: string;
        restrictToUserCountries?: string[] | null;
        callbackPermissionStatus?: string;
        callHours?: Record<string, unknown> | null;
        sipStatus?: string;
        restrictions?: Record<string, unknown> | null;
        lastSyncedAt?: Date;
      }
    ): Promise<void> {
      const existing = this.records.get(phoneNumberId);
      if (existing) {
        if (data.callingStatus) existing.callingStatus = data.callingStatus;
        if (data.callIconVisibility) existing.callIconVisibility = data.callIconVisibility;
        if (data.restrictToUserCountries !== undefined) existing.restrictToUserCountries = data.restrictToUserCountries;
        if (data.callbackPermissionStatus) existing.callbackPermissionStatus = data.callbackPermissionStatus;
        if (data.callHours !== undefined) existing.callHours = data.callHours;
        if (data.sipStatus) existing.sipStatus = data.sipStatus;
        if (data.restrictions !== undefined) existing.restrictions = data.restrictions;
        if (data.lastSyncedAt) existing.lastSyncedAt = data.lastSyncedAt;
      }
    }
  }

  it('should pass testConnection and set status HEALTHY on Graph API success', async () => {
    const repo = new InMemoryPhoneSyncRepo();
    const mockGraphClient: GraphApiClientPort = {
      initiateCall: vi.fn(),
      preAcceptCall: vi.fn(),
      acceptCall: vi.fn(),
      rejectCall: vi.fn(),
      terminateCall: vi.fn(),
      getSettings: vi.fn().mockResolvedValue({ calling: { status: 'ENABLED' } }),
      updateSettings: vi.fn(),
      sendInteractiveVoiceCall: vi.fn(),
      sendTemplateMessage: vi.fn(),
      getMediaUrl: vi.fn(),
      downloadMedia: vi.fn(),
    };

    const service = new PhoneSyncService(repo, mockGraphClient);
    const result = await service.testConnection('pn_100');

    expect(result.healthy).toBe(true);
    expect(repo.records.get('pn_100')?.connectionStatus).toBe('HEALTHY');
    expect(repo.records.get('pn_100')?.lastError).toBeNull();
  });

  it('should mark status UNHEALTHY and record lastError on Graph API failure', async () => {
    const repo = new InMemoryPhoneSyncRepo();
    const mockGraphClient: GraphApiClientPort = {
      initiateCall: vi.fn(),
      preAcceptCall: vi.fn(),
      acceptCall: vi.fn(),
      rejectCall: vi.fn(),
      terminateCall: vi.fn(),
      getSettings: vi.fn().mockRejectedValue(new Error('Meta Graph API 500 Internal Error')),
      updateSettings: vi.fn(),
      sendInteractiveVoiceCall: vi.fn(),
      sendTemplateMessage: vi.fn(),
      getMediaUrl: vi.fn(),
      downloadMedia: vi.fn(),
    };

    const service = new PhoneSyncService(repo, mockGraphClient);
    const result = await service.testConnection('pn_100');

    expect(result.healthy).toBe(false);
    expect(result.error).toContain('Meta Graph API 500 Internal Error');
    expect(repo.records.get('pn_100')?.connectionStatus).toBe('UNHEALTHY');
    expect(repo.records.get('pn_100')?.lastError).toContain('Meta Graph API 500 Internal Error');
  });

  it('should sync settings from Meta and update DB record fields', async () => {
    const repo = new InMemoryPhoneSyncRepo();
    const mockGraphClient: GraphApiClientPort = {
      initiateCall: vi.fn(),
      preAcceptCall: vi.fn(),
      acceptCall: vi.fn(),
      rejectCall: vi.fn(),
      terminateCall: vi.fn(),
      getSettings: vi.fn().mockResolvedValue({
        calling: {
          status: 'ENABLED',
          call_icon_visibility: 'DISABLE_ALL',
          callback_permission_status: 'ENABLED',
          sip: { status: 'DISABLED' },
        },
      }),
      updateSettings: vi.fn(),
      sendInteractiveVoiceCall: vi.fn(),
      sendTemplateMessage: vi.fn(),
      getMediaUrl: vi.fn(),
      downloadMedia: vi.fn(),
    };

    const service = new PhoneSyncService(repo, mockGraphClient);
    const synced = await service.syncSettings('pn_100');

    expect(synced).toBe(true);
    expect(repo.records.get('pn_100')?.callIconVisibility).toBe('DISABLE_ALL');
    expect(repo.records.get('pn_100')?.lastSyncedAt).toBeDefined();
  });

  it('syncAllPhoneNumbers should process all registered numbers', async () => {
    const repo = new InMemoryPhoneSyncRepo();
    repo.records.set('pn_200', { ...sampleRecord, id: 'pn_2', phoneNumberId: 'pn_200' });

    const mockGraphClient: GraphApiClientPort = {
      initiateCall: vi.fn(),
      preAcceptCall: vi.fn(),
      acceptCall: vi.fn(),
      rejectCall: vi.fn(),
      terminateCall: vi.fn(),
      getSettings: vi.fn().mockResolvedValue({ calling: { status: 'ENABLED' } }),
      updateSettings: vi.fn(),
      sendInteractiveVoiceCall: vi.fn(),
      sendTemplateMessage: vi.fn(),
      getMediaUrl: vi.fn(),
      downloadMedia: vi.fn(),
    };

    const service = new PhoneSyncService(repo, mockGraphClient);
    const result = await service.syncAllPhoneNumbers();

    expect(result.total).toBe(2);
    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
  });
});
