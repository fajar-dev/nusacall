import type { DataSource } from 'typeorm';
import type { RefreshTokenRepository } from '../../domain/ports/RefreshTokenRepository';
import type { RefreshTokenData } from '../../domain/RefreshTokenData';
import { RefreshTokenEntity } from '../entities/RefreshTokenEntity';

export class TypeOrmRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly ds: DataSource) {}

  async findByHash(tokenHash: string): Promise<RefreshTokenData | null> {
    const entity = await this.ds
      .getRepository(RefreshTokenEntity)
      .findOne({ where: { tokenHash } });

    if (!entity) return null;
    return this.toData(entity);
  }

  async save(token: RefreshTokenData): Promise<RefreshTokenData> {
    const repo = this.ds.getRepository(RefreshTokenEntity);
    const entity = repo.create({ ...token });
    const saved = await repo.save(entity);
    return this.toData(saved);
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.ds
      .getRepository(RefreshTokenEntity)
      .createQueryBuilder()
      .update(RefreshTokenEntity)
      .set({ revokedAt: at })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    await this.ds
      .getRepository(RefreshTokenEntity)
      .createQueryBuilder()
      .update(RefreshTokenEntity)
      .set({ revokedAt: at })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private toData(entity: RefreshTokenEntity): RefreshTokenData {
    return {
      id: entity.id,
      userId: entity.userId,
      tokenHash: entity.tokenHash,
      familyId: entity.familyId,
      expiresAt: entity.expiresAt,
      revokedAt: entity.revokedAt,
      replacedBy: entity.replacedBy,
      userAgent: entity.userAgent,
      ip: entity.ip,
    };
  }
}
