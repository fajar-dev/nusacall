export interface DomainEventRecord {
  id: string;
  organizationId: string | null;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  publishedAt: Date | null;
  createdAt: Date;
}

export interface DomainEventRepositoryPort {
  save(event: Partial<DomainEventRecord>): Promise<{ id: string }>;
  fetchPending(limit: number): Promise<DomainEventRecord[]>;
  markPublished(ids: string[]): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}
