import type { Repository } from 'typeorm';
import crypto from 'node:crypto';
import { UserEntity } from '../entities/UserEntity';
import { User } from '../../domain/User';
import type { UserRepository, CreateUserData, UpdateUserData } from '../../domain/ports/UserRepository';
import { NotFoundError } from '../../../../shared/errors/AppError';

export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly repo: Repository<UserEntity>) {}

  private mapToDomain(entity: UserEntity): User {
    return new User({
      id: entity.id,
      organizationId: entity.organizationId,
      email: entity.email,
      passwordHash: entity.passwordHash,
      fullName: entity.fullName,
      role: entity.role,
      status: entity.status,
      totpSecretEnc: entity.totpSecretEnc,
      totpEnabled: Boolean(entity.totpEnabled),
      lastLoginAt: entity.lastLoginAt,
      failedLoginCount: entity.failedLoginCount,
      lockedUntil: entity.lockedUntil,
      locale: entity.locale,
      avatarUrl: entity.avatarUrl,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  async save(data: CreateUserData): Promise<User> {
    const entity = this.repo.create({
      id: crypto.randomUUID().replace(/-/g, '').substring(0, 26),
      organizationId: data.organizationId,
      email: data.email,
      fullName: data.fullName,
      passwordHash: data.passwordHash,
      role: data.role,
      status: data.status ?? 'ACTIVE',
      totpEnabled: 0,
      failedLoginCount: 0,
      locale: 'id',
    });

    const saved = await this.repo.save(entity);
    return this.mapToDomain(saved);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) {
      throw new NotFoundError('USER_NOT_FOUND', `User ${id} tidak ditemukan`);
    }

    if (data.fullName !== undefined) entity.fullName = data.fullName;
    if (data.role !== undefined) entity.role = data.role;
    if (data.status !== undefined) entity.status = data.status;
    if (data.passwordHash !== undefined) entity.passwordHash = data.passwordHash;

    const saved = await this.repo.save(entity);
    return this.mapToDomain(saved);
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findByEmail(organizationId: string, email: string): Promise<User | null> {
    const entity = await this.repo.findOneBy({ organizationId, email });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findByOrganizationId(organizationId: string): Promise<User[]> {
    const entities = await this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.mapToDomain(e));
  }
}
