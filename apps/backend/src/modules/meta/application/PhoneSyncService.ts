import type { GraphApiClientPort } from '../domain/ports/GraphApiClientPort';

export interface WaPhoneNumberSyncRecord {
  id: string;
  organizationId: string;
  phoneNumberId: string;
  connectionStatus: string;
  lastError: string | null;
  lastSyncedAt: Date | null;
  callingStatus: string;
  callIconVisibility: string;
  restrictToUserCountries: string[] | null;
  callbackPermissionStatus: string;
  callHours: Record<string, unknown> | null;
  sipStatus: string;
  restrictions: Record<string, unknown> | null;
}

export interface WaPhoneNumberSyncRepositoryPort {
  findByPhoneNumberId(phoneNumberId: string): Promise<WaPhoneNumberSyncRecord | null>;
  findAllPhoneNumbers(): Promise<WaPhoneNumberSyncRecord[]>;
  updateConnectionStatus(
    phoneNumberId: string,
    status: 'HEALTHY' | 'UNHEALTHY',
    lastError?: string | null,
    syncedAt?: Date
  ): Promise<void>;
  updateCallingSettings(
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
  ): Promise<void>;
}

export class PhoneSyncService {
  constructor(
    private readonly repo: WaPhoneNumberSyncRepositoryPort,
    private readonly graphApiClient: GraphApiClientPort
  ) {}

  async testConnection(phoneNumberId: string): Promise<{ healthy: boolean; error?: string }> {
    const record = await this.repo.findByPhoneNumberId(phoneNumberId);
    if (!record) {
      return { healthy: false, error: 'Nomor telepon tidak ditemukan' };
    }

    try {
      await this.graphApiClient.getSettings({ phoneNumberId });
      const now = new Date();
      await this.repo.updateConnectionStatus(phoneNumberId, 'HEALTHY', null, now);
      return { healthy: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Uji koneksi Meta Graph API gagal';
      const now = new Date();
      await this.repo.updateConnectionStatus(phoneNumberId, 'UNHEALTHY', errMsg, now);
      return { healthy: false, error: errMsg };
    }
  }

  async syncSettings(phoneNumberId: string): Promise<boolean> {
    try {
      const settingsResponse = await this.graphApiClient.getSettings({ phoneNumberId });
      const calling = (settingsResponse?.calling || settingsResponse) as Record<string, unknown>;

      const callingStatus = typeof calling.status === 'string' ? calling.status : 'ENABLED';
      const callIconVisibility = typeof calling.call_icon_visibility === 'string' ? calling.call_icon_visibility : 'DEFAULT';
      const callIcons = calling.call_icons as Record<string, unknown> | undefined;
      const restrictToUserCountries = Array.isArray(callIcons?.restrict_to_user_countries)
        ? (callIcons.restrict_to_user_countries as string[])
        : null;
      const callbackPermissionStatus = typeof calling.callback_permission_status === 'string' ? calling.callback_permission_status : 'APPROVED';
      const callHours = (calling.call_hours as Record<string, unknown> | undefined) || null;
      const sip = calling.sip as Record<string, unknown> | undefined;
      const sipStatus = typeof sip?.status === 'string' ? sip.status : 'DISABLED';
      const restrictions = (calling.restrictions as Record<string, unknown> | undefined) || null;

      const now = new Date();
      await this.repo.updateCallingSettings(phoneNumberId, {
        callingStatus,
        callIconVisibility,
        restrictToUserCountries,
        callbackPermissionStatus,
        callHours,
        sipStatus,
        restrictions,
        lastSyncedAt: now,
      });

      await this.repo.updateConnectionStatus(phoneNumberId, 'HEALTHY', null, now);
      return true;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Sinkronisasi pengaturan Meta gagal';
      await this.repo.updateConnectionStatus(phoneNumberId, 'UNHEALTHY', errMsg, new Date());
      return false;
    }
  }

  async syncAllPhoneNumbers(): Promise<{ total: number; success: number; failed: number }> {
    const allNumbers = await this.repo.findAllPhoneNumbers();
    let success = 0;
    let failed = 0;

    for (const pn of allNumbers) {
      const res = await this.syncSettings(pn.phoneNumberId);
      if (res) {
        success++;
      } else {
        failed++;
      }
    }

    return { total: allNumbers.length, success, failed };
  }
}
