import { ulid } from 'ulid';
import type { SkillRecord, SkillRepositoryPort } from '../domain/ports/SkillRepositoryPort';
import type { QueueRecord, QueueRepositoryPort, AgentSkillAssignment } from '../domain/ports/QueueRepositoryPort';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class RoutingManagementService {
  constructor(
    private readonly skillRepo: SkillRepositoryPort,
    private readonly queueRepo: QueueRepositoryPort
  ) {}

  async createSkill(organizationId: string, name: string, description?: string): Promise<SkillRecord> {
    if (!organizationId) throw new ValidationError('organizationId wajib diisi');
    if (!name.trim()) throw new ValidationError('Nama skill wajib diisi');

    const newSkill: Omit<SkillRecord, 'createdAt' | 'updatedAt'> = {
      id: ulid(),
      organizationId,
      name: name.trim(),
      description: description || null,
    };
    return await this.skillRepo.create(newSkill);
  }

  async getSkill(organizationId: string, id: string): Promise<SkillRecord> {
    const skill = await this.skillRepo.findById(organizationId, id);
    if (!skill) throw new NotFoundError('Skill tidak ditemukan');
    return skill;
  }

  async listSkills(organizationId: string): Promise<SkillRecord[]> {
    return await this.skillRepo.listByOrg(organizationId);
  }

  async updateSkill(organizationId: string, id: string, patch: { name?: string; description?: string | null }): Promise<SkillRecord> {
    await this.getSkill(organizationId, id);
    return await this.skillRepo.update(organizationId, id, patch);
  }

  async deleteSkill(organizationId: string, id: string): Promise<void> {
    await this.getSkill(organizationId, id);
    await this.skillRepo.delete(organizationId, id);
  }

  async createQueue(
    organizationId: string,
    name: string,
    strategy: 'ROUND_ROBIN' | 'LONGEST_IDLE' | 'FEWEST_CALLS' = 'ROUND_ROBIN',
    timeoutSeconds = 300,
    description?: string
  ): Promise<QueueRecord> {
    if (!organizationId) throw new ValidationError('organizationId wajib diisi');
    if (!name.trim()) throw new ValidationError('Nama antrian wajib diisi');

    const newQueue: Omit<QueueRecord, 'createdAt' | 'updatedAt'> = {
      id: ulid(),
      organizationId,
      name: name.trim(),
      description: description || null,
      strategy,
      timeoutSeconds,
    };
    return await this.queueRepo.create(newQueue);
  }

  async getQueue(organizationId: string, id: string): Promise<QueueRecord> {
    const queue = await this.queueRepo.findById(organizationId, id);
    if (!queue) throw new NotFoundError('Antrian tidak ditemukan');
    return queue;
  }

  async listQueues(organizationId: string): Promise<QueueRecord[]> {
    return await this.queueRepo.listByOrg(organizationId);
  }

  async updateQueue(
    organizationId: string,
    id: string,
    patch: Partial<Omit<QueueRecord, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>
  ): Promise<QueueRecord> {
    await this.getQueue(organizationId, id);
    return await this.queueRepo.update(organizationId, id, patch);
  }

  async deleteQueue(organizationId: string, id: string): Promise<void> {
    await this.getQueue(organizationId, id);
    await this.queueRepo.delete(organizationId, id);
  }

  async assignQueueSkills(organizationId: string, queueId: string, skillIds: string[]): Promise<void> {
    await this.getQueue(organizationId, queueId);
    await this.queueRepo.setQueueSkills(queueId, skillIds);
  }

  async getQueueSkills(organizationId: string, queueId: string): Promise<string[]> {
    await this.getQueue(organizationId, queueId);
    return await this.queueRepo.getQueueSkillIds(queueId);
  }

  async assignAgentQueues(_organizationId: string, userId: string, queueIds: string[]): Promise<void> {
    if (!_organizationId) throw new ValidationError('organizationId wajib diisi');
    await this.queueRepo.setAgentQueues(userId, queueIds);
  }

  async getAgentQueues(_organizationId: string, userId: string): Promise<string[]> {
    if (!_organizationId) throw new ValidationError('organizationId wajib diisi');
    return await this.queueRepo.getAgentQueueIds(userId);
  }

  async assignAgentSkills(_organizationId: string, userId: string, assignments: AgentSkillAssignment[]): Promise<void> {
    if (!_organizationId) throw new ValidationError('organizationId wajib diisi');
    await this.queueRepo.setAgentSkills(userId, assignments);
  }

  async getAgentSkills(_organizationId: string, userId: string): Promise<AgentSkillAssignment[]> {
    if (!_organizationId) throw new ValidationError('organizationId wajib diisi');
    return await this.queueRepo.getAgentSkills(userId);
  }
}
