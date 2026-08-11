export type Role = 'PLATFORM_OWNER' | 'ORG_ADMIN' | 'SUPERVISOR' | 'AGENT' | 'VIEWER';

export type Permission =
  | 'organization:manage'
  | 'organization:read'
  | 'metaapp:manage'
  | 'phonenumber:read'
  | 'phonenumber:manage'
  | 'user:manage'
  | 'queue:manage'
  | 'queue:read'
  | 'agent:supervise'
  | 'call:accept'
  | 'call:reject'
  | 'call:terminate'
  | 'call:initiate'
  | 'call:read:own'
  | 'call:read:all'
  | 'recording:listen'
  | 'recording:download'
  | 'transcript:read'
  | 'contact:manage'
  | 'permission:request'
  | 'report:read'
  | 'audit:read';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  PLATFORM_OWNER: [
    'organization:manage',
    'organization:read',
    'metaapp:manage',
    'phonenumber:read',
    'phonenumber:manage',
    'user:manage',
    'queue:manage',
    'queue:read',
    'agent:supervise',
    'call:read:all',
    'recording:listen',
    'recording:download',
    'transcript:read',
    'contact:manage',
    'report:read',
    'audit:read',
  ],
  ORG_ADMIN: [
    'organization:read',
    'metaapp:manage',
    'phonenumber:read',
    'phonenumber:manage',
    'user:manage',
    'queue:manage',
    'queue:read',
    'agent:supervise',
    'call:read:all',
    'recording:listen',
    'recording:download',
    'transcript:read',
    'contact:manage',
    'report:read',
    'audit:read',
  ],
  SUPERVISOR: [
    'organization:read',
    'phonenumber:read',
    'queue:read',
    'agent:supervise',
    'call:accept',
    'call:reject',
    'call:terminate',
    'call:initiate',
    'call:read:own',
    'call:read:all',
    'recording:listen',
    'recording:download',
    'transcript:read',
    'contact:manage',
    'permission:request',
    'report:read',
  ],
  AGENT: [
    'queue:read',
    'call:accept',
    'call:reject',
    'call:terminate',
    'call:initiate',
    'call:read:own',
    'contact:manage',
    'permission:request',
  ],
  VIEWER: [
    'organization:read',
    'phonenumber:read',
    'queue:read',
    'call:read:all',
    'transcript:read',
    'report:read',
  ],
};

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: Role, perm: Permission): boolean {
  return getPermissionsForRole(role).includes(perm);
}
