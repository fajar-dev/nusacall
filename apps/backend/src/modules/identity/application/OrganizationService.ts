import type {
  OrganizationRepository,
  CreateOrganizationParams,
  UpdateOrganizationParams,
} from '../domain/ports/OrganizationRepository';
import type { OrganizationProps } from '../domain/Organization';
import { ConflictError, NotFoundError } from '../../../shared/errors/AppError';

export class OrganizationService {
  constructor(private readonly repo: OrganizationRepository) {}

  async createOrganization(params: CreateOrganizationParams): Promise<OrganizationProps> {
    const existing = await this.repo.findBySlug(params.slug);
    if (existing) {
      throw new ConflictError('SLUG_ALREADY_EXISTS', `Organisasi dengan slug ${params.slug} sudah ada`);
    }
    return this.repo.save(params);
  }

  async getOrganizationById(id: string): Promise<OrganizationProps> {
    const org = await this.repo.findById(id);
    if (!org) {
      throw new NotFoundError('ORGANIZATION_NOT_FOUND', `Organisasi ${id} tidak ditemukan`);
    }
    return org;
  }

  async updateOrganization(id: string, params: UpdateOrganizationParams): Promise<OrganizationProps> {
    await this.getOrganizationById(id);
    return this.repo.update(id, params);
  }

  async listOrganizations(): Promise<OrganizationProps[]> {
    return this.repo.findAll();
  }
}
