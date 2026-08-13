import type { Call } from '../domain/entities/Call';
import type { CallRepositoryPort } from '../domain/ports/CallRepositoryPort';
import type { SdpCachePort } from '../domain/ports/SdpCachePort';
import type { GraphApiClientPort } from '../../meta/domain/ports/GraphApiClientPort';
import type { ClockPort } from '../../../shared/ports/ClockPort';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { ulid } from 'ulid';

export interface PreAcceptCallInput {
  organizationId: string;
  callId: string;
  sdpAnswer: string;
  agentUserId: string;
}

export class PreAcceptCall {
  constructor(
    private readonly callRepo: CallRepositoryPort,
    private readonly sdpCache: SdpCachePort,
    private readonly graphApiClient: GraphApiClientPort,
    private readonly clock: ClockPort
  ) {}

  async execute(input: PreAcceptCallInput): Promise<Call> {
    if (!input.organizationId) throw new ValidationError('VALIDATION_ERROR', 'organizationId wajib diisi');
    if (!input.callId) throw new ValidationError('VALIDATION_ERROR', 'callId wajib diisi');
    if (!input.sdpAnswer) throw new ValidationError('VALIDATION_ERROR', 'sdpAnswer wajib diisi');
    if (!input.agentUserId) throw new ValidationError('VALIDATION_ERROR', 'agentUserId wajib diisi');

    const call = await this.callRepo.findById(input.organizationId, input.callId);
    if (!call) {
      throw new NotFoundError('NOT_FOUND', 'Panggilan tidak ditemukan');
    }

    if (!call.wacid) {
      throw new ValidationError('VALIDATION_ERROR', 'Call wacid belum tersedia');
    }

    // 1. Simpan SDP answer di Redis cache (sdp:answer:{wacid})
    await this.sdpCache.saveAnswerSdp(call.wacid, input.sdpAnswer, 300);

    // 2. Transisi state Call ke PRE_ACCEPTED
    call.transitionTo('PRE_ACCEPTED');
    call.setAssignedAgentId(input.agentUserId);

    // 3. Panggil Graph API pre_accept
    await this.graphApiClient.preAcceptCall({
      phoneNumberId: call.waPhoneNumberId,
      callId: call.wacid,
      sdpAnswer: input.sdpAnswer,
      bizOpaqueCallbackData: call.id,
    });

    // 4. Catat CallEvent
    const now = this.clock.now();
    call.appendEvent(ulid(), 'ACTION_PRE_ACCEPT', 'AGENT', input.agentUserId, undefined, now);

    // 5. Simpan Call
    await this.callRepo.save(call);

    return call;
  }
}
