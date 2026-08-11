export interface CreateAuditLogParams {
  id?: string;
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}

export interface AuditLogData {
  id: string;
  organizationId: string | null;
  userId: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditLogRepository {
  save(params: CreateAuditLogParams): Promise<AuditLogData>;
  findByOrganizationId(organizationId: string, limit?: number): Promise<AuditLogData[]>;
}
