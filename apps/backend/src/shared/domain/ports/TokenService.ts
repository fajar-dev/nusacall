export interface AccessTokenPayload {
  sub: string;
  orgId: string | null;
  role: string;
}

export interface TokenService {
  signAccessToken(payload: AccessTokenPayload, expiresInSeconds?: number): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  hashRefreshToken(rawToken: string): string;
  generateRawToken(): string;
}
