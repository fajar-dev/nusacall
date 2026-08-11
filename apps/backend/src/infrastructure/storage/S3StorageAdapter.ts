import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StoragePort, PutObjectOptions } from '../../shared/storage/StoragePort';

export interface S3Config {
  endpoint?: string;
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  forcePathStyle?: boolean;
}

export class S3StorageAdapter implements StoragePort {
  private readonly client: S3Client;

  constructor(config: S3Config, client?: S3Client) {
    if (client) {
      this.client = client;
    } else {
      const s3ClientConfig: S3ClientConfig = {
        region: config.region || 'us-east-1',
        forcePathStyle: config.forcePathStyle ?? true,
      };
      if (config.endpoint) {
        s3ClientConfig.endpoint = config.endpoint;
      }
      if (config.credentials) {
        s3ClientConfig.credentials = config.credentials;
      }
      this.client = new S3Client(s3ClientConfig);
    }
  }

  async putObject(options: PutObjectOptions): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: options.bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType,
      }),
    );
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Object ${key} in bucket ${bucket} returned empty body`);
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async getPresignedUrl(bucket: string, key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }
}
