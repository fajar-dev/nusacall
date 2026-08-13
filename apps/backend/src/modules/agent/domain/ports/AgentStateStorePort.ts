export type AgentStatusType = 'AVAILABLE' | 'ONLINE' | 'RINGING' | 'ON_CALL' | 'WRAP_UP' | 'BREAK' | 'BUSY' | 'OFFLINE';

export interface AgentStateRecord {
  userId: string;
  organizationId: string;
  status: AgentStatusType;
  reason?: string | undefined;
  updatedEpochMs: number;
}

export interface AgentStatusEventRecord {
  id: string;
  organizationId: string;
  userId: string;
  status: AgentStatusType;
  reason?: string | undefined;
}

export interface AgentStateStorePort {
  setAgentState(userId: string, organizationId: string, status: AgentStatusType, reason?: string): Promise<AgentStateRecord>;
  getAgentState(userId: string): Promise<AgentStateRecord | null>;
  listOnlineAgents(organizationId: string): Promise<AgentStateRecord[]>;
}

export interface AgentStatusEventRepositoryPort {
  appendEvent(event: AgentStatusEventRecord): Promise<void>;
}
