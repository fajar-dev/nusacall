export interface EncryptionServicePort {
  encrypt(plain: string): Buffer;
  decrypt(blob: Buffer): string;
  reencrypt?(blob: Buffer): Buffer;
}
