import type { Call } from '../domain/entities/Call';
import type { CallRepositoryPort } from '../domain/ports/CallRepositoryPort';
import type { SdpCachePort } from '../domain/ports/SdpCachePort';
import type { GraphApiClientPort } from '../../meta/domain/ports/GraphApiClientPort';
import type { ClockPort } from '../../../shared/ports/ClockPort';
import { NotFoundError, ValidationError, BusinessRuleError } from '../../../shared/errors/AppError';
import { ulid } from 'ulid';

export interface AcceptCallInput {
  organizationId: string;
  callId: string;
  agentUserId: string;
}

export class AcceptCall {
  constructor(
    private readonly callRepo: CallRepositoryPort,
    private readonly sdpCache: SdpCachePort,
    private readonly graphApiClient: GraphApiClientPort,
    private readonly clock: ClockPort
  ) {}

  async execute(input: AcceptCallInput): Promise<Call> {
    if (!input.organizationId) throw new ValidationError('VALIDATION_ERROR', 'organizationId wajib diisi');
    if (!input.callId) throw new ValidationError('VALIDATION_ERROR', 'callId wajib diisi');
    if (!input.agentUserId) throw new ValidationError('VALIDATION_ERROR', 'agentUserId wajib diisi');

    const call = await this.callRepo.findById(input.organizationId, input.callId);
    if (!call) {
      throw new NotFoundError('NOT_FOUND', 'Panggilan tidak ditemukan');
    }

    if (!call.wacid) {
      throw new ValidationError('VALIDATION_ERROR', 'Call wacid belum tersedia');
    }

    // 1. Ambil SDP Answer dari cache Redis (sdp:answer:{wacid})
    const cachedSdp = await this.sdpCache.getAnswerSdp(call.wacid);

    // 2. Jika cache kosong -> Tolak panggilan dan lempar SDP_ANSWER_MISSING
    if (!cachedSdp) {
      try {
        await this.graphApiClient.rejectCall({
          phoneNumberId: call.waPhoneNumberId,
          callId: call.wacid,
        });
      } catch {
        // Abaikan error reject jika wacid sudah kadaluwarsa di Meta
      }
      call.transitionTo('REJECTED');
      call.setEndReason('SDP_ANSWER_MISSING');
      await this.callRepo.save(call);

      throw new BusinessRuleError(
        'SDP_ANSWER_MISSING',
        'SDP answer tidak ditemukan di cache untuk panggilan ini'
      );
    }

    // 3. Panggil Graph API accept dengan SDP answer yang IDENTIK
    await this.graphApiClient.acceptCall({
      phoneNumberId: call.waPhoneNumberId,
      callId: call.wacid,
      sdpAnswer: cachedSdp,
      bizOpaqueCallbackData: call.id,
    });

    // 4. Transisi state Call ke ACCEPTED
    call.transitionTo('ACCEPTED');
    call.setAssignedAgentId(input.agentUserId);

    const now = this.clock.now();
    call.appendEvent(ulid(), 'ACTION_ACCEPT', 'AGENT', input.agentUserId, undefined, now);

    // 5. Simpan Call
    await this.callRepo.save(call);

    return call;
  }
}
