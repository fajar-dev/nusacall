import { ulid } from 'ulid';
import { UnauthenticatedError } from '../../../shared/errors/AppError';

export interface RedisTokenStorePort {
  set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number | unknown>;
}

export interface WsTokenPayload {
  userId: string;
  organizationId: string;
}

export class WsTokenService {
  constructor(private readonly redis: RedisTokenStorePort) {}

  async generateOneTimeToken(userId: string, organizationId: string): Promise<string> {
    const tokenId = ulid();
    const key = `ws:token:${tokenId}`;
    const payload: WsTokenPayload = { userId, organizationId };

    // TTL 60 detik
    await this.redis.set(key, JSON.stringify(payload), 'EX', 60);
    return tokenId;
  }

  async consumeToken(token: string): Promise<WsTokenPayload> {
    if (!token) throw new UnauthenticatedError('Token WS tidak valid');

    const key = `ws:token:${token}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new UnauthenticatedError('Token WS kadaluarsa atau sudah digunakan');
    }

    // Token sekali pakai: hapus langsung dari Redis
    await this.redis.del(key);

    return JSON.parse(raw) as WsTokenPayload;
  }
}
