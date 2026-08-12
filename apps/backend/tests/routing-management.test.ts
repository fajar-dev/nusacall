import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutingManagementService } from '../src/modules/routing/application/RoutingManagementService';
import type { SkillRecord, SkillRepositoryPort } from '../src/modules/routing/domain/ports/SkillRepositoryPort';
import type { QueueRecord, QueueRepositoryPort, AgentSkillAssignment } from '../src/modules/routing/domain/ports/QueueRepositoryPort';
import { NotFoundError } from '../src/shared/errors/AppError';

describe('E4-T3: RoutingManagementService (Skills, Queues, Mappings)', () => {
  let skillsStore: SkillRecord[];
  let queuesStore: QueueRecord[];
  let queueSkillsStore: Map<string, string[]>;
  let agentQueuesStore: Map<string, string[]>;
  let agentSkillsStore: Map<string, AgentSkillAssignment[]>;

  let mockSkillRepo: SkillRepositoryPort;
  let mockQueueRepo: QueueRepositoryPort;

  const org1 = '01J8ORG0000000000000000001';
  const org2 = '01J8ORG0000000000000000002';

  beforeEach(() => {
    skillsStore = [];
    queuesStore = [];
    queueSkillsStore = new Map();
    agentQueuesStore = new Map();
    agentSkillsStore = new Map();

    mockSkillRepo = {
      create: vi.fn().mockImplementation(async (data: Partial<SkillRecord>) => {
        const record: SkillRecord = {
          id: data.id || '01J8SKL0000000000000000001',
          organizationId: data.organizationId!,
          name: data.name!,
          description: data.description || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        skillsStore.push(record);
        return record;
      }),
      findById: vi.fn().mockImplementation(async (orgId: string, id: string) => {
        return skillsStore.find((s) => s.organizationId === orgId && s.id === id) || null;
      }),
      listByOrg: vi.fn().mockImplementation(async (orgId: string) => {
        return skillsStore.filter((s) => s.organizationId === orgId);
      }),
      update: vi.fn().mockImplementation(async (orgId: string, id: string, patch: Partial<SkillRecord>) => {
        const idx = skillsStore.findIndex((s) => s.organizationId === orgId && s.id === id);
        if (idx === -1) throw new NotFoundError('Skill tidak ditemukan');
        const updated = { ...skillsStore[idx]!, ...patch, updatedAt: new Date() };
        skillsStore[idx] = updated;
        return updated;
      }),
      delete: vi.fn().mockImplementation(async (orgId: string, id: string) => {
        const idx = skillsStore.findIndex((s) => s.organizationId === orgId && s.id === id);
        if (idx !== -1) {
          skillsStore.splice(idx, 1);
          return true;
        }
        return false;
      }),
    };

    mockQueueRepo = {
      create: vi.fn().mockImplementation(async (data: Partial<QueueRecord>) => {
        const record: QueueRecord = {
          id: data.id || '01J8QUE0000000000000000001',
          organizationId: data.organizationId!,
          name: data.name!,
          description: data.description || null,
          strategy: data.strategy || 'ROUND_ROBIN',
          timeoutSeconds: data.timeoutSeconds || 300,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        queuesStore.push(record);
        return record;
      }),
      findById: vi.fn().mockImplementation(async (orgId: string, id: string) => {
        return queuesStore.find((q) => q.organizationId === orgId && q.id === id) || null;
      }),
      listByOrg: vi.fn().mockImplementation(async (orgId: string) => {
        return queuesStore.filter((q) => q.organizationId === orgId);
      }),
      update: vi.fn().mockImplementation(async (orgId: string, id: string, patch: Partial<QueueRecord>) => {
        const idx = queuesStore.findIndex((q) => q.organizationId === orgId && q.id === id);
        if (idx === -1) throw new NotFoundError('Antrian tidak ditemukan');
        const updated = { ...queuesStore[idx]!, ...patch, updatedAt: new Date() };
        queuesStore[idx] = updated;
        return updated;
      }),
      delete: vi.fn().mockImplementation(async (orgId: string, id: string) => {
        const idx = queuesStore.findIndex((q) => q.organizationId === orgId && q.id === id);
        if (idx !== -1) {
          queuesStore.splice(idx, 1);
          return true;
        }
        return false;
      }),
      setQueueSkills: vi.fn().mockImplementation(async (queueId: string, skillIds: string[]) => {
        queueSkillsStore.set(queueId, skillIds);
      }),
      getQueueSkillIds: vi.fn().mockImplementation(async (queueId: string) => {
        return queueSkillsStore.get(queueId) || [];
      }),
      setAgentQueues: vi.fn().mockImplementation(async (userId: string, queueIds: string[]) => {
        agentQueuesStore.set(userId, queueIds);
      }),
      getAgentQueueIds: vi.fn().mockImplementation(async (userId: string) => {
        return agentQueuesStore.get(userId) || [];
      }),
      setAgentSkills: vi.fn().mockImplementation(async (userId: string, assignments: AgentSkillAssignment[]) => {
        agentSkillsStore.set(userId, assignments);
      }),
      getAgentSkills: vi.fn().mockImplementation(async (userId: string) => {
        return agentSkillsStore.get(userId) || [];
      }),
    };
  });

  describe('Skills CRUD', () => {
    it('should create and list skills scoped by organization', async () => {
      const service = new RoutingManagementService(mockSkillRepo, mockQueueRepo);

      const skill1 = await service.createSkill(org1, 'Bahasa Indonesia', 'Support ID');
      await service.createSkill(org2, 'English', 'Support EN');

      const org1Skills = await service.listSkills(org1);
      expect(org1Skills.length).toBe(1);
      expect(org1Skills[0]!.id).toBe(skill1.id);
    });

    it('should update and delete skill', async () => {
      const service = new RoutingManagementService(mockSkillRepo, mockQueueRepo);
      const skill = await service.createSkill(org1, 'VIP Support');

      const updated = await service.updateSkill(org1, skill.id, { description: 'Prioritas Tinggi' });
      expect(updated.description).toBe('Prioritas Tinggi');

      await service.deleteSkill(org1, skill.id);
      await expect(service.getSkill(org1, skill.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('Queues CRUD', () => {
    it('should create and list queues scoped by organization', async () => {
      const service = new RoutingManagementService(mockSkillRepo, mockQueueRepo);

      const queue = await service.createQueue(org1, 'General Queue', 'ROUND_ROBIN', 300);
      expect(queue.name).toBe('General Queue');

      const queues = await service.listQueues(org1);
      expect(queues.length).toBe(1);
    });
  });

  describe('Mappings (Queue Skills, Agent Queues, Agent Skills)', () => {
    it('should set and get queue skills', async () => {
      const service = new RoutingManagementService(mockSkillRepo, mockQueueRepo);
      const queue = await service.createQueue(org1, 'Sales Queue');
      const skill1 = await service.createSkill(org1, 'Sales');

      await service.assignQueueSkills(org1, queue.id, [skill1.id]);
      const assignedSkills = await service.getQueueSkills(org1, queue.id);
      expect(assignedSkills).toEqual([skill1.id]);
    });

    it('should set and get agent queues and agent skills', async () => {
      const service = new RoutingManagementService(mockSkillRepo, mockQueueRepo);
      const userId = '01J8USR0000000000000000001';

      await service.assignAgentQueues(org1, userId, ['Q1', 'Q2']);
      const agentQueues = await service.getAgentQueues(org1, userId);
      expect(agentQueues).toEqual(['Q1', 'Q2']);

      await service.assignAgentSkills(org1, userId, [{ skillId: 'S1', proficiencyLevel: 5 }]);
      const agentSkills = await service.getAgentSkills(org1, userId);
      expect(agentSkills).toEqual([{ skillId: 'S1', proficiencyLevel: 5 }]);
    });
  });
});
