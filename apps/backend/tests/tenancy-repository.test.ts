import { describe, it, expect, vi } from 'vitest';
import { UserRepository } from '../src/modules/identity/infrastructure/repositories/UserRepository';
import { User } from '../src/modules/identity/domain/User';
import { Organization } from '../src/modules/identity/domain/Organization';
import { ForbiddenError } from '../src/shared/errors/AppError';

describe('E1-T2: TenantScopedRepository & Tenant Isolation', () => {
  it('should allow access when organizationId matches context', () => {
    const repo = new UserRepository({} as any, { organizationId: 'org_123' });
    expect(() => repo.assertOwnership({ organizationId: 'org_123' })).not.toThrow();
  });

  it('should throw ForbiddenError when entity belongs to a different tenant (negative test)', () => {
    const repo = new UserRepository({} as any, { organizationId: 'org_123' });
    expect(() => repo.assertOwnership({ organizationId: 'org_other' })).toThrow(ForbiddenError);
  });

  it('should construct query builder with organization_id filter', () => {
    const queryBuilder = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(null),
    };
    const mockDs = {
      getRepository: vi.fn().mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      }),
    };

    const repo = new UserRepository(mockDs as any, { organizationId: 'org_abc' });
    repo.findByEmail('test@example.com');

    expect(queryBuilder.where).toHaveBeenCalledWith('u.organization_id = :orgId', { orgId: 'org_abc' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('u.email = :email', { email: 'test@example.com' });
  });

  it('should create Organization and User domain entities', () => {
    const org = new Organization({
      id: '01H1234567890ABCDEFGHIJKLM',
      name: 'NusaCall Demo',
      slug: 'nusacall-demo',
      timezone: 'Asia/Jakarta',
      defaultLocale: 'id',
      status: 'ACTIVE',
      recordingPolicy: 'ALWAYS',
      transcriptionPolicy: 'ALWAYS',
      recordingPurpose: null,
      announcementLanguage: 'id',
      mediaRetentionDays: 365,
      cprDailyLimit: 1,
      cprWeeklyLimit: 2,
      aiSummaryEnabled: false,
      settings: null,
    });
    expect(org.id).toBe('01H1234567890ABCDEFGHIJKLM');
    expect(org.slug).toBe('nusacall-demo');

    const user = new User({
      id: '01H9876543210ZYXWVUTSRQPON',
      organizationId: '01H1234567890ABCDEFGHIJKLM',
      email: 'admin@nusacall.com',
      passwordHash: '$argon2id$...',
      fullName: 'Admin NusaCall',
      role: 'ORG_ADMIN',
      status: 'ACTIVE',
    });
    expect(user.email).toBe('admin@nusacall.com');
    expect(user.organizationId).toBe('01H1234567890ABCDEFGHIJKLM');
  });
});
