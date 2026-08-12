import type { DomainEventRecord } from './DomainEventRepositoryPort';

export interface EventPublisherPort {
  publish(event: DomainEventRecord): Promise<void>;
}
