export interface PutObjectOptions {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
}

export interface StoragePort {
  putObject(options: PutObjectOptions): Promise<void>;
  getObject(bucket: string, key: string): Promise<Buffer>;
  getPresignedUrl(bucket: string, key: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(bucket: string, key: string): Promise<void>;
}
