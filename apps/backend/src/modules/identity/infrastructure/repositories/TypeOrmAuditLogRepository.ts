import type { Repository } from 'typeorm';
import crypto from 'node:crypto';
import { AuditLogEntity } from '../entities/AuditLogEntity';
import type { AuditLogRepository, CreateAuditLogParams, AuditLogData } from '../../domain/ports/AuditLogRepository';

export class TypeOrmAuditLogRepository implements AuditLogRepository {
  constructor(private readonly repo: Repository<AuditLogEntity>) {}

  async save(params: CreateAuditLogParams): Promise<AuditLogData> {
    const entity = this.repo.create({
      id: params.id ?? crypto.randomUUID(),
      organizationId: params.organizationId ?? null,
      userId: params.userId ?? null,
      action: params.action,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      details: params.details ?? null,
    });

    const saved = await this.repo.save(entity);
    return {
      id: saved.id,
      organizationId: saved.organizationId,
      userId: saved.userId,
      action: saved.action,
      ipAddress: saved.ipAddress,
      userAgent: saved.userAgent,
      details: saved.details,
      createdAt: saved.createdAt,
    };
  }

  async findByOrganizationId(organizationId: string, limit = 50): Promise<AuditLogData[]> {
    const records = await this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      userId: r.userId,
      action: r.action,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      details: r.details,
      createdAt: r.createdAt,
    }));
  }
}
