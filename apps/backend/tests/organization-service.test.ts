import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { OrganizationService } from '../src/modules/identity/application/OrganizationService';
import type {
  OrganizationRepository,
  CreateOrganizationParams,
  UpdateOrganizationParams,
} from '../src/modules/identity/domain/ports/OrganizationRepository';
import type { OrganizationProps } from '../src/modules/identity/domain/Organization';
import { ConflictError, NotFoundError } from '../src/shared/errors/AppError';

class InMemoryOrganizationRepository implements OrganizationRepository {
  private orgs = new Map<string, OrganizationProps>();

  async save(params: CreateOrganizationParams): Promise<OrganizationProps> {
    const id = params.id ?? crypto.randomUUID();
    const props: OrganizationProps = {
      id,
      name: params.name,
      slug: params.slug,
      timezone: params.timezone ?? 'Asia/Jakarta',
      defaultLocale: params.defaultLocale ?? 'id',
      status: params.status ?? 'ACTIVE',
      recordingPolicy: params.recordingPolicy ?? 'ALWAYS',
      transcriptionPolicy: params.transcriptionPolicy ?? 'ALWAYS',
      recordingPurpose: params.recordingPurpose ?? null,
      announcementLanguage: params.announcementLanguage ?? 'id',
      mediaRetentionDays: params.mediaRetentionDays ?? 365,
      cprDailyLimit: params.cprDailyLimit ?? 1,
      cprWeeklyLimit: params.cprWeeklyLimit ?? 2,
      aiSummaryEnabled: params.aiSummaryEnabled ?? false,
      settings: params.settings ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orgs.set(id, props);
    return props;
  }

  async update(id: string, params: UpdateOrganizationParams): Promise<OrganizationProps> {
    const existing = this.orgs.get(id);
    if (!existing) {
      throw new NotFoundError('ORGANIZATION_NOT_FOUND', `Organisasi ${id} tidak ditemukan`);
    }
    const updated: OrganizationProps = {
      ...existing,
      ...params,
      updatedAt: new Date(),
    };
    this.orgs.set(id, updated);
    return updated;
  }

  async findById(id: string): Promise<OrganizationProps | null> {
    return this.orgs.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<OrganizationProps | null> {
    for (const org of this.orgs.values()) {
      if (org.slug === slug) return org;
    }
    return null;
  }

  async findAll(): Promise<OrganizationProps[]> {
    return Array.from(this.orgs.values());
  }
}

describe('E1-T8: Organization CRUD & Settings Service', () => {
  it('should create organization successfully', async () => {
    const repo = new InMemoryOrganizationRepository();
    const service = new OrganizationService(repo);

    const org = await service.createOrganization({
      name: 'NusaCall Demo Org',
      slug: 'nusacall-demo',
    });

    expect(org.id).toBeDefined();
    expect(org.name).toBe('NusaCall Demo Org');
    expect(org.slug).toBe('nusacall-demo');
    expect(org.timezone).toBe('Asia/Jakarta');
  });

  it('should throw ConflictError if slug already exists', async () => {
    const repo = new InMemoryOrganizationRepository();
    const service = new OrganizationService(repo);

    await service.createOrganization({
      name: 'Org 1',
      slug: 'duplicate-slug',
    });

    await expect(
      service.createOrganization({
        name: 'Org 2',
        slug: 'duplicate-slug',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should update organization settings', async () => {
    const repo = new InMemoryOrganizationRepository();
    const service = new OrganizationService(repo);

    const created = await service.createOrganization({
      name: 'Initial Name',
      slug: 'my-org',
    });

    const updated = await service.updateOrganization(created.id, {
      name: 'Updated Name',
      mediaRetentionDays: 180,
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.mediaRetentionDays).toBe(180);
  });

  it('should list all organizations', async () => {
    const repo = new InMemoryOrganizationRepository();
    const service = new OrganizationService(repo);

    await service.createOrganization({ name: 'Org A', slug: 'org-a' });
    await service.createOrganization({ name: 'Org B', slug: 'org-b' });

    const list = await service.listOrganizations();
    expect(list).toHaveLength(2);
  });
});
