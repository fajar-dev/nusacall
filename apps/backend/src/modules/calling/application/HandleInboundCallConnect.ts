import { ulid } from 'ulid';
import { Call } from '../domain/entities/Call';
import type { CallRepositoryPort } from '../domain/ports/CallRepositoryPort';
import type { ClockPort } from '../../../shared/ports/ClockPort';
import { ValidationError } from '../../../shared/errors/AppError';

export interface ContactResolverPort {
  resolveFromWebhook(params: {
    organizationId: string;
    waId: string;
    profileName?: string | undefined;
    rawPhoneNumber?: string | undefined;
  }): Promise<{ id: string; customAttributes?: unknown }>;
}

export interface RoutingResolverPort {
  resolveQueue(
    organizationId: string,
    context: {
      payload?: string | undefined;
      phoneNumber?: string | undefined;
      contactAttributes?: Record<string, unknown> | undefined;
      defaultQueueId: string;
    }
  ): Promise<{ targetQueueId: string; matchedRuleId: string | null }>;
}

export interface HandleInboundCallConnectInput {
  organizationId: string;
  waPhoneNumberId: string;
  wacid: string;
  fromNumber: string;
  toNumber: string;
  profileName?: string | undefined;
  ctaPayload?: string | undefined;
  deeplinkPayload?: string | undefined;
  sdpOffer?: string | undefined;
  defaultQueueId: string;
}

export class HandleInboundCallConnect {
  constructor(
    private readonly callRepo: CallRepositoryPort,
    private readonly contactResolver: ContactResolverPort,
    private readonly routingResolver: RoutingResolverPort,
    private readonly clock: ClockPort
  ) {}

  async execute(input: HandleInboundCallConnectInput): Promise<Call> {
    if (!input.organizationId) throw new ValidationError('VALIDATION_ERROR', 'organizationId wajib diisi');
    if (!input.waPhoneNumberId) throw new ValidationError('VALIDATION_ERROR', 'waPhoneNumberId wajib diisi');
    if (!input.wacid) throw new ValidationError('VALIDATION_ERROR', 'wacid wajib diisi');
    if (!input.fromNumber) throw new ValidationError('VALIDATION_ERROR', 'fromNumber wajib diisi');
    if (!input.defaultQueueId) throw new ValidationError('VALIDATION_ERROR', 'defaultQueueId wajib diisi');

    // 1. Resolve Contact
    const contact = await this.contactResolver.resolveFromWebhook({
      organizationId: input.organizationId,
      waId: input.fromNumber,
      profileName: input.profileName,
      rawPhoneNumber: input.fromNumber,
    });

    // 2. Resolve Queue via Routing Rules
    const payload = input.ctaPayload || input.deeplinkPayload;
    const routingResult = await this.routingResolver.resolveQueue(input.organizationId, {
      payload,
      phoneNumber: input.fromNumber,
      contactAttributes: (contact.customAttributes as Record<string, unknown> | null) ?? undefined,
      defaultQueueId: input.defaultQueueId,
    });

    // 3. Determine Entry Point
    let entryPoint = 'CHAT_ICON';
    if (input.ctaPayload) {
      entryPoint = 'CTA_BUTTON';
    } else if (input.deeplinkPayload) {
      entryPoint = 'DEEPLINK';
    }

    // 4. Create Call entity in QUEUED state
    const callId = ulid();
    const now = this.clock.now();

    const call = Call.create(callId, {
      organizationId: input.organizationId,
      waPhoneNumberId: input.waPhoneNumberId,
      contactId: contact.id,
      wacid: input.wacid,
      direction: 'INBOUND',
      state: 'QUEUED',
      fromNumber: input.fromNumber,
      toNumber: input.toNumber,
      queueId: routingResult.targetQueueId,
      ...(input.ctaPayload ? { ctaPayload: input.ctaPayload } : {}),
      ...(input.deeplinkPayload ? { deeplinkPayload: input.deeplinkPayload } : {}),
      entryPoint,
      queuedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Append initial WEBHOOK_CONNECT event
    const eventId = ulid();
    call.appendEvent(
      eventId,
      'WEBHOOK_CONNECT',
      'META',
      undefined,
      {
        wacid: input.wacid,
        direction: 'USER_INITIATED',
        entryPoint,
        ...(input.sdpOffer ? { sdpOffer: input.sdpOffer } : {}),
      },
      now
    );

    // 6. Save Call
    await this.callRepo.save(call);

    return call;
  }
}
