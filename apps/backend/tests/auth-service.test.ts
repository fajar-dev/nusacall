import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../src/modules/identity/application/AuthService';
import { User } from '../src/modules/identity/domain/User';
import type { RefreshTokenData } from '../src/modules/identity/domain/RefreshTokenData';
import type { AuthUserRepository } from '../src/modules/identity/domain/ports/AuthUserRepository';
import type { RefreshTokenRepository } from '../src/modules/identity/domain/ports/RefreshTokenRepository';
import { Argon2PasswordHasher } from '../src/shared/infrastructure/Argon2PasswordHasher';
import { JwtTokenService } from '../src/shared/infrastructure/JwtTokenService';
import { SystemClock } from '../src/shared/utils/Clock';
import { UnauthenticatedError } from '../src/shared/errors/AppError';

class InMemoryAuthUserRepository implements AuthUserRepository {
  public users: User[] = [];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email.toLowerCase()) || null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) || null;
  }

  async updateLastLogin(_userId: string, _at: Date): Promise<void> {}

  async incrementFailedLogin(_userId: string): Promise<void> {}
}

class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  public tokens: RefreshTokenData[] = [];

  async findByHash(tokenHash: string): Promise<RefreshTokenData | null> {
    return this.tokens.find((t) => t.tokenHash === tokenHash) || null;
  }

  async save(token: RefreshTokenData): Promise<RefreshTokenData> {
    const idx = this.tokens.findIndex((t) => t.id === token.id);
    if (idx >= 0) this.tokens[idx] = token;
    else this.tokens.push(token);
    return token;
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    for (const t of this.tokens) {
      if (t.familyId === familyId && t.revokedAt === null) {
        t.revokedAt = at;
      }
    }
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    for (const t of this.tokens) {
      if (t.userId === userId && t.revokedAt === null) {
        t.revokedAt = at;
      }
    }
  }
}

describe('E1-T3: AuthService & Refresh Token Reuse Detection', () => {
  let userRepo: InMemoryAuthUserRepository;
  let tokenRepo: InMemoryRefreshTokenRepository;
  let authService: AuthService;
  let hasher: Argon2PasswordHasher;
  let tokenService: JwtTokenService;

  beforeEach(async () => {
    userRepo = new InMemoryAuthUserRepository();
    tokenRepo = new InMemoryRefreshTokenRepository();
    hasher = new Argon2PasswordHasher();
    tokenService = new JwtTokenService();

    authService = new AuthService(
      userRepo,
      tokenRepo,
      new SystemClock(),
      hasher,
      tokenService
    );

    const passwordHash = await hasher.hash('Secret123!');
    userRepo.users.push(
      new User({
        id: 'usr_1',
        organizationId: 'org_1',
        email: 'user@example.com',
        passwordHash,
        fullName: 'User Test',
        role: 'AGENT',
        status: 'ACTIVE',
      })
    );
  });

  it('should login successfully with valid credentials', async () => {
    const result = await authService.login({
      email: 'user@example.com',
      password: 'Secret123!',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe('user@example.com');
    expect(tokenRepo.tokens).toHaveLength(1);
  });

  it('should throw UnauthenticatedError on invalid password', async () => {
    await expect(
      authService.login({
        email: 'user@example.com',
        password: 'WrongPassword!',
      })
    ).rejects.toThrow(UnauthenticatedError);
  });

  it('should refresh token successfully and rotate refresh token', async () => {
    const loginResult = await authService.login({
      email: 'user@example.com',
      password: 'Secret123!',
    });

    const refreshResult = await authService.refresh(loginResult.refreshToken);

    expect(refreshResult.accessToken).toBeDefined();
    expect(refreshResult.refreshToken).toBeDefined();
    expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken);

    // Old token should be marked as revoked
    expect(tokenRepo.tokens[0]?.revokedAt).not.toBeNull();
    // New token created in same family
    expect(tokenRepo.tokens).toHaveLength(2);
    expect(tokenRepo.tokens[1]?.familyId).toBe(tokenRepo.tokens[0]?.familyId);
  });

  it('CRITICAL DoD: should detect token reuse and revoke entire family', async () => {
    const loginResult = await authService.login({
      email: 'user@example.com',
      password: 'Secret123!',
    });

    // First refresh: valid
    const refreshResult1 = await authService.refresh(loginResult.refreshToken);

    // Attacker tries to reuse the old/revoked refresh token!
    await expect(authService.refresh(loginResult.refreshToken)).rejects.toThrow('Sesi Anda telah dicabut');

    // ALL tokens in that family must be revoked!
    for (const token of tokenRepo.tokens) {
      expect(token.revokedAt).not.toBeNull();
    }

    // Subsequent attempt with the new token should also fail since family was wiped
    await expect(authService.refresh(refreshResult1.refreshToken)).rejects.toThrow();
  });

  it('should logout and revoke token', async () => {
    const loginResult = await authService.login({
      email: 'user@example.com',
      password: 'Secret123!',
    });

    await authService.logout(loginResult.refreshToken);
    expect(tokenRepo.tokens[0]?.revokedAt).not.toBeNull();
  });

  it('should logoutAll and revoke all active user tokens', async () => {
    await authService.login({ email: 'user@example.com', password: 'Secret123!' });
    await authService.login({ email: 'user@example.com', password: 'Secret123!' });

    expect(tokenRepo.tokens).toHaveLength(2);

    await authService.logoutAll('usr_1');

    expect(tokenRepo.tokens[0]?.revokedAt).not.toBeNull();
    expect(tokenRepo.tokens[1]?.revokedAt).not.toBeNull();
  });
});
