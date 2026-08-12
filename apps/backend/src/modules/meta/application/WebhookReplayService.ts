import type { WebhookRepositoryPort } from '../domain/ports/WebhookRepositoryPort';
import type { QueuePort } from '../domain/ports/QueuePort';
import { NotFoundError, ConflictError } from '../../../shared/errors/AppError';

export class WebhookReplayService {
  constructor(
    private readonly webhookRepository: WebhookRepositoryPort,
    private readonly queue: QueuePort
  ) {}

  async replayEvent(webhookEventId: string, scopedOrganizationId: string | null): Promise<void> {
    const event = await this.webhookRepository.findById(webhookEventId);

    if (!event) {
      throw new NotFoundError('WEBHOOK_EVENT_NOT_FOUND', `Webhook event ${webhookEventId} not found`);
    }

    if (scopedOrganizationId && event.organizationId && event.organizationId !== scopedOrganizationId) {
      throw new NotFoundError('WEBHOOK_EVENT_NOT_FOUND', `Webhook event ${webhookEventId} not found`);
    }

    if (event.status === 'PROCESSED') {
      throw new ConflictError('WEBHOOK_ALREADY_PROCESSED', `Webhook event ${webhookEventId} is already PROCESSED`);
    }

    await this.webhookRepository.update(event.id, {
      status: 'PENDING',
      attempts: 0,
      lastError: null,
    });

    await this.queue.enqueue('webhook-process', 'webhook.process', {
      webhookEventId: event.id,
    });
  }
}
