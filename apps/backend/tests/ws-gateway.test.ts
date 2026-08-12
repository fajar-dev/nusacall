import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WsTokenService } from '../src/modules/agent/application/WsTokenService';
import { WsClusterRegistryService } from '../src/modules/agent/application/WsClusterRegistryService';
import { WsGatewayManager } from '../src/modules/agent/application/WsGatewayManager';
import type { WsEnvelope } from '@nusacall/ws-protocol';
import { UnauthenticatedError } from '../src/shared/errors/AppError';

describe('E5-T2 & E5-T4: WS Gateway, Tokens, Cluster PubSub & Message Handlers', () => {
  let redisMemory: Map<string, string>;
  let pubsubSubscriptions: Map<string, Array<(channel: string, message: string) => void>>;
  let mockRedisTokenStore: any;
  let mockPubSub: any;
  let mockAgentStateStore: any;

  const org1 = '01J8ORG0000000000000000001';
  const user1 = '01J8USR0000000000000000001';
  const user2 = '01J8USR0000000000000000002';

  beforeEach(() => {
    redisMemory = new Map();
    pubsubSubscriptions = new Map();

    mockRedisTokenStore = {
      set: vi.fn().mockImplementation(async (key: string, val: string) => redisMemory.set(key, val)),
      get: vi.fn().mockImplementation(async (key: string) => redisMemory.get(key) || null),
      del: vi.fn().mockImplementation(async (key: string) => redisMemory.delete(key)),
    };

    mockPubSub = {
      set: vi.fn().mockImplementation(async (key: string, val: string) => redisMemory.set(key, val)),
      get: vi.fn().mockImplementation(async (key: string) => redisMemory.get(key) || null),
      del: vi.fn().mockImplementation(async (key: string) => redisMemory.delete(key)),
      subscribe: vi.fn().mockImplementation(async (channel: string, cb: any) => {
        const subs = pubsubSubscriptions.get(channel) || [];
        subs.push(cb);
        pubsubSubscriptions.set(channel, subs);
      }),
      publish: vi.fn().mockImplementation(async (channel: string, message: string) => {
        const subs = pubsubSubscriptions.get(channel) || [];
        for (const cb of subs) {
          cb(channel, message);
        }
        return subs.length;
      }),
    };

    mockAgentStateStore = {
      setAgentState: vi.fn().mockResolvedValue({
        userId: user1,
        organizationId: org1,
        status: 'ONLINE',
        reason: 'Ready',
        updatedEpochMs: Date.now(),
      }),
      getAgentState: vi.fn().mockResolvedValue({
        userId: user1,
        organizationId: org1,
        status: 'ONLINE',
        updatedEpochMs: Date.now(),
      }),
      listOnlineAgents: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate one-time short lived token and consume it exactly once', async () => {
    const tokenService = new WsTokenService(mockRedisTokenStore);

    const token = await tokenService.generateOneTimeToken(user1, org1);
    expect(token).toBeDefined();

    const payload = await tokenService.consumeToken(token);
    expect(payload.userId).toBe(user1);
    expect(payload.organizationId).toBe(org1);

    // Second consumption should throw UnauthenticatedError
    await expect(tokenService.consumeToken(token)).rejects.toThrow(UnauthenticatedError);
  });

  it('should handle client.hello and respond with session.ready envelope', async () => {
    const tokenService = new WsTokenService(mockRedisTokenStore);
    const gateway = new WsGatewayManager(tokenService, mockAgentStateStore);

    const sentMessages: string[] = [];
    const mockSocket = {
      send: (msg: string) => sentMessages.push(msg),
      close: vi.fn(),
    };

    const token = await tokenService.generateOneTimeToken(user1, org1);
    await gateway.authenticateAndConnect(token, mockSocket);

    const helloMsg: WsEnvelope = {
      id: 'MSG_01',
      type: 'client.hello',
      ts: Date.now(),
      payload: { appVersion: '1.0.0', userAgent: 'Browser' },
    };

    await gateway.handleIncomingMessage(user1, JSON.stringify(helloMsg));

    expect(sentMessages.length).toBe(1);
    const response = JSON.parse(sentMessages[0]!);
    expect(response.type).toBe('session.ready');
    expect(response.replyTo).toBe('MSG_01');
  });

  it('CRITICAL DoD E5-T2: should deliver message across two instances via Redis Pub/Sub', async () => {
    const tokenService = new WsTokenService(mockRedisTokenStore);

    // Instance 1
    const gateway1 = new WsGatewayManager(tokenService, mockAgentStateStore);
    const cluster1 = new WsClusterRegistryService('INSTANCE_1', mockPubSub, gateway1);
    gateway1.setClusterRegistry(cluster1);

    // Instance 2
    const gateway2 = new WsGatewayManager(tokenService, mockAgentStateStore);
    const cluster2 = new WsClusterRegistryService('INSTANCE_2', mockPubSub, gateway2);
    gateway2.setClusterRegistry(cluster2);

    // Connect user2 to Instance 2
    const instance2SentMessages: string[] = [];
    const mockSocket2 = {
      send: (msg: string) => instance2SentMessages.push(msg),
      close: vi.fn(),
    };

    const token2 = await tokenService.generateOneTimeToken(user2, org1);
    await gateway2.authenticateAndConnect(token2, mockSocket2);

    // Send message to user2 from Instance 1
    const testEnvelope: WsEnvelope = {
      id: 'MSG_CROSS_NODE',
      type: 'notification.new',
      ts: Date.now(),
      payload: { title: 'Test Alert' },
    };

    const delivered = await cluster1.sendToUser(user2, testEnvelope);
    expect(delivered).toBe(true);

    // Message must arrive at user2 connected on Instance 2
    expect(instance2SentMessages.length).toBe(1);
    const received = JSON.parse(instance2SentMessages[0]!);
    expect(received.id).toBe('MSG_CROSS_NODE');
    expect(received.type).toBe('notification.new');
  });

  it('should disconnect client on 2 consecutive missed heartbeat pings', async () => {
    vi.useFakeTimers();
    const tokenService = new WsTokenService(mockRedisTokenStore);
    const gateway = new WsGatewayManager(tokenService, mockAgentStateStore);

    const mockSocket = {
      send: vi.fn(),
      close: vi.fn(),
    };

    const token = await tokenService.generateOneTimeToken(user1, org1);
    await gateway.authenticateAndConnect(token, mockSocket);

    gateway.startHeartbeat(1000);

    // Tick 1 interval: missedPings becomes 1, sends ping
    vi.advanceTimersByTime(1000);
    expect(mockSocket.send).toHaveBeenCalledTimes(1);

    // Tick 2 & 3 interval: missedPings reaches 2 then disconnects
    vi.advanceTimersByTime(2000);
    expect(mockSocket.close).toHaveBeenCalledWith(4001, 'Heartbeat timeout');
    expect(gateway.getConnectionCount()).toBe(0);

    gateway.stopHeartbeat();
    vi.useRealTimers();
  });
});
