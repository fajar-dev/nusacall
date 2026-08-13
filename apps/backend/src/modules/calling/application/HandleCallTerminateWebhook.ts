import type { Call } from '../domain/entities/Call';
import type { CallRepositoryPort } from '../domain/ports/CallRepositoryPort';
import type { ClockPort } from '../../../shared/ports/ClockPort';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { CallStateMachine } from '../domain/CallStateMachine';
import { ulid } from 'ulid';

export interface HandleCallTerminateWebhookInput {
  wacid: string;
  bizOpaqueCallbackData?: string | undefined;
  status: 'COMPLETED' | 'FAILED';
  startTime?: number | undefined;
  endTime?: number | undefined;
  durationSeconds?: number | undefined;
  error?: {
    code: number;
    message: string;
  } | undefined;
}

export class HandleCallTerminateWebhook {
  constructor(
    private readonly callRepo: CallRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  async execute(input: HandleCallTerminateWebhookInput): Promise<Call> {
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

    const startTime = input.startTime
      ? new Date(input.startTime > 1e11 ? input.startTime : input.startTime * 1000)
      : undefined;
    const endTime = input.endTime
      ? new Date(input.endTime > 1e11 ? input.endTime : input.endTime * 1000)
      : undefined;

    call.setMetaTiming(startTime, endTime, input.durationSeconds);

    if (input.durationSeconds !== undefined && call.direction === 'OUTBOUND') {
      call.setBillablePulses(Math.ceil(input.durationSeconds / 6));
    }

    if (input.error) {
      call.setError(input.error.code, input.error.message);
    }

    if (!CallStateMachine.isTerminal(call.state)) {
      const nextState = input.status === 'COMPLETED' ? 'ENDED' : 'FAILED';
      call.transitionTo(nextState);
      if (input.status === 'COMPLETED') {
        call.setEndReason('COMPLETED');
      } else {
        call.setEndReason('FAILED');
      }
      call.setEndedAt(now);
    }

    call.appendEvent(
      ulid(),
      'WEBHOOK_TERMINATE',
      'META',
      undefined,
      {
        status: input.status,
        ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
        ...(input.error ? { error: input.error } : {}),
      },
      now
    );

    await this.callRepo.save(call);
    return call;
  }
}
