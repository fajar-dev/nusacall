import type { TenantContext } from '../../../shared/domain/TenantContext';
import type { User } from '../domain/User';
import type { UserRepository, CreateUserData, UpdateUserData } from '../domain/ports/UserRepository';
import type { RefreshTokenRepository } from '../domain/ports/RefreshTokenRepository';
import type { PasswordHasher } from '../../../shared/domain/ports/PasswordHasher';
import { ConflictError, NotFoundError, ForbiddenError } from '../../../shared/errors/AppError';

export interface CreateUserParams {
  email: string;
  fullName: string;
  password: string;
  role: string;
}

export interface UpdateUserParams {
  fullName?: string;
  role?: string;
  status?: string;
}

export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenRepo: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async createUser(tenant: TenantContext, params: CreateUserParams): Promise<User> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan untuk membuat user');
    }

    const existing = await this.userRepo.findByEmail(tenant.organizationId, params.email);
    if (existing) {
      throw new ConflictError('EMAIL_ALREADY_EXISTS', `User dengan email ${params.email} sudah terdaftar`);
    }

    const passwordHash = await this.passwordHasher.hash(params.password);
    const userData: CreateUserData = {
      organizationId: tenant.organizationId,
      email: params.email,
      fullName: params.fullName,
      passwordHash,
      role: params.role,
      status: 'ACTIVE',
    };

    return this.userRepo.save(userData);
  }

  async listUsers(tenant: TenantContext): Promise<User[]> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan');
    }
    return this.userRepo.findByOrganizationId(tenant.organizationId);
  }

  async getUserById(tenant: TenantContext, id: string): Promise<User> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan');
    }

    const user = await this.userRepo.findById(id);
    if (!user || user.organizationId !== tenant.organizationId) {
      throw new NotFoundError('USER_NOT_FOUND', `User ${id} tidak ditemukan`);
    }

    return user;
  }

  async updateUser(tenant: TenantContext, id: string, params: UpdateUserParams): Promise<User> {
    await this.getUserById(tenant, id);

    const updateData: UpdateUserData = {};
    if (params.fullName !== undefined) updateData.fullName = params.fullName;
    if (params.role !== undefined) updateData.role = params.role;
    if (params.status !== undefined) updateData.status = params.status;

    return this.userRepo.update(id, updateData);
  }

  async resetPassword(tenant: TenantContext, id: string, newPassword: string): Promise<void> {
    await this.getUserById(tenant, id);
    const passwordHash = await this.passwordHasher.hash(newPassword);

    await this.userRepo.update(id, { passwordHash });
    await this.tokenRepo.revokeAllForUser(id, new Date());
  }
}
