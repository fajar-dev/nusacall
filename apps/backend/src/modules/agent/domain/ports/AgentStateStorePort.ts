export type AgentStatusType = 'ONLINE' | 'BUSY' | 'WRAP_UP' | 'OFFLINE';

export interface AgentStateRecord {
  userId: string;
  organizationId: string;
  status: AgentStatusType;
  reason?: string | undefined;
  updatedEpochMs: number;
}

export interface AgentStateStorePort {
  setAgentState(userId: string, organizationId: string, status: AgentStatusType, reason?: string): Promise<AgentStateRecord>;
  getAgentState(userId: string): Promise<AgentStateRecord | null>;
  listOnlineAgents(organizationId: string): Promise<AgentStateRecord[]>;
}

export interface AgentStatusEventRepositoryPort {
  appendEvent(event: { id: string; organizationId: string; userId: string; status: AgentStatusType; reason?: string | undefined }): Promise<void>;
}
