export interface SkillRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillRepositoryPort {
  create(skill: Omit<SkillRecord, 'createdAt' | 'updatedAt'>): Promise<SkillRecord>;
  findById(organizationId: string, id: string): Promise<SkillRecord | null>;
  listByOrg(organizationId: string): Promise<SkillRecord[]>;
  update(organizationId: string, id: string, patch: Partial<Omit<SkillRecord, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<SkillRecord>;
  delete(organizationId: string, id: string): Promise<boolean>;
}
