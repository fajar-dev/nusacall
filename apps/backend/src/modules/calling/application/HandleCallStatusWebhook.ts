import type { Call } from '../domain/entities/Call';
import type { CallRepositoryPort } from '../domain/ports/CallRepositoryPort';
import type { ClockPort } from '../../../shared/ports/ClockPort';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { ulid } from 'ulid';

export interface HandleCallStatusWebhookInput {
  wacid: string;
  bizOpaqueCallbackData?: string | undefined;
  status: 'RINGING' | 'ACCEPTED' | 'REJECTED';
  timestamp?: number | undefined;
}

export class HandleCallStatusWebhook {
  constructor(
    private readonly callRepo: CallRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  async execute(input: HandleCallStatusWebhookInput): Promise<Call> {
    if (!input.wacid && !input.bizOpaqueCallbackData) {
      throw new ValidationError('VALIDATION_ERROR', 'wacid atau bizOpaqueCallbackData wajib diisi');
    }

    let call: Call | null = null;
    if (input.wacid) {
      call = await this.callRepo.findByWacid(input.wacid);
    }

    if (!call) {
      throw new NotFoundError('NOT_FOUND', `Panggilan dengan wacid ${input.wacid} tidak ditemukan`);
    }

    const now = this.clock.now();

    if (input.status === 'RINGING') {
      if (call.state === 'QUEUED' || call.state === 'INITIATED') {
        call.transitionTo('RINGING');
        call.setFirstOfferedAt(now);
      }
    } else if (input.status === 'ACCEPTED') {
      if (call.state === 'RINGING' || call.state === 'PRE_ACCEPTED' || call.state === 'QUEUED') {
        call.transitionTo('ACCEPTED');
        call.setAnsweredAt(now);
      }
    } else if (input.status === 'REJECTED') {
      if (call.state !== 'REJECTED' && call.state !== 'ENDED') {
        call.transitionTo('REJECTED');
        call.setEndReason('REJECTED_BY_USER');
      }
    }

    call.appendEvent(
      ulid(),
      'WEBHOOK_STATUS',
      'META',
      undefined,
      {
        status: input.status,
      },
      now
    );

    await this.callRepo.save(call);
    return call;
  }
}
