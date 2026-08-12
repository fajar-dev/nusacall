import { ulid } from 'ulid';
import type { EntryPointPayloadRecord, EntryPointPayloadRepositoryPort } from '../domain/ports/EntryPointPayloadRepositoryPort';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class EntryPointPayloadService {
  constructor(private readonly eppRepo: EntryPointPayloadRepositoryPort) {}

  async createPayloadMapping(
    organizationId: string,
    phoneNumberId: string,
    payload: string,
    targetQueueId: string
  ): Promise<EntryPointPayloadRecord> {
    if (!organizationId) throw new ValidationError('organizationId wajib diisi');
    if (!phoneNumberId) throw new ValidationError('phoneNumberId wajib diisi');
    if (!payload.trim()) throw new ValidationError('payload wajib diisi');
    if (!targetQueueId) throw new ValidationError('targetQueueId wajib diisi');

    const newRecord: Omit<EntryPointPayloadRecord, 'createdAt' | 'updatedAt'> = {
      id: ulid(),
      organizationId,
      phoneNumberId,
      payload: payload.trim(),
      targetQueueId,
    };
    return await this.eppRepo.create(newRecord);
  }

  async getPayloadMapping(organizationId: string, id: string): Promise<EntryPointPayloadRecord> {
    const record = await this.eppRepo.findById(organizationId, id);
    if (!record) throw new NotFoundError('Pemetaan entry point payload tidak ditemukan');
    return record;
  }

  async listPayloadMappings(organizationId: string): Promise<EntryPointPayloadRecord[]> {
    return await this.eppRepo.listByOrg(organizationId);
  }

  async updatePayloadMapping(
    organizationId: string,
    id: string,
    patch: Partial<Omit<EntryPointPayloadRecord, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>
  ): Promise<EntryPointPayloadRecord> {
    await this.getPayloadMapping(organizationId, id);
    return await this.eppRepo.update(organizationId, id, patch);
  }

  async deletePayloadMapping(organizationId: string, id: string): Promise<void> {
    await this.getPayloadMapping(organizationId, id);
    await this.eppRepo.delete(organizationId, id);
  }

  async resolveTargetQueue(organizationId: string, phoneNumberId: string, payload: string): Promise<string | null> {
    if (!organizationId || !phoneNumberId || !payload) return null;
    const match = await this.eppRepo.findByPhoneAndPayload(organizationId, phoneNumberId, payload);
    return match ? match.targetQueueId : null;
  }
}
