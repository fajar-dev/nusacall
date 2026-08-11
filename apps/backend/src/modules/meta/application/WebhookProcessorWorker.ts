import type { WebhookEventRecord, WebhookRepositoryPort } from '../domain/ports/WebhookRepositoryPort';
import type { TenantResolverPort } from '../domain/ports/TenantResolverPort';

export interface WebhookFieldHandlers {
  onCallsEvent?: (event: WebhookEventRecord) => Promise<void>;
  onMessagesEvent?: (event: WebhookEventRecord) => Promise<void>;
  onAccountUpdateEvent?: (event: WebhookEventRecord) => Promise<void>;
  onAccountSettingsUpdateEvent?: (event: WebhookEventRecord) => Promise<void>;
  onMessageTemplateStatusUpdateEvent?: (event: WebhookEventRecord) => Promise<void>;
}

export class WebhookProcessorWorker {
  constructor(
    private readonly webhookRepository: WebhookRepositoryPort,
    private readonly tenantResolver: TenantResolverPort,
    private readonly fieldHandlers: WebhookFieldHandlers = {}
  ) {}

  async processJob(jobData: { webhookEventId: string }): Promise<void> {
    const { webhookEventId } = jobData;
    const event = await this.webhookRepository.findById(webhookEventId);

    if (!event || event.status === 'PROCESSED') {
      return;
    }

    let orgId = event.organizationId;
    if (!orgId) {
      orgId = await this.tenantResolver.resolveOrganizationId(event.wabaId, event.phoneNumberId);
      if (orgId) {
        event.organizationId = orgId;
        await this.webhookRepository.update(event.id, { organizationId: orgId });
      }
    }

    try {
      switch (event.field) {
        case 'calls':
          if (this.fieldHandlers.onCallsEvent) {
            await this.fieldHandlers.onCallsEvent(event);
          }
          break;

        case 'messages':
          if (this.fieldHandlers.onMessagesEvent) {
            await this.fieldHandlers.onMessagesEvent(event);
          }
          break;

        case 'account_update':
          if (this.fieldHandlers.onAccountUpdateEvent) {
            await this.fieldHandlers.onAccountUpdateEvent(event);
          }
          break;

        case 'account_settings_update':
          if (this.fieldHandlers.onAccountSettingsUpdateEvent) {
            await this.fieldHandlers.onAccountSettingsUpdateEvent(event);
          }
          break;

        case 'message_template_status_update':
          if (this.fieldHandlers.onMessageTemplateStatusUpdateEvent) {
            await this.fieldHandlers.onMessageTemplateStatusUpdateEvent(event);
          }
          break;

        default:
          await this.webhookRepository.update(event.id, {
            status: 'SKIPPED',
            lastError: `Unknown field router: ${event.field}`,
          });
          return;
      }

      await this.webhookRepository.update(event.id, {
        status: 'PROCESSED',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.webhookRepository.update(event.id, {
        status: 'FAILED',
        attempts: event.attempts + 1,
        lastError: errorMessage,
      });
      throw err;
    }
  }
}
