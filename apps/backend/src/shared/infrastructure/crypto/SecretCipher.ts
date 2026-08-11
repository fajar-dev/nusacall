import crypto from 'node:crypto';
import type { EncryptionServicePort } from '../../domain/ports/EncryptionServicePort';

export interface SecretCipherConfig {
  activeKeyId: string;
  keys: Map<string, Buffer>;
}

export class SecretCipher implements EncryptionServicePort {
  private activeKeyId: string;
  private keys: Map<string, Buffer>;

  constructor(config: SecretCipherConfig) {
    this.activeKeyId = config.activeKeyId;
    this.keys = config.keys;

    if (!this.keys.has(this.activeKeyId)) {
      throw new Error(`Kunci aktif ${this.activeKeyId} tidak ditemukan dalam daftar kunci enkripsi`);
    }
  }

  public static fromEnv(
    keysString = process.env.SECRET_ENCRYPTION_KEYS || 'k1:dGVzdGtleTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNA==',
    activeKeyId = process.env.SECRET_ENCRYPTION_ACTIVE_KEY_ID || 'k1'
  ): SecretCipher {
    const keysMap = new Map<string, Buffer>();
    const pairs = keysString.split(',');
    for (const pair of pairs) {
      const [id, base64Key] = pair.split(':');
      if (id && base64Key) {
        const keyBuffer = Buffer.from(base64Key, 'base64');
        if (keyBuffer.length !== 32) {
          throw new Error(`Kunci enkripsi ${id} harus berukuran 32 byte (256 bit)`);
        }
        keysMap.set(id, keyBuffer);
      }
    }
    return new SecretCipher({ activeKeyId, keys: keysMap });
  }

  encrypt(plain: string): Buffer {
    const key = this.keys.get(this.activeKeyId);
    if (!key) {
      throw new Error(`Kunci aktif ${this.activeKeyId} tidak valid`);
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const ivB64 = iv.toString('base64url');
    const tagB64 = tag.toString('base64url');
    const ciphertextB64 = encrypted.toString('base64url');

    const formatted = `v1:${this.activeKeyId}:${ivB64}:${tagB64}:${ciphertextB64}`;
    return Buffer.from(formatted, 'utf8');
  }

  decrypt(blob: Buffer): string {
    const formatted = blob.toString('utf8');
    const parts = formatted.split(':');
    if (parts.length !== 5 || parts[0] !== 'v1') {
      throw new Error('Format ciphertext rahasia tidak valid atau versi tidak didukung');
    }

    const [, keyId, ivB64, tagB64, ciphertextB64] = parts;
    if (!keyId || !ivB64 || !tagB64 || !ciphertextB64) {
      throw new Error('Format ciphertext rahasia tidak lengkap');
    }

    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Kunci enkripsi dengan ID ${keyId} tidak ditemukan`);
    }

    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const ciphertext = Buffer.from(ciphertextB64, 'base64url');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  reencrypt(blob: Buffer): Buffer {
    const plaintext = this.decrypt(blob);
    return this.encrypt(plaintext);
  }
}
