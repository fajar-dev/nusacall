import type { EncryptionServicePort } from '../../../shared/domain/ports/EncryptionServicePort';
import { NotFoundError } from '../../../shared/errors/AppError';

export interface WaPhoneNumberRecord {
  phoneNumberId: string;
  accessTokenEnc: Buffer;
}

export interface WaPhoneNumberRepositoryPort {
  findByPhoneNumberId(phoneNumberId: string): Promise<WaPhoneNumberRecord | null>;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

export class TokenResolver {
  private cache = new Map<string, CachedToken>();
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes TTL

  constructor(
    private readonly repo: WaPhoneNumberRepositoryPort,
    private readonly cipher: EncryptionServicePort
  ) {}

  async getAccessToken(phoneNumberId: string): Promise<string> {
    const cached = this.cache.get(phoneNumberId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const record = await this.repo.findByPhoneNumberId(phoneNumberId);
    if (!record) {
      throw new NotFoundError('PHONE_NUMBER_NOT_FOUND', `Nomor telepon ${phoneNumberId} tidak ditemukan`);
    }

    const decrypted = this.cipher.decrypt(record.accessTokenEnc);
    this.cache.set(phoneNumberId, {
      token: decrypted,
      expiresAt: Date.now() + this.ttlMs,
    });

    return decrypted;
  }

  clearCache(phoneNumberId?: string): void {
    if (phoneNumberId) {
      this.cache.delete(phoneNumberId);
    } else {
      this.cache.clear();
    }
  }
}
