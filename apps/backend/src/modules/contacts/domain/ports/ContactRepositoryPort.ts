export interface ContactRecord {
  id: string;
  organizationId: string;
  waId: string;
  phoneNumber: string;
  name: string | null;
  customAttributes: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactRepositoryPort {
  findByWaId(organizationId: string, waId: string): Promise<ContactRecord | null>;
  create(contact: Omit<ContactRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ContactRecord>;
  update(organizationId: string, id: string, patch: Partial<Omit<ContactRecord, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<ContactRecord>;
}
