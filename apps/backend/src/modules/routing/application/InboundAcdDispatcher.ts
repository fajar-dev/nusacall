import type { Call } from '../../calling/domain/entities/Call';
import type { CallRepositoryPort } from '../../calling/domain/ports/CallRepositoryPort';
import type { AgentStateStorePort } from '../../agent/domain/ports/AgentStateStorePort';
import type { ClockPort } from '../../../shared/ports/ClockPort';
import { ulid } from 'ulid';

export interface WsGatewayPort {
  sendToLocalUser(userId: string, envelope: { id: string; type: string; ts: number; payload: Record<string, unknown> }): boolean;
}

export interface AgentQueueRepositoryPort {
  findAvailableAgentUserIdsInQueue(organizationId: string, queueId: string): Promise<string[]>;
}

export class InboundAcdDispatcher {
  constructor(
    private readonly callRepo: CallRepositoryPort,
    private readonly agentQueueRepo: AgentQueueRepositoryPort,
    private readonly agentStateStore: AgentStateStorePort,
    private readonly wsGateway: WsGatewayPort,
    private readonly clock: ClockPort
  ) {}

  async dispatchInboundCall(call: Call, sdpOffer: string): Promise<string | null> {
    if (!call.queueId) return null;

    // 1. Ambil kandidat agent di antrian
    const candidateUserIds = await this.agentQueueRepo.findAvailableAgentUserIdsInQueue(
      call.organizationId,
      call.queueId
    );

    // 2. Filter agent yang statusnya saat ini AVAILABLE
    const availableCandidates: string[] = [];
    for (const userId of candidateUserIds) {
      const state = await this.agentStateStore.getAgentState(userId);
      if (state && state.status === 'AVAILABLE') {
        availableCandidates.push(userId);
      }
    }

    if (availableCandidates.length === 0) {
      return null; // Belum ada agent tersedia
    }

    // 3. Pilih agent pertama
    const selectedAgentId = availableCandidates[0]!;
    const now = this.clock.now();
    const deadlineAt = now.getTime() + 30000;

    // 4. Update Call state & assignedAgentId
    if (call.state === 'QUEUED') {
      call.transitionTo('RINGING');
    }
    call.setAssignedAgentId(selectedAgentId);
    call.incrementOfferAttempts();

    call.appendEvent(
      ulid(),
      'AGENT_OFFERED',
      'SYSTEM',
      selectedAgentId,
      { offerAttempt: call.offerAttempts },
      now
    );

    await this.callRepo.save(call);

    // 5. Kirim event call.offer ke agent via WebSocket
    this.wsGateway.sendToLocalUser(selectedAgentId, {
      id: ulid(),
      type: 'call.offer',
      ts: now.getTime(),
      payload: {
        callId: call.id,
        wacid: call.wacid || '',
        direction: 'INBOUND',
        sdp: sdpOffer,
        sdpType: 'offer',
        contact: { from: call.fromNumber },
        ringTimeoutSeconds: 30,
        deadlineAt,
      },
    });

    return selectedAgentId;
  }
}
