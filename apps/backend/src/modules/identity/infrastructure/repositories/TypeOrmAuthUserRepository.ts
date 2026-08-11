import type { DataSource } from 'typeorm';
import type { AuthUserRepository } from '../../domain/ports/AuthUserRepository';
import { User } from '../../domain/User';
import type { UserProps } from '../../domain/User';
import { UserEntity } from '../entities/UserEntity';

export class TypeOrmAuthUserRepository implements AuthUserRepository {
  constructor(private readonly ds: DataSource) {}

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.ds
      .getRepository(UserEntity)
      .findOne({ where: { email: email.toLowerCase() } });

    if (!entity) return null;
    return this.toDomain(entity);
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.ds.getRepository(UserEntity).findOne({ where: { id } });
    if (!entity) return null;
    return this.toDomain(entity);
  }

  async updateLastLogin(userId: string, at: Date): Promise<void> {
    await this.ds
      .getRepository(UserEntity)
      .update({ id: userId }, { lastLoginAt: at, failedLoginCount: 0 });
  }

  async incrementFailedLogin(userId: string): Promise<void> {
    await this.ds
      .getRepository(UserEntity)
      .createQueryBuilder()
      .update(UserEntity)
      .set({ failedLoginCount: () => 'failed_login_count + 1' })
      .where('id = :id', { id: userId })
      .execute();
  }

  private toDomain(entity: UserEntity): User {
    const props: UserProps = {
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
    };
    return new User(props);
  }
}
