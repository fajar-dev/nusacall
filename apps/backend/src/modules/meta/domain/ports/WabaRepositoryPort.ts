export interface WabaRecord {
  id: string;
  organizationId: string;
  wabaId: string;
  name: string;
  status: string;
}

export interface WabaRepositoryPort {
  findByWabaId(wabaId: string): Promise<WabaRecord | null>;
  updateStatus(wabaId: string, status: string): Promise<void>;
}
