import { ulid } from 'ulid';
import type { AgentStateRecord, AgentStateStorePort, AgentStatusEventRepositoryPort, AgentStatusType } from '../domain/ports/AgentStateStorePort';
import type { ClockPort } from '../../../shared/ports/ClockPort';
import { ValidationError } from '../../../shared/errors/AppError';

export interface RedisClientLikePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string>;
  keys(pattern: string): Promise<string[]>;
}

export class AgentStateStore implements AgentStateStorePort {
  constructor(
    private readonly redis: RedisClientLikePort,
    private readonly eventRepo: AgentStatusEventRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  async setAgentState(userId: string, organizationId: string, status: AgentStatusType, reason?: string): Promise<AgentStateRecord> {
    if (!userId) throw new ValidationError('userId wajib diisi');
    if (!organizationId) throw new ValidationError('organizationId wajib diisi');
    const validStatuses = ['AVAILABLE', 'ONLINE', 'RINGING', 'ON_CALL', 'WRAP_UP', 'BREAK', 'BUSY', 'OFFLINE'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Status agent tidak valid: ${status}`);
    }

    const record: AgentStateRecord = {
      userId,
      organizationId,
      status,
      ...(reason ? { reason } : {}),
      updatedEpochMs: this.clock.now().getTime(),
    };

    const key = `agent:${userId}`;
    await this.redis.set(key, JSON.stringify(record));

    // Replikasi asinkron ke agent_status_events
    setImmediate(() => {
      this.eventRepo
        .appendEvent({
          id: ulid(),
          organizationId,
          userId,
          status,
          ...(reason ? { reason } : {}),
        })
        .catch(() => {
          // Ignore async logging errors
        });
    });

    return record;
  }

  async getAgentState(userId: string): Promise<AgentStateRecord | null> {
    if (!userId) return null;
    const key = `agent:${userId}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AgentStateRecord;
    } catch {
      return null;
    }
  }

  async listOnlineAgents(organizationId: string): Promise<AgentStateRecord[]> {
    if (!organizationId) return [];
    const keys = await this.redis.keys('agent:*');
    const onlineAgents: AgentStateRecord[] = [];

    for (const key of keys) {
      const raw = await this.redis.get(key);
      if (raw) {
        try {
          const rec = JSON.parse(raw) as AgentStateRecord;
          if (rec.organizationId === organizationId && (rec.status === 'AVAILABLE' || rec.status === 'ONLINE')) {
            onlineAgents.push(rec);
          }
        } catch {
          // Skip corrupt records
        }
      }
    }

    return onlineAgents;
  }
}
