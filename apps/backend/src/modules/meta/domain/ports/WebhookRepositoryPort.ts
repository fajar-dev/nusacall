export interface WebhookEventRecord {
  id: string;
  metaAppId: string;
  organizationId: string | null;
  dedupeKey: string;
  field: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  payload: Record<string, unknown>;
  signatureValid: boolean;
  receivedAt: Date;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'SKIPPED';
  attempts: number;
  lastError: string | null;
}

export interface WebhookRepositoryPort {
  save(event: Partial<WebhookEventRecord>): Promise<{ inserted: boolean; id: string }>;
  findById(id: string): Promise<WebhookEventRecord | null>;
  update(id: string, patch: Partial<WebhookEventRecord>): Promise<void>;
  deleteOlderThan(cutoffDate: Date): Promise<number>;
}
