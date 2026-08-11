export interface MetaAppRecord {
  id: string;
  appId: string;
  name: string;
  verifyToken: string;
  appSecret: string;
}

export interface MetaAppRepositoryPort {
  findById(id: string): Promise<MetaAppRecord | null>;
}
