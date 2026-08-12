import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentStateStore } from '../src/modules/agent/application/AgentStateStore';
import type { AgentStatusEventRepositoryPort } from '../src/modules/agent/domain/ports/AgentStateStorePort';
import type { ClockPort } from '../src/shared/ports/ClockPort';
import { ValidationError } from '../src/shared/errors/AppError';
import { CreateAgentStatusEventsSchema1754940000000 } from '../src/infrastructure/database/migrations/1754940000000-CreateAgentStatusEventsSchema';

describe('E5-T1: AgentStateStore Redis & Async Replication', () => {
  let redisMemory: Map<string, string>;
  let mockRedis: any;
  let mockEventRepo: AgentStatusEventRepositoryPort;
  let mockClock: ClockPort;
  const org1 = '01J8ORG0000000000000000001';
  const user1 = '01J8USR0000000000000000001';

  beforeEach(() => {
    redisMemory = new Map();

    mockRedis = {
      get: vi.fn().mockImplementation(async (key: string) => redisMemory.get(key) || null),
      set: vi.fn().mockImplementation(async (key: string, value: string) => {
        redisMemory.set(key, value);
        return 'OK';
      }),
      keys: vi.fn().mockImplementation(async (pattern: string) => {
        const prefix = pattern.replace('*', '');
        return Array.from(redisMemory.keys()).filter((k) => k.startsWith(prefix));
      }),
    };

    mockEventRepo = {
      appendEvent: vi.fn().mockResolvedValue(undefined),
    };

    mockClock = {
      now: () => new Date('2026-08-12T10:00:00.000Z'),
    };
  });

  it('should set agent state in Redis agent:{userId} and trigger async event append', async () => {
    const store = new AgentStateStore(mockRedis, mockEventRepo, mockClock);

    const record = await store.setAgentState(user1, org1, 'ONLINE', 'Ready for calls');

    expect(record.userId).toBe(user1);
    expect(record.status).toBe('ONLINE');
    expect(record.reason).toBe('Ready for calls');
    expect(record.updatedEpochMs).toBe(new Date('2026-08-12T10:00:00.000Z').getTime());

    const redisVal = await mockRedis.get(`agent:${user1}`);
    expect(redisVal).not.toBeNull();
    expect(JSON.parse(redisVal!).status).toBe('ONLINE');

    // Allow setImmediate event queue to execute
    await new Promise((r) => setTimeout(r, 20));
    expect(mockEventRepo.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: org1,
        userId: user1,
        status: 'ONLINE',
        reason: 'Ready for calls',
      })
    );
  });

  it('should list online agents filtered by organizationId', async () => {
    const store = new AgentStateStore(mockRedis, mockEventRepo, mockClock);
    await store.setAgentState(user1, org1, 'ONLINE');
    await store.setAgentState('01J8USR0000000000000000002', org1, 'BUSY');
    await store.setAgentState('01J8USR0000000000000000003', '01J8ORG0000000000000000002', 'ONLINE');

    const onlineList = await store.listOnlineAgents(org1);
    expect(onlineList.length).toBe(1);
    expect(onlineList[0]!.userId).toBe(user1);
  });

  it('should throw ValidationError for invalid status or missing params', async () => {
    const store = new AgentStateStore(mockRedis, mockEventRepo, mockClock);

    await expect(store.setAgentState('', org1, 'ONLINE')).rejects.toThrow(ValidationError);
    await expect(store.setAgentState(user1, '', 'ONLINE')).rejects.toThrow(ValidationError);
    await expect(store.setAgentState(user1, org1, 'INVALID_STATUS' as any)).rejects.toThrow(ValidationError);
  });

  it('should execute CreateAgentStatusEventsSchema migration up and down queries cleanly', async () => {
    const migration = new CreateAgentStatusEventsSchema1754940000000();
    const queryRunnerMock = {
      query: vi.fn().mockResolvedValue([]),
    } as any;

    await migration.up(queryRunnerMock);
    expect(queryRunnerMock.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE agent_status_events'));

    await migration.down(queryRunnerMock);
    expect(queryRunnerMock.query).toHaveBeenCalledWith(expect.stringContaining('DROP TABLE IF EXISTS agent_status_events'));
  });
});
