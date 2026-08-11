import type { DataSource } from 'typeorm';
import { TenantScopedRepository } from '../../../../shared/infrastructure/TenantScopedRepository';
import type { TenantContext } from '../../../../shared/domain/TenantContext';
import { UserEntity } from '../entities/UserEntity';

export class UserRepository extends TenantScopedRepository<UserEntity> {
  constructor(ds: DataSource, ctx: TenantContext) {
    super(ds, UserEntity, ctx);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.scoped('u')
      .andWhere('u.email = :email', { email })
      .getOne();
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.scoped('u')
      .andWhere('u.id = :id', { id })
      .getOne();

    if (user) {
      this.assertOwnership(user);
    }
    return user;
  }
}
