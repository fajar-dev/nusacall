import type { SdpCachePort } from '../domain/ports/SdpCachePort';
import { ValidationError } from '../../../shared/errors/AppError';

export interface RedisClientLike {
  set(key: string, value: string, optionMode?: string, optionValue?: number): Promise<string | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

export class RedisSdpCache implements SdpCachePort {
  private static readonly DEFAULT_TTL_SECONDS = 300;

  constructor(private readonly redis: RedisClientLike) {}

  private buildKey(wacid: string): string {
    return `sdp:answer:${wacid}`;
  }

  async saveAnswerSdp(wacid: string, sdp: string, ttlSeconds: number = RedisSdpCache.DEFAULT_TTL_SECONDS): Promise<void> {
    if (!wacid) throw new ValidationError('VALIDATION_ERROR', 'wacid wajib diisi');
    if (!sdp) throw new ValidationError('VALIDATION_ERROR', 'sdp wajib diisi');

    const key = this.buildKey(wacid);
    await this.redis.set(key, sdp, 'EX', ttlSeconds);
  }

  async getAnswerSdp(wacid: string): Promise<string | null> {
    if (!wacid) return null;
    const key = this.buildKey(wacid);
    return await this.redis.get(key);
  }

  async deleteAnswerSdp(wacid: string): Promise<void> {
    if (!wacid) return;
    const key = this.buildKey(wacid);
    await this.redis.del(key);
  }
}
