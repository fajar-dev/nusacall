export interface QueueRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  strategy: 'ROUND_ROBIN' | 'LONGEST_IDLE' | 'FEWEST_CALLS';
  timeoutSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSkillAssignment {
  skillId: string;
  proficiencyLevel: number;
}

export interface QueueRepositoryPort {
  create(queue: Omit<QueueRecord, 'createdAt' | 'updatedAt'>): Promise<QueueRecord>;
  findById(organizationId: string, id: string): Promise<QueueRecord | null>;
  listByOrg(organizationId: string): Promise<QueueRecord[]>;
  update(organizationId: string, id: string, patch: Partial<Omit<QueueRecord, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<QueueRecord>;
  delete(organizationId: string, id: string): Promise<boolean>;

  setQueueSkills(queueId: string, skillIds: string[]): Promise<void>;
  getQueueSkillIds(queueId: string): Promise<string[]>;

  setAgentQueues(userId: string, queueIds: string[]): Promise<void>;
  getAgentQueueIds(userId: string): Promise<string[]>;

  setAgentSkills(userId: string, assignments: AgentSkillAssignment[]): Promise<void>;
  getAgentSkills(userId: string): Promise<AgentSkillAssignment[]>;
}
