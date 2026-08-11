import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { ulid } from 'ulid';
import type { MetaAppRepositoryPort } from '../domain/ports/MetaAppRepositoryPort';
import type { WebhookRepositoryPort } from '../domain/ports/WebhookRepositoryPort';
import type { QueuePort } from '../domain/ports/QueuePort';

export interface WebhookIngestResult {
  status: 'SUCCESS' | 'INVALID_SIGNATURE' | 'NOT_FOUND' | 'DUPLICATE';
  inserted?: boolean;
  webhookEventId?: string;
}

export class WebhookIngestService {
  constructor(
    private readonly metaAppRepository: MetaAppRepositoryPort,
    private readonly webhookRepository: WebhookRepositoryPort,
    private readonly queuePort: QueuePort
  ) {}

  async processWebhook(
    metaAppId: string,
    rawBody: string | Buffer,
    signatureHeader?: string
  ): Promise<WebhookIngestResult> {
    const metaApp = await this.metaAppRepository.findById(metaAppId);
    if (!metaApp) {
      return { status: 'NOT_FOUND' };
    }

    const rawBodyText = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    const isSignatureValid = this.verifyHmacSignature(rawBodyText, metaApp.appSecret, signatureHeader);

    let payload: Record<string, unknown> = {};
    let field = 'unknown';
    let wabaId: string | null = null;
    let phoneNumberId: string | null = null;

    try {
      payload = JSON.parse(rawBodyText) as Record<string, unknown>;
      const entryArray = (payload.entry as Array<Record<string, unknown>>) || [];
      if (entryArray.length > 0 && entryArray[0]) {
        const firstEntry = entryArray[0];
        wabaId = (firstEntry.id as string) || null;
        const changesArray = (firstEntry.changes as Array<Record<string, unknown>>) || [];
        if (changesArray.length > 0 && changesArray[0]) {
          const firstChange = changesArray[0];
          field = (firstChange.field as string) || 'unknown';
          const valueObj = (firstChange.value as Record<string, unknown>) || {};
          const metadataObj = (valueObj.metadata as Record<string, unknown>) || {};
          phoneNumberId = (metadataObj.phone_number_id as string) || null;
        }
      }
    } catch {
      payload = { raw: rawBodyText };
    }

    const dedupeKey = createHash('sha256')
      .update(`${metaAppId}:${rawBodyText}`)
      .digest('hex');

    const eventId = ulid();

    if (!isSignatureValid) {
      await this.webhookRepository.save({
        id: eventId,
        metaAppId,
        dedupeKey,
        field,
        wabaId,
        phoneNumberId,
        payload,
        signatureValid: false,
        status: 'SKIPPED',
        receivedAt: new Date(),
        attempts: 0,
      });

      return { status: 'INVALID_SIGNATURE' };
    }

    const saved = await this.webhookRepository.save({
      id: eventId,
      metaAppId,
      dedupeKey,
      field,
      wabaId,
      phoneNumberId,
      payload,
      signatureValid: true,
      status: 'PENDING',
      receivedAt: new Date(),
      attempts: 0,
    });

    if (!saved.inserted) {
      return { status: 'DUPLICATE' };
    }

    await this.queuePort.enqueue(
      'webhook.process',
      'process-webhook',
      { webhookEventId: saved.id },
      { jobId: saved.id }
    );

    return {
      status: 'SUCCESS',
      inserted: true,
      webhookEventId: saved.id,
    };
  }

  private verifyHmacSignature(
    bodyText: string,
    appSecret: string,
    signatureHeader?: string
  ): boolean {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const providedHex = signatureHeader.slice(7);
    const computedHex = createHmac('sha256', appSecret)
      .update(bodyText)
      .digest('hex');

    const providedBuf = Buffer.from(providedHex, 'utf-8');
    const computedBuf = Buffer.from(computedHex, 'utf-8');

    if (providedBuf.length !== computedBuf.length) {
      return false;
    }

    return timingSafeEqual(providedBuf, computedBuf);
  }
}
