import type { WebhookEventRecord } from '../domain/ports/WebhookRepositoryPort';
import type { WabaRepositoryPort } from '../domain/ports/WabaRepositoryPort';
import type { PhoneNumberRepositoryPort } from '../domain/ports/PhoneNumberRepositoryPort';

export interface AuditNotificationPort {
  notifyAccountRestriction(data: {
    organizationId: string | null;
    targetType: 'WABA' | 'PHONE_NUMBER';
    targetId: string;
    newStatus: string;
    reason?: string | undefined;
  }): Promise<void>;
}

export class MetaAccountUpdateHandler {
  constructor(
    private readonly wabaRepository: WabaRepositoryPort,
    private readonly phoneNumberRepository: PhoneNumberRepositoryPort,
    private readonly auditNotifier?: AuditNotificationPort
  ) {}

  async handleAccountUpdate(event: WebhookEventRecord): Promise<void> {
    const payload = event.payload || {};
    const entry = (Array.isArray(payload.entry) ? payload.entry[0] : payload) as Record<string, unknown>;
    const changes = (Array.isArray(entry.changes) ? entry.changes[0] : entry) as Record<string, unknown>;
    const value = (changes.value || entry.value || payload) as Record<string, unknown>;

    const newStatus = String(value.event || value.account_status || value.status || 'RESTRICTED').toUpperCase();
    const rawReason = value.ban_info || value.restriction_info || value.reason;
    const reason = rawReason ? String(rawReason) : undefined;

    if (event.wabaId) {
      const waba = await this.wabaRepository.findByWabaId(event.wabaId);
      if (waba) {
        await this.wabaRepository.updateStatus(event.wabaId, newStatus);
        if (this.auditNotifier) {
          await this.auditNotifier.notifyAccountRestriction({
            organizationId: waba.organizationId,
            targetType: 'WABA',
            targetId: event.wabaId,
            newStatus,
            reason,
          });
        }
      }
    }

    if (event.phoneNumberId) {
      const phone = await this.phoneNumberRepository.findByPhoneNumberId(event.phoneNumberId);
      if (phone) {
        await this.phoneNumberRepository.updateStatus(event.phoneNumberId, newStatus);
        if (this.auditNotifier) {
          await this.auditNotifier.notifyAccountRestriction({
            organizationId: phone.organizationId,
            targetType: 'PHONE_NUMBER',
            targetId: event.phoneNumberId,
            newStatus,
            reason,
          });
        }
      }
    }
  }

  async handleAccountSettingsUpdate(event: WebhookEventRecord): Promise<void> {
    const payload = event.payload || {};
    const entry = (Array.isArray(payload.entry) ? payload.entry[0] : payload) as Record<string, unknown>;
    const changes = (Array.isArray(entry.changes) ? entry.changes[0] : entry) as Record<string, unknown>;
    const value = (changes.value || entry.value || payload) as Record<string, unknown>;

    const newStatus = value.status ? String(value.status).toUpperCase() : 'UPDATED';

    if (event.wabaId) {
      const waba = await this.wabaRepository.findByWabaId(event.wabaId);
      if (waba && value.status) {
        await this.wabaRepository.updateStatus(event.wabaId, newStatus);
      }
    }

    if (event.phoneNumberId) {
      const phone = await this.phoneNumberRepository.findByPhoneNumberId(event.phoneNumberId);
      if (phone && value.status) {
        await this.phoneNumberRepository.updateStatus(event.phoneNumberId, newStatus);
      }
    }
  }
}
