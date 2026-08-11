import { describe, it, expect, vi } from 'vitest';
import { S3StorageAdapter } from '../src/infrastructure/storage/S3StorageAdapter';
import type { S3Client } from '@aws-sdk/client-s3';

describe('E0-T9: S3StorageAdapter (StoragePort implementation)', () => {
  it('should send PutObjectCommand on putObject', async () => {
    const mockSend = vi.fn().mockResolvedValue({});
    const mockS3Client = { send: mockSend } as unknown as S3Client;

    const adapter = new S3StorageAdapter({}, mockS3Client);
    await adapter.putObject({
      bucket: 'recordings',
      key: 'rec_123.mp3',
      body: 'audio-data',
      contentType: 'audio/mp3',
    });

    expect(mockSend).toHaveBeenCalledOnce();
  });

  it('should send GetObjectCommand and return Buffer on getObject', async () => {
    const fakeData = new Uint8Array([1, 2, 3, 4]);
    const mockSend = vi.fn().mockResolvedValue({
      Body: {
        transformToByteArray: async () => fakeData,
      },
    });
    const mockS3Client = { send: mockSend } as unknown as S3Client;

    const adapter = new S3StorageAdapter({}, mockS3Client);
    const result = await adapter.getObject('recordings', 'rec_123.mp3');

    expect(mockSend).toHaveBeenCalledOnce();
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from(fakeData));
  });

  it('should send DeleteObjectCommand on deleteObject', async () => {
    const mockSend = vi.fn().mockResolvedValue({});
    const mockS3Client = { send: mockSend } as unknown as S3Client;

    const adapter = new S3StorageAdapter({}, mockS3Client);
    await adapter.deleteObject('recordings', 'rec_123.mp3');

    expect(mockSend).toHaveBeenCalledOnce();
  });
});
