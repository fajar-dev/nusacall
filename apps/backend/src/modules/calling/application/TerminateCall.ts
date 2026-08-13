import type { Call } from '../domain/entities/Call';
import type { CallRepositoryPort } from '../domain/ports/CallRepositoryPort';
import type { GraphApiClientPort } from '../../meta/domain/ports/GraphApiClientPort';
import type { ClockPort } from '../../../shared/ports/ClockPort';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { ulid } from 'ulid';

export interface TerminateCallInput {
  organizationId: string;
  callId: string;
  reason?: string | undefined;
  actorType?: 'AGENT' | 'SUPERVISOR' | 'SYSTEM' | undefined;
  actorId?: string | undefined;
  requireWrapUp?: boolean | undefined;
}

export class TerminateCall {
  constructor(
    private readonly callRepo: CallRepositoryPort,
    private readonly graphApiClient: GraphApiClientPort,
    private readonly clock: ClockPort
  ) {}

  async execute(input: TerminateCallInput): Promise<Call> {
    if (!input.organizationId) throw new ValidationError('VALIDATION_ERROR', 'organizationId wajib diisi');
    if (!input.callId) throw new ValidationError('VALIDATION_ERROR', 'callId wajib diisi');

    const call = await this.callRepo.findById(input.organizationId, input.callId);
    if (!call) {
      throw new NotFoundError('NOT_FOUND', 'Panggilan tidak ditemukan');
    }

    const actorType = input.actorType ?? 'AGENT';

    // 1. Panggil Graph API terminate jika wacid tersedia
    if (call.wacid) {
      try {
        await this.graphApiClient.terminateCall({
          phoneNumberId: call.waPhoneNumberId,
          callId: call.wacid,
        });
      } catch {
        // Continue even if Graph API call fails or was already terminated
      }
    }

    // 2. Transisi state (WRAP_UP jika requireWrapUp, selainnya ENDED)
    const nextState = input.requireWrapUp ? 'WRAP_UP' : 'ENDED';
    call.transitionTo(nextState);
    call.setEndReason(input.reason ?? 'COMPLETED');

    const now = this.clock.now();
    call.appendEvent(
      ulid(),
      'ACTION_TERMINATE',
      actorType,
      input.actorId,
      input.reason ? { reason: input.reason } : undefined,
      now
    );

    // 3. Simpan Call
    await this.callRepo.save(call);

    return call;
  }
}
