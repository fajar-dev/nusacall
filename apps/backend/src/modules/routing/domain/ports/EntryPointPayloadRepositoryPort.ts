export interface EntryPointPayloadRecord {
  id: string;
  organizationId: string;
  phoneNumberId: string;
  payload: string;
  targetQueueId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntryPointPayloadRepositoryPort {
  create(record: Omit<EntryPointPayloadRecord, 'createdAt' | 'updatedAt'>): Promise<EntryPointPayloadRecord>;
  findById(organizationId: string, id: string): Promise<EntryPointPayloadRecord | null>;
  findByPhoneAndPayload(organizationId: string, phoneNumberId: string, payload: string): Promise<EntryPointPayloadRecord | null>;
  listByOrg(organizationId: string): Promise<EntryPointPayloadRecord[]>;
  update(organizationId: string, id: string, patch: Partial<Omit<EntryPointPayloadRecord, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<EntryPointPayloadRecord>;
  delete(organizationId: string, id: string): Promise<boolean>;
}
