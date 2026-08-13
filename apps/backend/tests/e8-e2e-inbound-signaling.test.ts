import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandleInboundCallConnect } from '../src/modules/calling/application/HandleInboundCallConnect';
import { PreAcceptCall } from '../src/modules/calling/application/PreAcceptCall';
import { AcceptCall } from '../src/modules/calling/application/AcceptCall';
import { TerminateCall } from '../src/modules/calling/application/TerminateCall';
import { RedisSdpCache } from '../src/modules/calling/infrastructure/RedisSdpCache';
import { InboundAcdDispatcher } from '../src/modules/routing/application/InboundAcdDispatcher';
import { Call } from '../src/modules/calling/domain/entities/Call';
import type { CallRepositoryPort } from '../src/modules/calling/domain/ports/CallRepositoryPort';
import type { ContactResolverPort, RoutingResolverPort } from '../src/modules/calling/application/HandleInboundCallConnect';
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

  async findStaleCalls(): Promise<Call[]> {
    return [];
  }
}

describe('Epic E8: Full End-to-End Inbound Call Signaling (MILESTONE KRITIS)', () => {
  let callRepo: InMemoryCallRepository;
  let mockContactResolver: ContactResolverPort;
  let mockRoutingResolver: RoutingResolverPort;
  let mockGraphApiClient: GraphApiClientPort;
  let mockClock: ClockPort;
  let mockAgentStateStore: any;
  let mockWsGateway: any;
  let mockAgentQueueRepo: any;
  let redisMemory: Map<string, string>;
  let mockRedis: any;
  let sdpCache: RedisSdpCache;

  const orgId = '01J8ORG0000000000000000001';
  const pnid = '01J8PN0000000000000000001';
  const wacid = 'wacid.ABGG_E8_E2E';
  const agentUserId = 'usr_agent_e8';

  beforeEach(() => {
    callRepo = new InMemoryCallRepository();

    mockContactResolver = {
      resolveFromWebhook: vi.fn().mockResolvedValue({
        id: 'cnt_e8',
        customAttributes: null,
      }),
    };

    mockRoutingResolver = {
      resolveQueue: vi.fn().mockResolvedValue({
        targetQueueId: 'queue_support',
        matchedRuleId: 'rule_01',
      }),
    };

    mockGraphApiClient = {
      preAcceptCall: vi.fn().mockResolvedValue({ success: true }),
      acceptCall: vi.fn().mockResolvedValue({ success: true }),
      terminateCall: vi.fn().mockResolvedValue({ success: true }),
    } as any;

    mockClock = {
      now: () => new Date('2026-08-14T12:00:00.000Z'),
    };

    mockAgentQueueRepo = {
      findAvailableAgentUserIdsInQueue: vi.fn().mockResolvedValue([agentUserId]),
    };

    mockAgentStateStore = {
      getAgentState: vi.fn().mockResolvedValue({ status: 'AVAILABLE' }),
    };

    mockWsGateway = {
      sendToLocalUser: vi.fn().mockReturnValue(true),
    };

    redisMemory = new Map();
    mockRedis = {
      set: vi.fn().mockImplementation(async (key: string, val: string) => {
        redisMemory.set(key, val);
        return 'OK';
      }),
      get: vi.fn().mockImplementation(async (key: string) => {
        return redisMemory.get(key) || null;
      }),
      del: vi.fn().mockImplementation(async (key: string) => {
        const existed = redisMemory.has(key);
        redisMemory.delete(key);
        return existed ? 1 : 0;
      }),
    };

    sdpCache = new RedisSdpCache(mockRedis);
  });

  it('E8 Milestone Test: Full flow (Webhook connect -> ACD offer -> PreAccept -> Accept -> Terminate)', async () => {
    // 1. Webhook connect arrives -> HandleInboundCallConnect
    const handleConnect = new HandleInboundCallConnect(callRepo, mockContactResolver, mockRoutingResolver, mockClock);
    const call = await handleConnect.execute({
      organizationId: orgId,
      waPhoneNumberId: pnid,
      wacid,
      fromNumber: '6281361905133',
      toNumber: '628987654321',
      profileName: 'Pelanggan NusaCall',
      sdpOffer: 'v=0\r\no=meta_offer...',
      defaultQueueId: 'queue_support',
    });

    expect(call.state).toBe('QUEUED');
    expect(call.wacid).toBe(wacid);

    // 2. ACD Dispatcher picks AVAILABLE agent -> sends call.offer over WS -> state: RINGING
    const acd = new InboundAcdDispatcher(callRepo, mockAgentQueueRepo, mockAgentStateStore, mockWsGateway, mockClock);
    const assignedAgent = await acd.dispatchInboundCall(call, 'v=0\r\no=meta_offer...');

    expect(assignedAgent).toBe(agentUserId);
    expect(call.state).toBe('RINGING');
    expect(mockWsGateway.sendToLocalUser).toHaveBeenCalledWith(
      agentUserId,
      expect.objectContaining({ type: 'call.offer' })
    );

    // 3. Agent pre-accepts -> PreAcceptCall (save answer SDP to cache -> Graph API pre_accept)
    const preAccept = new PreAcceptCall(callRepo, sdpCache, mockGraphApiClient, mockClock);
    const preAcceptedCall = await preAccept.execute({
      organizationId: orgId,
      callId: call.id,
      sdpAnswer: 'v=0\r\no=agent_sdp_answer...',
      agentUserId,
    });

    expect(preAcceptedCall.state).toBe('PRE_ACCEPTED');
    expect(mockGraphApiClient.preAcceptCall).toHaveBeenCalledWith({
      phoneNumberId: pnid,
      callId: wacid,
      sdpAnswer: 'v=0\r\no=agent_sdp_answer...',
      bizOpaqueCallbackData: call.id,
    });

    // 4. Agent accepts -> AcceptCall (retrieves IDENTICAL SDP answer from cache -> Graph API accept)
    const accept = new AcceptCall(callRepo, sdpCache, mockGraphApiClient, mockClock);
    const acceptedCall = await accept.execute({
      organizationId: orgId,
      callId: call.id,
      agentUserId,
    });

    expect(acceptedCall.state).toBe('ACCEPTED');
    expect(mockGraphApiClient.acceptCall).toHaveBeenCalledWith({
      phoneNumberId: pnid,
      callId: wacid,
      sdpAnswer: 'v=0\r\no=agent_sdp_answer...',
      bizOpaqueCallbackData: call.id,
    });

    // 5. Call is terminated -> TerminateCall (Graph API terminate)
    const terminate = new TerminateCall(callRepo, mockGraphApiClient, mockClock);
    const terminatedCall = await terminate.execute({
      organizationId: orgId,
      callId: call.id,
      actorType: 'AGENT',
      actorId: agentUserId,
      requireWrapUp: true,
    });

    expect(terminatedCall.state).toBe('WRAP_UP');
    expect(mockGraphApiClient.terminateCall).toHaveBeenCalledWith({
      phoneNumberId: pnid,
      callId: wacid,
    });
  });
});
