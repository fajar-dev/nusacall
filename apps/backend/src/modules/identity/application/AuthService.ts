import type { Clock } from '../../../shared/utils/Clock';
import type { PasswordHasher } from '../../../shared/domain/ports/PasswordHasher';
import type { TokenService } from '../../../shared/domain/ports/TokenService';
import type { AuthUserRepository } from '../domain/ports/AuthUserRepository';
import type { RefreshTokenRepository } from '../domain/ports/RefreshTokenRepository';
import { UnauthenticatedError } from '../../../shared/errors/AppError';

export interface LoginInput {
  email: string;
  password: string;
  userAgent?: string;
  ip?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    organizationId: string | null;
    email: string;
    fullName: string;
    role: string;
  };
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(
    private readonly userRepo: AuthUserRepository,
    private readonly tokenRepo: RefreshTokenRepository,
    private readonly clock: Clock,
    private readonly hasher: PasswordHasher,
    private readonly tokenService: TokenService
  ) {}

  public async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(input.email);

    if (!user) {
      throw new UnauthenticatedError('INVALID_CREDENTIALS', 'Email atau password salah');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthenticatedError('USER_INACTIVE', 'Akun pengguna tidak aktif');
    }

    const isValidPassword = await this.hasher.verify(user.toProps().passwordHash, input.password);
    if (!isValidPassword) {
      await this.userRepo.incrementFailedLogin(user.id);
      throw new UnauthenticatedError('INVALID_CREDENTIALS', 'Email atau password salah');
    }

    const now = this.clock.now();
    await this.userRepo.updateLastLogin(user.id, now);

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      orgId: user.organizationId,
      role: user.role,
    });

    const rawRefreshToken = this.tokenService.generateRawToken();
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const familyId = `fam_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 hari

    await this.tokenRepo.save({
      id: `rt_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`,
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
      revokedAt: null,
      replacedBy: null,
      userAgent: input.userAgent || null,
      ip: input.ip || null,
    });

    const props = user.toProps();
    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        fullName: props.fullName,
        role: user.role,
      },
    };
  }

  public async refresh(rawRefreshToken: string, userAgent?: string, ip?: string): Promise<RefreshResult> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const token = await this.tokenRepo.findByHash(tokenHash);

    if (!token) {
      throw new UnauthenticatedError('INVALID_REFRESH_TOKEN', 'Token refresh tidak ditemukan');
    }

    const now = this.clock.now();

    // TOKEN REUSE DETECTION: jika token sudah di-revoke sebelumnya
    if (token.revokedAt !== null) {
      // Revoke SELURUH family
      await this.tokenRepo.revokeFamily(token.familyId, now);
      throw new UnauthenticatedError('TOKEN_REUSE_DETECTED', 'Sesi Anda telah dicabut karena indikasi penyalahgunaan token');
    }

    if (token.expiresAt < now) {
      throw new UnauthenticatedError('REFRESH_TOKEN_EXPIRED', 'Token refresh telah kadaluarsa');
    }

    const user = await this.userRepo.findById(token.userId);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthenticatedError('USER_INACTIVE', 'Pengguna tidak aktif');
    }

    // Rotasi refresh token: matikan token lama
    const newRawRefreshToken = this.tokenService.generateRawToken();
    const newTokenHash = this.tokenService.hashRefreshToken(newRawRefreshToken);

    token.revokedAt = now;
    token.replacedBy = newTokenHash;
    await this.tokenRepo.save(token);

    // Buat token baru di family yang sama
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await this.tokenRepo.save({
      id: `rt_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`,
      userId: user.id,
      tokenHash: newTokenHash,
      familyId: token.familyId,
      expiresAt,
      revokedAt: null,
      replacedBy: null,
      userAgent: userAgent || null,
      ip: ip || null,
    });

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      orgId: user.organizationId,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  public async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const token = await this.tokenRepo.findByHash(tokenHash);

    if (token && token.revokedAt === null) {
      token.revokedAt = this.clock.now();
      await this.tokenRepo.save(token);
    }
  }

  public async logoutAll(userId: string): Promise<void> {
    await this.tokenRepo.revokeAllForUser(userId, this.clock.now());
  }
}
