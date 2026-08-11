import type { OrganizationProps } from '../Organization';

export interface CreateOrganizationParams {
  id?: string;
  name: string;
  slug: string;
  timezone?: string;
  defaultLocale?: string;
  status?: string;
  recordingPolicy?: string;
  transcriptionPolicy?: string;
  recordingPurpose?: string | null;
  announcementLanguage?: string;
  mediaRetentionDays?: number;
  cprDailyLimit?: number;
  cprWeeklyLimit?: number;
  aiSummaryEnabled?: boolean;
  settings?: Record<string, unknown> | null;
}

export interface UpdateOrganizationParams {
  name?: string;
  timezone?: string;
  defaultLocale?: string;
  status?: string;
  recordingPolicy?: string;
  transcriptionPolicy?: string;
  recordingPurpose?: string | null;
  announcementLanguage?: string;
  mediaRetentionDays?: number;
  cprDailyLimit?: number;
  cprWeeklyLimit?: number;
  aiSummaryEnabled?: boolean;
  settings?: Record<string, unknown> | null;
}

export interface OrganizationRepository {
  save(params: CreateOrganizationParams): Promise<OrganizationProps>;
  update(id: string, params: UpdateOrganizationParams): Promise<OrganizationProps>;
  findById(id: string): Promise<OrganizationProps | null>;
  findBySlug(slug: string): Promise<OrganizationProps | null>;
  findAll(): Promise<OrganizationProps[]>;
}
