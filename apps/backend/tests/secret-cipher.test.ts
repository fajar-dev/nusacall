import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { SecretCipher } from '../src/shared/infrastructure/crypto/SecretCipher';
import { TokenResolver, type WaPhoneNumberRepositoryPort } from '../src/modules/meta/application/TokenResolver';
import { NotFoundError } from '../src/shared/errors/AppError';

describe('E2-T2: SecretCipher & TokenResolver (AES-256-GCM, Multi-Key & Rotation)', () => {
  const key1 = crypto.randomBytes(32);
  const key2 = crypto.randomBytes(32);

  const keysMap = new Map<string, Buffer>([
    ['k1', key1],
    ['k2', key2],
  ]);

  it('should encrypt and decrypt plaintext accurately using AES-256-GCM', () => {
    const cipher = new SecretCipher({ activeKeyId: 'k1', keys: keysMap });
    const secret = 'EAAG1234567890SecretMetaAccessToken';

    const encrypted = cipher.encrypt(secret);
    expect(encrypted).toBeInstanceOf(Buffer);
    expect(encrypted.toString('utf8')).toContain('v1:k1:');

    const decrypted = cipher.decrypt(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('should support multi-key decryption and re-encryption to active key (rotation)', () => {
    const cipherV1 = new SecretCipher({ activeKeyId: 'k1', keys: keysMap });
    const cipherV2 = new SecretCipher({ activeKeyId: 'k2', keys: keysMap });

    const originalSecret = 'MetaAppSecretString999!';
    const encryptedV1 = cipherV1.encrypt(originalSecret);
    expect(encryptedV1.toString('utf8')).toContain('v1:k1:');

    // cipherV2 with activeKeyId 'k2' can decrypt old key 'k1' ciphertext
    const decryptedByV2 = cipherV2.decrypt(encryptedV1);
    expect(decryptedByV2).toBe(originalSecret);

    // re-encrypt rotates ciphertext to active key 'k2'
    const rotatedEncrypted = cipherV2.reencrypt(encryptedV1);
    expect(rotatedEncrypted.toString('utf8')).toContain('v1:k2:');
    expect(cipherV2.decrypt(rotatedEncrypted)).toBe(originalSecret);
  });

  it('should throw Error when attempting to decrypt with unknown keyId', () => {
    const cipher = new SecretCipher({ activeKeyId: 'k1', keys: keysMap });
    const fakeBlob = Buffer.from('v1:unknown_key:iv:tag:ciphertext', 'utf8');

    expect(() => cipher.decrypt(fakeBlob)).toThrow('Kunci enkripsi dengan ID unknown_key tidak ditemukan');
  });

  it('TokenResolver should resolve decrypted token and use 5-minute memory TTL cache', async () => {
    const cipher = new SecretCipher({ activeKeyId: 'k1', keys: keysMap });
    const rawToken = 'EAAG_LIVE_META_TOKEN_XYZ';
    const encryptedToken = cipher.encrypt(rawToken);

    const mockRepo: WaPhoneNumberRepositoryPort = {
      findByPhoneNumberId: vi.fn().mockResolvedValue({
        phoneNumberId: 'pn_123',
        accessTokenEnc: encryptedToken,
      }),
    };

    const resolver = new TokenResolver(mockRepo, cipher);

    // Call 1: Cache miss, repo called once
    const token1 = await resolver.getAccessToken('pn_123');
    expect(token1).toBe(rawToken);
    expect(mockRepo.findByPhoneNumberId).toHaveBeenCalledTimes(1);

    // Call 2: Cache hit, repo NOT called again
    const token2 = await resolver.getAccessToken('pn_123');
    expect(token2).toBe(rawToken);
    expect(mockRepo.findByPhoneNumberId).toHaveBeenCalledTimes(1);
  });

  it('TokenResolver should throw NotFoundError for invalid phoneNumberId', async () => {
    const cipher = new SecretCipher({ activeKeyId: 'k1', keys: keysMap });
    const mockRepo: WaPhoneNumberRepositoryPort = {
      findByPhoneNumberId: vi.fn().mockResolvedValue(null),
    };

    const resolver = new TokenResolver(mockRepo, cipher);
    await expect(resolver.getAccessToken('invalid_pn')).rejects.toThrow(NotFoundError);
  });
});
