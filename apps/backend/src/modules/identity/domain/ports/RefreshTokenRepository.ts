import type { RefreshTokenData } from '../RefreshTokenData';

export interface RefreshTokenRepository {
  findByHash(tokenHash: string): Promise<RefreshTokenData | null>;
  save(token: RefreshTokenData): Promise<RefreshTokenData>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<void>;
}
