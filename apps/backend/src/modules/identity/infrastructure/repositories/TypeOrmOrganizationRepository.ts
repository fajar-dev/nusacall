import type { Repository } from 'typeorm';
import crypto from 'node:crypto';
import { OrganizationEntity } from '../entities/OrganizationEntity';
import type {
  OrganizationRepository,
  CreateOrganizationParams,
  UpdateOrganizationParams,
} from '../../domain/ports/OrganizationRepository';
import type { OrganizationProps } from '../../domain/Organization';
import { NotFoundError } from '../../../../shared/errors/AppError';

export class TypeOrmOrganizationRepository implements OrganizationRepository {
  constructor(private readonly repo: Repository<OrganizationEntity>) {}

  private mapToProps(entity: OrganizationEntity): OrganizationProps {
    return {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      timezone: entity.timezone,
      defaultLocale: entity.defaultLocale,
      status: entity.status,
      recordingPolicy: entity.recordingPolicy,
      transcriptionPolicy: entity.transcriptionPolicy,
      recordingPurpose: entity.recordingPurpose,
      announcementLanguage: entity.announcementLanguage,
      mediaRetentionDays: entity.mediaRetentionDays,
      cprDailyLimit: entity.cprDailyLimit,
      cprWeeklyLimit: entity.cprWeeklyLimit,
      aiSummaryEnabled: Boolean(entity.aiSummaryEnabled),
      settings: entity.settings,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  async save(params: CreateOrganizationParams): Promise<OrganizationProps> {
    const entity = this.repo.create({
      id: params.id ?? crypto.randomUUID().replace(/-/g, '').substring(0, 26),
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
      aiSummaryEnabled: params.aiSummaryEnabled ? 1 : 0,
      settings: params.settings ?? null,
    });

    const saved = await this.repo.save(entity);
    return this.mapToProps(saved);
  }

  async update(id: string, params: UpdateOrganizationParams): Promise<OrganizationProps> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) {
      throw new NotFoundError('ORGANIZATION_NOT_FOUND', `Organisasi ${id} tidak ditemukan`);
    }

    if (params.name !== undefined) entity.name = params.name;
    if (params.timezone !== undefined) entity.timezone = params.timezone;
    if (params.defaultLocale !== undefined) entity.defaultLocale = params.defaultLocale;
    if (params.status !== undefined) entity.status = params.status;
    if (params.recordingPolicy !== undefined) entity.recordingPolicy = params.recordingPolicy;
    if (params.transcriptionPolicy !== undefined) entity.transcriptionPolicy = params.transcriptionPolicy;
    if (params.recordingPurpose !== undefined) entity.recordingPurpose = params.recordingPurpose;
    if (params.announcementLanguage !== undefined) entity.announcementLanguage = params.announcementLanguage;
    if (params.mediaRetentionDays !== undefined) entity.mediaRetentionDays = params.mediaRetentionDays;
    if (params.cprDailyLimit !== undefined) entity.cprDailyLimit = params.cprDailyLimit;
    if (params.cprWeeklyLimit !== undefined) entity.cprWeeklyLimit = params.cprWeeklyLimit;
    if (params.aiSummaryEnabled !== undefined) entity.aiSummaryEnabled = params.aiSummaryEnabled ? 1 : 0;
    if (params.settings !== undefined) entity.settings = params.settings;

    const saved = await this.repo.save(entity);
    return this.mapToProps(saved);
  }

  async findById(id: string): Promise<OrganizationProps | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? this.mapToProps(entity) : null;
  }

  async findBySlug(slug: string): Promise<OrganizationProps | null> {
    const entity = await this.repo.findOneBy({ slug });
    return entity ? this.mapToProps(entity) : null;
  }

  async findAll(): Promise<OrganizationProps[]> {
    const entities = await this.repo.find({ order: { createdAt: 'DESC' } });
    return entities.map((e) => this.mapToProps(e));
  }
}
