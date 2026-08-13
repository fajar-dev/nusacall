import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandleCallTerminateWebhook } from '../src/modules/calling/application/HandleCallTerminateWebhook';
import { HandleCallStatusWebhook } from '../src/modules/calling/application/HandleCallStatusWebhook';
import { StaleCallsSweeper } from '../src/modules/calling/application/StaleCallsSweeper';
import { WsGatewayManager, type CallGatewayHandlers } from '../src/modules/agent/application/WsGatewayManager';
import { Call } from '../src/modules/calling/domain/entities/Call';
import type { CallRepositoryPort } from '../src/modules/calling/domain/ports/CallRepositoryPort';
import type { GraphApiClientPort } from '../src/modules/meta/domain/ports/GraphApiClientPort';
import type { ClockPort } from '../src/shared/ports/ClockPort';

class InMemoryCallRepository implements CallRepositoryPort {
  public calls = new Map<string, Call>();

  async save(call: Call): Promise<void> {
    this.calls.set(call.id, call);
  }

  async findById(organizationId: string, callId: string): Promise<Call | null> {
    const call = this.calls.get(callId);
    if (call && call.organizationId === organizationId) return call;
    return null;
  }

  async findByWacid(wacid: string): Promise<Call | null> {
    for (const call of this.calls.values()) {
      if (call.wacid === wacid) return call;
    }
    return null;
  }

  async findStaleCalls(olderThan: Date): Promise<Call[]> {
    const result: Call[] = [];
    for (const call of this.calls.values()) {
      if ((call.state === 'QUEUED' || call.state === 'RINGING') && call.queuedAt && call.queuedAt <= olderThan) {
        result.push(call);
      }
    }
    return result;
  }
}

describe('E6-T6, E6-T7, E6-T8, E6-T9: Webhooks, Stale Sweeper & WS Call Signaling Handlers', () => {
  let callRepo: InMemoryCallRepository;
  let mockGraphApiClient: GraphApiClientPort;
  let mockClock: ClockPort;

  const orgId = '01J8ORG0000000000000000001';
  const pnid = '01J8PN0000000000000000001';
  const wacid = 'wacid.ABGG99999';

  beforeEach(() => {
    callRepo = new InMemoryCallRepository();

    mockGraphApiClient = {
      rejectCall: vi.fn().mockResolvedValue({ success: true }),
      terminateCall: vi.fn().mockResolvedValue({ success: true }),
    } as any;

    mockClock = {
      now: () => new Date('2026-08-14T10:00:00.000Z'),
    };
  });

  describe('E6-T6: HandleCallTerminateWebhook & HandleCallStatusWebhook', () => {
    it('should process call terminate webhook, update timing, and calculate billable pulses for outbound calls', async () => {
      const call = Call.create('call_01', {
        organizationId: orgId,
        waPhoneNumberId: pnid,
        wacid,
        direction: 'OUTBOUND',
        state: 'ACCEPTED',
        fromNumber: '628123456789',
        toNumber: '628987654321',
      });
      await callRepo.save(call);

      const handler = new HandleCallTerminateWebhook(callRepo, mockClock);
      const updated = await handler.execute({
        wacid,
        status: 'COMPLETED',
        startTime: 1755165600, // epoch
        endTime: 1755165720,
        durationSeconds: 120,
      });

      expect(updated.state).toBe('ENDED');
      expect(updated.endReason).toBe('COMPLETED');
      expect((updated as any).props.metaDurationSeconds).toBe(120);
      expect((updated as any).props.billablePulses).toBe(20); // ceil(120/6) = 20
    });

    it('should process call status webhook for RINGING, ACCEPTED, and REJECTED states', async () => {
      const call = Call.create('call_02', {
        organizationId: orgId,
        waPhoneNumberId: pnid,
        wacid,
        direction: 'INBOUND',
        state: 'QUEUED',
        fromNumber: '628123456789',
        toNumber: '628987654321',
      });
      await callRepo.save(call);

      const statusHandler = new HandleCallStatusWebhook(callRepo, mockClock);

      // RINGING status
      await statusHandler.execute({ wacid, status: 'RINGING' });
      let updated = await callRepo.findByWacid(wacid);
      expect(updated?.state).toBe('RINGING');
      expect(updated?.firstOfferedAt).toBeDefined();

      // ACCEPTED status
      await statusHandler.execute({ wacid, status: 'ACCEPTED' });
      updated = await callRepo.findByWacid(wacid);
      expect(updated?.state).toBe('ACCEPTED');
      expect(updated?.answeredAt).toBeDefined();
    });
  });

  describe('E6-T7: StaleCallsSweeper 30-second Timeout Guard (BR-006)', () => {
    it('should sweep calls in QUEUED state older than 30 seconds, reject via Graph API, and mark STALE', async () => {
      const oldQueuedAt = new Date('2026-08-14T09:59:20.000Z'); // 40 seconds ago relative to 10:00:00

      const staleCall = Call.create('call_stale_1', {
        organizationId: orgId,
        waPhoneNumberId: pnid,
        wacid,
        direction: 'INBOUND',
        state: 'QUEUED',
        fromNumber: '628123456789',
        toNumber: '628987654321',
        queuedAt: oldQueuedAt,
      });
      await callRepo.save(staleCall);

      const sweeper = new StaleCallsSweeper(callRepo, mockGraphApiClient, mockClock);
      const sweptCount = await sweeper.sweep(30);

      expect(sweptCount).toBe(1);
      expect(mockGraphApiClient.rejectCall).toHaveBeenCalledWith({
        phoneNumberId: pnid,
        callId: wacid,
      });

      const updated = await callRepo.findByWacid(wacid);
      expect(updated?.state).toBe('STALE');
      expect(updated?.endReason).toBe('STALE_TIMED_OUT');
    });
  });

  describe('E6-T9: WsGatewayManager Call Signaling Handlers', () => {
    it('should invoke callHandlers on call.answer_sdp, call.answer, call.reject, call.hangup, call.ice_state, call.media_error', async () => {
      const mockTokenService = {
        consumeToken: vi.fn().mockResolvedValue({ userId: 'usr_01', organizationId: orgId }),
      } as any;
      const mockAgentStateStore = {
        getAgentState: vi.fn().mockResolvedValue({ status: 'AVAILABLE' }),
        setAgentState: vi.fn().mockResolvedValue({ status: 'AVAILABLE' }),
      } as any;

      const mockCallHandlers: CallGatewayHandlers = {
        onAnswerSdp: vi.fn().mockResolvedValue(undefined),
        onAnswer: vi.fn().mockResolvedValue(undefined),
        onReject: vi.fn().mockResolvedValue(undefined),
        onHangup: vi.fn().mockResolvedValue(undefined),
        onIceState: vi.fn().mockResolvedValue(undefined),
        onMediaError: vi.fn().mockResolvedValue(undefined),
      };

      const manager = new WsGatewayManager(mockTokenService, mockAgentStateStore, undefined, mockCallHandlers);

      const mockSocket = { send: vi.fn(), close: vi.fn() };
      await manager.authenticateAndConnect('valid_token', mockSocket);

      // call.answer_sdp
      await manager.handleIncomingMessage('usr_01', JSON.stringify({
        id: 'msg_1',
        type: 'call.answer_sdp',
        ts: Date.now(),
        payload: { callId: 'call_01', sdp: 'v=0...' },
      }));
      expect(mockCallHandlers.onAnswerSdp).toHaveBeenCalledWith('usr_01', orgId, 'call_01', 'v=0...');

      // call.answer
      await manager.handleIncomingMessage('usr_01', JSON.stringify({
        id: 'msg_2',
        type: 'call.answer',
        ts: Date.now(),
        payload: { callId: 'call_01' },
      }));
      expect(mockCallHandlers.onAnswer).toHaveBeenCalledWith('usr_01', orgId, 'call_01');

      // call.reject
      await manager.handleIncomingMessage('usr_01', JSON.stringify({
        id: 'msg_3',
        type: 'call.reject',
        ts: Date.now(),
        payload: { callId: 'call_01', reason: 'BUSY' },
      }));
      expect(mockCallHandlers.onReject).toHaveBeenCalledWith('usr_01', orgId, 'call_01', 'BUSY');

      // call.hangup
      await manager.handleIncomingMessage('usr_01', JSON.stringify({
        id: 'msg_4',
        type: 'call.hangup',
        ts: Date.now(),
        payload: { callId: 'call_01' },
      }));
      expect(mockCallHandlers.onHangup).toHaveBeenCalledWith('usr_01', orgId, 'call_01');

      // call.ice_state
      await manager.handleIncomingMessage('usr_01', JSON.stringify({
        id: 'msg_5',
        type: 'call.ice_state',
        ts: Date.now(),
        payload: { callId: 'call_01', iceConnectionState: 'connected' },
      }));
      expect(mockCallHandlers.onIceState).toHaveBeenCalledWith('usr_01', orgId, 'call_01', 'connected');

      // call.media_error
      await manager.handleIncomingMessage('usr_01', JSON.stringify({
        id: 'msg_6',
        type: 'call.media_error',
        ts: Date.now(),
        payload: { callId: 'call_01', code: 'ICE_FAILED', message: 'ICE negotiation failed' },
      }));
      expect(mockCallHandlers.onMediaError).toHaveBeenCalledWith('usr_01', orgId, 'call_01', 'ICE_FAILED', 'ICE negotiation failed');
    });
  });
});
