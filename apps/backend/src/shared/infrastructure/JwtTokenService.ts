import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';
import type { TokenService, AccessTokenPayload } from '../domain/ports/TokenService';

export class JwtTokenService implements TokenService {
  private secretKey: Uint8Array;

  constructor(secret: string = process.env['JWT_SECRET'] || 'default_jwt_secret_must_be_32_bytes_long_min!') {
    this.secretKey = new TextEncoder().encode(secret);
  }

  async signAccessToken(payload: AccessTokenPayload, expiresInSeconds: number = 900): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
      .sign(this.secretKey);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.secretKey);
    return {
      sub: payload.sub as string,
      orgId: (payload['orgId'] as string) || null,
      role: payload['role'] as string,
    };
  }

  hashRefreshToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
