import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { UserService } from '../src/modules/identity/application/UserService';
import { User, type UserProps } from '../src/modules/identity/domain/User';
import type { UserRepository, CreateUserData, UpdateUserData } from '../src/modules/identity/domain/ports/UserRepository';
import type { RefreshTokenRepository } from '../src/modules/identity/domain/ports/RefreshTokenRepository';
import type { RefreshTokenData } from '../src/modules/identity/domain/RefreshTokenData';
import type { PasswordHasher } from '../src/shared/domain/ports/PasswordHasher';
import { ConflictError, NotFoundError, ForbiddenError } from '../src/shared/errors/AppError';
import type { TenantContext } from '../src/shared/domain/TenantContext';

class DummyPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed_${password}`;
  }
  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `hashed_${password}`;
  }
}

class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, UserProps>();

  async save(data: CreateUserData): Promise<User> {
    const id = `usr_${crypto.randomUUID()}`;
    const props: UserProps = {
      id,
      organizationId: data.organizationId,
      email: data.email,
      fullName: data.fullName,
      passwordHash: data.passwordHash,
      role: data.role,
      status: data.status ?? 'ACTIVE',
      totpEnabled: false,
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, props);
    return new User(props);
  }

  async findById(id: string): Promise<User | null> {
    const props = this.users.get(id);
    return props ? new User(props) : null;
  }

  async findByEmail(orgId: string, email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.organizationId === orgId && u.email === email) return new User(u);
    }
    return null;
  }

  async findByOrganizationId(orgId: string): Promise<User[]> {
    return Array.from(this.users.values())
      .filter((u) => u.organizationId === orgId)
      .map((props) => new User(props));
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new NotFoundError('USER_NOT_FOUND', `User ${id} tidak ditemukan`);
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    return new User(updated);
  }
}

class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private tokens = new Map<string, RefreshTokenData>();

  async findByHash(tokenHash: string): Promise<RefreshTokenData | null> {
    for (const t of this.tokens.values()) {
      if (t.tokenHash === tokenHash) return t;
    }
    return null;
  }

  async save(token: RefreshTokenData): Promise<RefreshTokenData> {
    this.tokens.set(token.id, token);
    return token;
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    for (const t of this.tokens.values()) {
      if (t.familyId === familyId) t.revokedAt = at;
    }
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    for (const t of this.tokens.values()) {
      if (t.userId === userId) t.revokedAt = at;
    }
  }
}

describe('E1-T9: UserService & Session Management', () => {
  const tenantOrg1: TenantContext = { organizationId: 'org_1' };
  const tenantOrg2: TenantContext = { organizationId: 'org_2' };

  it('should create user successfully in organization', async () => {
    const userRepo = new InMemoryUserRepository();
    const tokenRepo = new InMemoryRefreshTokenRepository();
    const service = new UserService(userRepo, tokenRepo, new DummyPasswordHasher());

    const user = await service.createUser(tenantOrg1, {
      email: 'agent1@org1.com',
      fullName: 'Agent 1',
      password: 'SecretPassword123!',
      role: 'AGENT',
    });

    expect(user.id).toBeDefined();
    expect(user.organizationId).toBe('org_1');
    expect(user.email).toBe('agent1@org1.com');
  });

  it('should throw ConflictError if email already exists in org', async () => {
    const userRepo = new InMemoryUserRepository();
    const tokenRepo = new InMemoryRefreshTokenRepository();
    const service = new UserService(userRepo, tokenRepo, new DummyPasswordHasher());

    await service.createUser(tenantOrg1, {
      email: 'dup@org1.com',
      fullName: 'User 1',
      password: 'Pass123!',
      role: 'AGENT',
    });

    await expect(
      service.createUser(tenantOrg1, {
        email: 'dup@org1.com',
        fullName: 'User 2',
        password: 'Pass123!',
        role: 'AGENT',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should enforce tenant isolation when fetching user', async () => {
    const userRepo = new InMemoryUserRepository();
    const tokenRepo = new InMemoryRefreshTokenRepository();
    const service = new UserService(userRepo, tokenRepo, new DummyPasswordHasher());

    const created = await service.createUser(tenantOrg1, {
      email: 'user@org1.com',
      fullName: 'Org 1 User',
      password: 'Pass123!',
      role: 'AGENT',
    });

    // Cross-tenant access from tenantOrg2 should fail with NotFoundError
    await expect(service.getUserById(tenantOrg2, created.id)).rejects.toThrow(NotFoundError);
  });

  it('should throw ForbiddenError if tenant organization context is missing', async () => {
    const userRepo = new InMemoryUserRepository();
    const tokenRepo = new InMemoryRefreshTokenRepository();
    const service = new UserService(userRepo, tokenRepo, new DummyPasswordHasher());

    await expect(
      service.createUser({ organizationId: '' }, {
        email: 'test@org.com',
        fullName: 'Test User',
        password: 'Pass123!',
        role: 'AGENT',
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('should reset password and revoke all active tokens for user', async () => {
    const userRepo = new InMemoryUserRepository();
    const tokenRepo = new InMemoryRefreshTokenRepository();
    const service = new UserService(userRepo, tokenRepo, new DummyPasswordHasher());

    const created = await service.createUser(tenantOrg1, {
      email: 'reset@org1.com',
      fullName: 'Reset User',
      password: 'OldPassword123!',
      role: 'AGENT',
    });

    await tokenRepo.save({
      id: 'token_1',
      userId: created.id,
      tokenHash: 'hash1',
      familyId: 'fam1',
      expiresAt: new Date(Date.now() + 10000),
      userAgent: 'Test',
      ip: '127.0.0.1',
      replacedBy: null,
      revokedAt: null,
    });

    await service.resetPassword(tenantOrg1, created.id, 'NewPassword123!');

    const token = await tokenRepo.findByHash('hash1');
    expect(token?.revokedAt).toBeDefined();
    expect(token?.revokedAt).not.toBeNull();
  });
});
