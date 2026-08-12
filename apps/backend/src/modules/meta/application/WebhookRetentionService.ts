import type { WebhookRepositoryPort } from '../domain/ports/WebhookRepositoryPort';

export interface ClockPort {
  now(): Date;
}

export class WebhookRetentionService {
  constructor(
    private readonly webhookRepository: WebhookRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  async cleanupOldEvents(retentionDays = 30): Promise<number> {
    const nowMs = this.clock.now().getTime();
    const cutoffDate = new Date(nowMs - retentionDays * 24 * 60 * 60 * 1000);
    return await this.webhookRepository.deleteOlderThan(cutoffDate);
  }
}
