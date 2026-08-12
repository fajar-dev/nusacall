import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactResolverService } from '../src/modules/contacts/application/ContactResolverService';
import type { ContactRecord, ContactRepositoryPort } from '../src/modules/contacts/domain/ports/ContactRepositoryPort';
import { ValidationError } from '../src/shared/errors/AppError';

describe('E4-T2: ContactResolverService & E.164 Normalization', () => {
  let contactsStore: ContactRecord[];
  let mockContactRepo: ContactRepositoryPort;

  beforeEach(() => {
    contactsStore = [];

    mockContactRepo = {
      findByWaId: vi.fn().mockImplementation(async (orgId: string, waId: string) => {
        return contactsStore.find((c) => c.organizationId === orgId && c.waId === waId) || null;
      }),
      create: vi.fn().mockImplementation(async (data: Partial<ContactRecord>) => {
        const record: ContactRecord = {
          id: data.id || '01J8CNT0000000000000000001',
          organizationId: data.organizationId!,
          waId: data.waId!,
          phoneNumber: data.phoneNumber!,
          name: data.name || null,
          customAttributes: data.customAttributes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        contactsStore.push(record);
        return record;
      }),
      update: vi.fn().mockImplementation(async (orgId: string, id: string, patch: Partial<ContactRecord>) => {
        const idx = contactsStore.findIndex((c) => c.organizationId === orgId && c.id === id);
        if (idx === -1) throw new Error('Not found');
        const updated = { ...contactsStore[idx]!, ...patch, updatedAt: new Date() };
        contactsStore[idx] = updated;
        return updated;
      }),
    };
  });

  describe('normalizeE164', () => {
    it('should normalize Indonesian 08XX format to +628XX', () => {
      expect(ContactResolverService.normalizeE164('08123456789')).toBe('+628123456789');
    });

    it('should normalize 628XX format to +628XX', () => {
      expect(ContactResolverService.normalizeE164('628123456789')).toBe('+628123456789');
    });

    it('should strip spaces, dashes, and parentheses from +62 format', () => {
      expect(ContactResolverService.normalizeE164('+62 812-3456-7890')).toBe('+6281234567890');
    });
  });

  describe('resolveFromWebhook', () => {
    it('should create a new contact when wa_id does not exist', async () => {
      const resolver = new ContactResolverService(mockContactRepo);

      const contact = await resolver.resolveFromWebhook({
        organizationId: '01J8ORG0000000000000000001',
        waId: '628123456789',
        profileName: 'Budi Santoso',
        rawPhoneNumber: '08123456789',
      });

      expect(contact.waId).toBe('628123456789');
      expect(contact.phoneNumber).toBe('+628123456789');
      expect(contact.name).toBe('Budi Santoso');
      expect(mockContactRepo.create).toHaveBeenCalled();
    });

    it('should update existing contact name if profileName changed', async () => {
      contactsStore.push({
        id: '01J8CNT0000000000000000001',
        organizationId: '01J8ORG0000000000000000001',
        waId: '628123456789',
        phoneNumber: '+628123456789',
        name: 'Budi S.',
        customAttributes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const resolver = new ContactResolverService(mockContactRepo);

      const contact = await resolver.resolveFromWebhook({
        organizationId: '01J8ORG0000000000000000001',
        waId: '628123456789',
        profileName: 'Budi Santoso Baru',
      });

      expect(contact.name).toBe('Budi Santoso Baru');
      expect(mockContactRepo.update).toHaveBeenCalledWith(
        '01J8ORG0000000000000000001',
        '01J8CNT0000000000000000001',
        { name: 'Budi Santoso Baru' }
      );
    });

    it('should throw ValidationError if organizationId or waId is missing', async () => {
      const resolver = new ContactResolverService(mockContactRepo);

      await expect(
        resolver.resolveFromWebhook({
          organizationId: '',
          waId: '628123456789',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        resolver.resolveFromWebhook({
          organizationId: '01J8ORG0000000000000000001',
          waId: '',
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
