import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createAgentStateController } from '../src/modules/agent/interface/http/AgentStateController';
import type { AgentStateStorePort, AgentStateRecord, AgentStatusType } from '../src/modules/agent/domain/ports/AgentStateStorePort';
import type { CustomContextVars } from '../src/interface/http/types';

class InMemoryAgentStateStore implements AgentStateStorePort {
  private states = new Map<string, AgentStateRecord>();

  async getAgentState(userId: string): Promise<AgentStateRecord | null> {
    return this.states.get(userId) ?? null;
  }

  async setAgentState(
    userId: string,
    organizationId: string,
    status: AgentStatusType,
    reason?: string
  ): Promise<AgentStateRecord> {
    const record: AgentStateRecord = {
      userId,
      organizationId,
      status,
      ...(reason ? { reason } : {}),
      updatedEpochMs: Date.now(),
    };
    this.states.set(userId, record);
    return record;
  }

  async listOnlineAgents(organizationId: string): Promise<AgentStateRecord[]> {
    return Array.from(this.states.values()).filter(
      (s) => s.organizationId === organizationId && (s.status === 'AVAILABLE' || s.status === 'ONLINE')
    );
  }
}

describe('E5-T6: AgentStateController HTTP Endpoint', () => {
  let store: InMemoryAgentStateStore;
  let app: Hono<{ Variables: CustomContextVars }>;

  beforeEach(() => {
    store = new InMemoryAgentStateStore();
    const controller = createAgentStateController(store);

    app = new Hono<{ Variables: CustomContextVars }>();
    // Mock authentication middleware
    app.use('/me/*', async (c, next) => {
      c.set('auth', {
        userId: 'usr_123',
        organizationId: 'org_123',
        role: 'AGENT',
        permissions: [],
      });
      await next();
    });
    app.route('/me', controller);
  });

  it('should return default OFFLINE state on GET /me/agent-state', async () => {
    const res = await app.request('/me/agent-state', { method: 'GET' });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.status).toBe('OFFLINE');
    expect(json.data.userId).toBe('usr_123');
  });

  it('should update state to AVAILABLE on POST /me/agent-state', async () => {
    const res = await app.request('/me/agent-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'AVAILABLE' }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.status).toBe('AVAILABLE');

    // Verify GET reflects update
    const getRes = await app.request('/me/agent-state', { method: 'GET' });
    const getJson = await getRes.json();
    expect(getJson.data.status).toBe('AVAILABLE');
  });

  it('should update state to BREAK with reason on POST /me/agent-state', async () => {
    const res = await app.request('/me/agent-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'BREAK', reason: 'Lunch' }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.status).toBe('BREAK');
    expect(json.data.reason).toBe('Lunch');
  });

  it('should reject invalid status payload with 400', async () => {
    const res = await app.request('/me/agent-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'INVALID_STATUS' }),
    });
    expect(res.status).toBe(400);
  });
});
