import type { Permission, Role } from '../../shared/domain/RBAC';

export interface AuthContext {
  userId: string;
  organizationId: string | null;
  role: Role;
  permissions: Permission[];
}

export interface TenantContextVar {
  organizationId: string;
}

export type CustomContextVars = {
  auth: AuthContext;
  tenant: TenantContextVar;
};
