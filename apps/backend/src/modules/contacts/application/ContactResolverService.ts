import { ulid } from 'ulid';
import type { ContactRecord, ContactRepositoryPort } from '../domain/ports/ContactRepositoryPort';
import { ValidationError } from '../../../shared/errors/AppError';

export class ContactResolverService {
  constructor(private readonly contactRepository: ContactRepositoryPort) {}

  public static normalizeE164(raw: string): string {
    const cleaned = raw.trim().replace(/[\s\-()]/g, '');
    if (!cleaned) return '';

    if (cleaned.startsWith('+')) {
      return '+' + cleaned.slice(1).replace(/\D/g, '');
    }
    if (cleaned.startsWith('08')) {
      return '+628' + cleaned.slice(2).replace(/\D/g, '');
    }
    if (cleaned.startsWith('62')) {
      return '+' + cleaned.replace(/\D/g, '');
    }
    return '+' + cleaned.replace(/\D/g, '');
  }

  async resolveFromWebhook(params: {
    organizationId: string;
    waId: string;
    profileName?: string | undefined;
    rawPhoneNumber?: string | undefined;
  }): Promise<ContactRecord> {
    if (!params.organizationId) {
      throw new ValidationError('organizationId wajib diisi');
    }
    if (!params.waId) {
      throw new ValidationError('waId wajib diisi');
    }

    const rawPhone = params.rawPhoneNumber || params.waId;
    const normalizedPhone = ContactResolverService.normalizeE164(rawPhone);

    const existing = await this.contactRepository.findByWaId(params.organizationId, params.waId);

    if (existing) {
      if (params.profileName && params.profileName !== existing.name) {
        return await this.contactRepository.update(params.organizationId, existing.id, {
          name: params.profileName,
        });
      }
      return existing;
    }

    const newContact: Omit<ContactRecord, 'createdAt' | 'updatedAt'> = {
      id: ulid(),
      organizationId: params.organizationId,
      waId: params.waId,
      phoneNumber: normalizedPhone,
      name: params.profileName || null,
      customAttributes: null,
    };

    return await this.contactRepository.create(newContact);
  }
}
