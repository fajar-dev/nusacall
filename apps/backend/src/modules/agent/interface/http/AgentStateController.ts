import { Hono } from 'hono';
import { z } from 'zod';
import { AgentStatusSchema } from '@nusacall/contracts';
import type { AgentStateStorePort, AgentStatusType } from '../../domain/ports/AgentStateStorePort';

const setAgentStateSchema = z.object({
  status: AgentStatusSchema,
  reason: z.string().optional(),
});

type AgentStateEnv = {
  Variables: {
    auth?: {
      userId: string;
      organizationId: string | null;
    } | undefined;
  };
};

export function createAgentStateController(agentStateStore: AgentStateStorePort) {
  const app = new Hono<AgentStateEnv>();

  app.post('/agent-state', async (c) => {
    const auth = c.get('auth');
    if (!auth || !auth.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = setAgentStateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid agent state payload', details: parsed.error.format() }, 400);
    }

    const state = await agentStateStore.setAgentState(
      auth.userId,
      auth.organizationId,
      parsed.data.status as AgentStatusType,
      parsed.data.reason
    );
    return c.json({ data: state }, 200);
  });

  app.get('/agent-state', async (c) => {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const state = await agentStateStore.getAgentState(auth.userId);
    if (!state) {
      return c.json({
        data: {
          userId: auth.userId,
          organizationId: auth.organizationId ?? '',
          status: 'OFFLINE',
          updatedEpochMs: Date.now(),
        },
      }, 200);
    }

    return c.json({ data: state }, 200);
  });

  return app;
}
