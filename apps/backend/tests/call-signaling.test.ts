import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandleInboundCallConnect } from '../src/modules/calling/application/HandleInboundCallConnect';
import { PreAcceptCall } from '../src/modules/calling/application/PreAcceptCall';
import { AcceptCall } from '../src/modules/calling/application/AcceptCall';
import { RejectCall } from '../src/modules/calling/application/RejectCall';
import { TerminateCall } from '../src/modules/calling/application/TerminateCall';
import { RedisSdpCache } from '../src/modules/calling/infrastructure/RedisSdpCache';
import { Call } from '../src/modules/calling/domain/entities/Call';
import type { CallRepositoryPort } from '../src/modules/calling/domain/ports/CallRepositoryPort';
import type { ContactResolverService } from '../src/modules/contacts/application/ContactResolverService';
import type { RoutingResolverService } from '../src/modules/routing/application/RoutingResolverService';
import type { GraphApiClientPort } from '../src/modules/meta/domain/ports/GraphApiClientPort';
import type { ClockPort } from '../src/shared/ports/ClockPort';
import { BusinessRuleError } from '../src/shared/errors/AppError';

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

describe('E6-T3, E6-T4, E6-T5: Inbound Call Signaling & Use Cases', () => {
  let callRepo: InMemoryCallRepository;
  let mockContactResolver: ContactResolverService;
  let mockRoutingResolver: RoutingResolverService;
  let mockGraphApiClient: GraphApiClientPort;
  let mockClock: ClockPort;
  let redisMemory: Map<string, { value: string; ttl?: number | undefined }>;
  let mockRedis: any;
  let sdpCache: RedisSdpCache;

  const orgId = '01J8ORG0000000000000000001';
  const pnid = '01J8PN0000000000000000001';
  const wacid = 'wacid.ABGG12345';

  beforeEach(() => {
    callRepo = new InMemoryCallRepository();

    mockContactResolver = {
      resolveFromWebhook: vi.fn().mockResolvedValue({
        id: 'cnt_01',
        organizationId: orgId,
        waId: '628123456789',
        phoneNumber: '+628123456789',
        name: 'Budi',
        customAttributes: null,
      }),
    } as any;

    mockRoutingResolver = {
      resolveQueue: vi.fn().mockResolvedValue({
        targetQueueId: 'queue_default',
        matchedRuleId: null,
      }),
    } as any;

    mockGraphApiClient = {
      preAcceptCall: vi.fn().mockResolvedValue({ success: true }),
      acceptCall: vi.fn().mockResolvedValue({ success: true }),
      rejectCall: vi.fn().mockResolvedValue({ success: true }),
      terminateCall: vi.fn().mockResolvedValue({ success: true }),
    } as any;

    mockClock = {
      now: () => new Date('2026-08-14T10:00:00.000Z'),
    };

    redisMemory = new Map();
    mockRedis = {
      set: vi.fn().mockImplementation(async (key: string, val: string, _optKey?: string, optVal?: number) => {
        redisMemory.set(key, { value: val, ...(optVal !== undefined ? { ttl: optVal } : {}) });
        return 'OK';
      }),
      get: vi.fn().mockImplementation(async (key: string) => {
        const item = redisMemory.get(key);
        return item ? item.value : null;
      }),
      del: vi.fn().mockImplementation(async (key: string) => {
        const existed = redisMemory.has(key);
        redisMemory.delete(key);
        return existed ? 1 : 0;
      }),
    };

    sdpCache = new RedisSdpCache(mockRedis);
  });

  describe('E6-T4: RedisSdpCache', () => {
    it('should save SDP answer with key sdp:answer:{wacid} and TTL 300 seconds', async () => {
      await sdpCache.saveAnswerSdp(wacid, 'v=0\r\no=meta...', 300);

      expect(mockRedis.set).toHaveBeenCalledWith('sdp:answer:wacid.ABGG12345', 'v=0\r\no=meta...', 'EX', 300);
      const cached = await sdpCache.getAnswerSdp(wacid);
      expect(cached).toBe('v=0\r\no=meta...');
    });

    it('should delete SDP answer from cache', async () => {
      await sdpCache.saveAnswerSdp(wacid, 'v=0...');
      await sdpCache.deleteAnswerSdp(wacid);
      const cached = await sdpCache.getAnswerSdp(wacid);
      expect(cached).toBeNull();
    });
  });

  describe('E6-T3: HandleInboundCallConnect Use Case', () => {
    it('should create Call in QUEUED state, resolve contact and queue, and set entryPoint', async () => {
      const useCase = new HandleInboundCallConnect(
        callRepo,
        mockContactResolver,
        mockRoutingResolver,
        mockClock
      );

      const call = await useCase.execute({
        organizationId: orgId,
        waPhoneNumberId: pnid,
        wacid,
        fromNumber: '628123456789',
        toNumber: '628987654321',
        profileName: 'Budi',
        ctaPayload: 'SUPPORT_VIP',
        sdpOffer: 'v=0\r\no=offer...',
        defaultQueueId: 'queue_default',
      });

      expect(call.state).toBe('QUEUED');
      expect(call.direction).toBe('INBOUND');
      expect(call.contactId).toBe('cnt_01');
      expect(call.queueId).toBe('queue_default');
      expect(call.entryPoint).toBe('CTA_BUTTON');
      expect(call.ctaPayload).toBe('SUPPORT_VIP');
      expect(call.events.length).toBe(1);
      expect(call.events[0]!.type).toBe('WEBHOOK_CONNECT');

      const savedCall = await callRepo.findById(orgId, call.id);
      expect(savedCall).not.toBeNull();
    });
  });

  describe('E6-T5: PreAcceptCall, AcceptCall, RejectCall, TerminateCall Use Cases', () => {
    it('should pre-accept call, save SDP answer to cache, and transition state to PRE_ACCEPTED', async () => {
      const connect = new HandleInboundCallConnect(callRepo, mockContactResolver, mockRoutingResolver, mockClock);
      const call = await connect.execute({
        organizationId: orgId,
        waPhoneNumberId: pnid,
        wacid,
        fromNumber: '628123456789',
        toNumber: '628987654321',
        defaultQueueId: 'queue_default',
      });

      const preAccept = new PreAcceptCall(callRepo, sdpCache, mockGraphApiClient, mockClock);
      const updatedCall = await preAccept.execute({
        organizationId: orgId,
        callId: call.id,
        sdpAnswer: 'v=0\r\no=agent_answer...',
        agentUserId: 'usr_agent_01',
      });

      expect(updatedCall.state).toBe('PRE_ACCEPTED');
      expect(mockGraphApiClient.preAcceptCall).toHaveBeenCalledWith({
        phoneNumberId: pnid,
        callId: wacid,
        sdpAnswer: 'v=0\r\no=agent_answer...',
        bizOpaqueCallbackData: call.id,
      });

      const cachedSdp = await sdpCache.getAnswerSdp(wacid);
      expect(cachedSdp).toBe('v=0\r\no=agent_answer...');
    });

    it('CRITICAL DoD: AcceptCall should use identical cached SDP answer and transition state to ACCEPTED', async () => {
      const connect = new HandleInboundCallConnect(callRepo, mockContactResolver, mockRoutingResolver, mockClock);
      const call = await connect.execute({
        organizationId: orgId,
        waPhoneNumberId: pnid,
        wacid,
        fromNumber: '628123456789',
        toNumber: '628987654321',
        defaultQueueId: 'queue_default',
      });

      const preAccept = new PreAcceptCall(callRepo, sdpCache, mockGraphApiClient, mockClock);
      await preAccept.execute({
        organizationId: orgId,
        callId: call.id,
        sdpAnswer: 'v=0\r\no=agent_answer_123',
        agentUserId: 'usr_agent_01',
      });

      const accept = new AcceptCall(callRepo, sdpCache, mockGraphApiClient, mockClock);
      const acceptedCall = await accept.execute({
        organizationId: orgId,
        callId: call.id,
        agentUserId: 'usr_agent_01',
      });

      expect(acceptedCall.state).toBe('ACCEPTED');
      expect(mockGraphApiClient.acceptCall).toHaveBeenCalledWith({
        phoneNumberId: pnid,
        callId: wacid,
        sdpAnswer: 'v=0\r\no=agent_answer_123',
        bizOpaqueCallbackData: call.id,
      });
    });

    it('CRITICAL DoD: AcceptCall should reject call and throw SDP_ANSWER_MISSING if SDP answer is missing in cache', async () => {
      const connect = new HandleInboundCallConnect(callRepo, mockContactResolver, mockRoutingResolver, mockClock);
      const call = await connect.execute({
        organizationId: orgId,
        waPhoneNumberId: pnid,
        wacid,
        fromNumber: '628123456789',
        toNumber: '628987654321',
        defaultQueueId: 'queue_default',
      });

      // SDP answer is NOT saved in sdpCache
      const accept = new AcceptCall(callRepo, sdpCache, mockGraphApiClient, mockClock);

      await expect(
        accept.execute({
          organizationId: orgId,
          callId: call.id,
          agentUserId: 'usr_agent_01',
        })
      ).rejects.toThrow(BusinessRuleError);

      expect(mockGraphApiClient.rejectCall).toHaveBeenCalledWith({
        phoneNumberId: pnid,
        callId: wacid,
      });

      const savedCall = await callRepo.findById(orgId, call.id);
      expect(savedCall?.state).toBe('REJECTED');
      expect(savedCall?.endReason).toBe('SDP_ANSWER_MISSING');
    });

    it('should reject call via RejectCall use case', async () => {
      const connect = new HandleInboundCallConnect(callRepo, mockContactResolver, mockRoutingResolver, mockClock);
      const call = await connect.execute({
        organizationId: orgId,
        waPhoneNumberId: pnid,
        wacid,
        fromNumber: '628123456789',
        toNumber: '628987654321',
        defaultQueueId: 'queue_default',
      });

      const reject = new RejectCall(callRepo, mockGraphApiClient, mockClock);
      const rejectedCall = await reject.execute({
        organizationId: orgId,
        callId: call.id,
        reason: 'BUSY',
        actorType: 'AGENT',
        actorId: 'usr_agent_01',
      });

      expect(rejectedCall.state).toBe('REJECTED');
      expect(rejectedCall.endReason).toBe('BUSY');
      expect(mockGraphApiClient.rejectCall).toHaveBeenCalledWith({
        phoneNumberId: pnid,
        callId: wacid,
      });
    });

    it('should terminate call via TerminateCall use case', async () => {
      const connect = new HandleInboundCallConnect(callRepo, mockContactResolver, mockRoutingResolver, mockClock);
      const call = await connect.execute({
        organizationId: orgId,
        waPhoneNumberId: pnid,
        wacid,
        fromNumber: '628123456789',
        toNumber: '628987654321',
        defaultQueueId: 'queue_default',
      });

      const preAccept = new PreAcceptCall(callRepo, sdpCache, mockGraphApiClient, mockClock);
      await preAccept.execute({ organizationId: orgId, callId: call.id, sdpAnswer: 'v=0...', agentUserId: 'usr_01' });

      const accept = new AcceptCall(callRepo, sdpCache, mockGraphApiClient, mockClock);
      await accept.execute({ organizationId: orgId, callId: call.id, agentUserId: 'usr_01' });

      const terminate = new TerminateCall(callRepo, mockGraphApiClient, mockClock);
      const terminatedCall = await terminate.execute({
        organizationId: orgId,
        callId: call.id,
        requireWrapUp: true,
        actorType: 'AGENT',
        actorId: 'usr_01',
      });

      expect(terminatedCall.state).toBe('WRAP_UP');
      expect(mockGraphApiClient.terminateCall).toHaveBeenCalledWith({
        phoneNumberId: pnid,
        callId: wacid,
      });
    });
  });
});
