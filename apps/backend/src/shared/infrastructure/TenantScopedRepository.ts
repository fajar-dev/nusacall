import type { DataSource, SelectQueryBuilder, EntityTarget, ObjectLiteral } from 'typeorm';
import type { TenantContext } from '../domain/TenantContext';
import { ForbiddenError } from '../errors/AppError';

export abstract class TenantScopedRepository<T extends ObjectLiteral & { organizationId?: string | null }> {
  constructor(
    protected readonly ds: DataSource,
    protected readonly entityClass: EntityTarget<T>,
    protected readonly ctx: TenantContext
  ) {}

  protected scoped(alias: string): SelectQueryBuilder<T> {
    return this.ds
      .getRepository(this.entityClass)
      .createQueryBuilder(alias)
      .where(`${alias}.organization_id = :orgId`, { orgId: this.ctx.organizationId });
  }

  public assertOwnership(entity: { organizationId?: string | null }): void {
    if (entity.organizationId !== this.ctx.organizationId) {
      throw new ForbiddenError('CROSS_TENANT_ACCESS', 'Akses lintas organisasi dilarang');
    }
  }
}
