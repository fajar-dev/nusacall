import { describe, it, expect } from 'vitest';
import { AuditLogService } from '../src/modules/identity/application/AuditLogService';
import type { AuditLogRepository, AuditLogData, CreateAuditLogParams } from '../src/modules/identity/domain/ports/AuditLogRepository';

class InMemoryAuditLogRepository implements AuditLogRepository {
  private logs: AuditLogData[] = [];

  async save(params: CreateAuditLogParams): Promise<AuditLogData> {
    const record: AuditLogData = {
      id: params.id ?? 'audit_1',
      organizationId: params.organizationId ?? null,
      userId: params.userId ?? null,
      action: params.action,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      details: params.details ?? null,
      createdAt: new Date(),
    };
    this.logs.push(record);
    return record;
  }

  async findByOrganizationId(organizationId: string): Promise<AuditLogData[]> {
    return this.logs.filter((l) => l.organizationId === organizationId);
  }
}

describe('E1-T7: Audit Log Service', () => {
  it('should save audit log record successfully', async () => {
    const repo = new InMemoryAuditLogRepository();
    const service = new AuditLogService(repo);

    const result = await service.log({
      organizationId: 'org_1',
      userId: 'usr_1',
      action: 'auth.login',
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(result.id).toBeDefined();
    expect(result.action).toBe('auth.login');
    expect(result.organizationId).toBe('org_1');
  });

  it('CRITICAL Rule N11: should automatically redact sensitive fields in details', async () => {
    const repo = new InMemoryAuditLogRepository();
    const service = new AuditLogService(repo);

    const result = await service.log({
      organizationId: 'org_1',
      userId: 'usr_1',
      action: 'user.update',
      details: {
        username: 'fajar',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        sdp: 'v=0\r\no=- 12345 2 IN IP4...',
        nested: {
          secret: 'MySecretKey',
          normal: 'VisibleValue',
        },
      },
    });

    expect(result.details?.username).toBe('fajar');
    expect(result.details?.password).toBe('[REDACTED]');
    expect(result.details?.token).toBe('[REDACTED]');
    expect(result.details?.sdp).toBe('[REDACTED]');

    const nested = result.details?.nested as Record<string, unknown>;
    expect(nested.secret).toBe('[REDACTED]');
    expect(nested.normal).toBe('VisibleValue');
  });

  it('should find logs filtered by organizationId', async () => {
    const repo = new InMemoryAuditLogRepository();
    const service = new AuditLogService(repo);

    await service.log({ organizationId: 'org_1', action: 'action.1' });
    await service.log({ organizationId: 'org_2', action: 'action.2' });

    const org1Logs = await repo.findByOrganizationId('org_1');
    expect(org1Logs).toHaveLength(1);
    expect(org1Logs[0]?.action).toBe('action.1');
  });
});
