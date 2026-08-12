import type { DomainEventRepositoryPort } from '../domain/ports/DomainEventRepositoryPort';
import type { EventPublisherPort } from '../domain/ports/EventPublisherPort';

export class OutboxPollerService {
  constructor(
    private readonly domainEventRepository: DomainEventRepositoryPort,
    private readonly eventPublisher: EventPublisherPort
  ) {}

  async pollAndPublish(batchSize = 50): Promise<number> {
    const pendingEvents = await this.domainEventRepository.fetchPending(batchSize);
    if (pendingEvents.length === 0) {
      return 0;
    }

    const publishedIds: string[] = [];

    for (const event of pendingEvents) {
      try {
        await this.eventPublisher.publish(event);
        publishedIds.push(event.id);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await this.domainEventRepository.markFailed(event.id, errorMessage);
      }
    }

    if (publishedIds.length > 0) {
      await this.domainEventRepository.markPublished(publishedIds);
    }

    return publishedIds.length;
  }
}
