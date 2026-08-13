import type { Call } from '../domain/entities/Call';
import type { CallRepositoryPort } from '../domain/ports/CallRepositoryPort';
import type { GraphApiClientPort } from '../../meta/domain/ports/GraphApiClientPort';
import type { ClockPort } from '../../../shared/ports/ClockPort';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { ulid } from 'ulid';

export interface RejectCallInput {
  organizationId: string;
  callId: string;
  reason?: string | undefined;
  actorType?: 'AGENT' | 'SYSTEM' | undefined;
  actorId?: string | undefined;
}

export class RejectCall {
  constructor(
    private readonly callRepo: CallRepositoryPort,
    private readonly graphApiClient: GraphApiClientPort,
    private readonly clock: ClockPort
  ) {}

  async execute(input: RejectCallInput): Promise<Call> {
    if (!input.organizationId) throw new ValidationError('VALIDATION_ERROR', 'organizationId wajib diisi');
    if (!input.callId) throw new ValidationError('VALIDATION_ERROR', 'callId wajib diisi');

    const call = await this.callRepo.findById(input.organizationId, input.callId);
    if (!call) {
      throw new NotFoundError('NOT_FOUND', 'Panggilan tidak ditemukan');
    }

    const actorType = input.actorType ?? 'AGENT';

    // 1. Panggil Graph API reject jika wacid tersedia
    if (call.wacid) {
      try {
        await this.graphApiClient.rejectCall({
          phoneNumberId: call.waPhoneNumberId,
          callId: call.wacid,
        });
      } catch {
        // Abaikan error jaringan/Meta pada reject
      }
    }

    // 2. Transisi state ke REJECTED
    call.transitionTo('REJECTED');
    call.setEndReason(input.reason ?? 'REJECTED_BY_AGENT');

    const now = this.clock.now();
    call.appendEvent(
      ulid(),
      'ACTION_REJECT',
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
