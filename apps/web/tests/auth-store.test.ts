import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../app/stores/auth';

describe('E1-T10: Frontend Auth Store & RBAC Permissions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should initialize with empty unauthenticated state', () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.accessToken).toBeNull();
  });

  it('should set authenticated user and token', () => {
    const store = useAuthStore();
    store.setAuth(
      {
        id: 'usr_1',
        email: 'admin@org.com',
        fullName: 'Org Admin',
        role: 'ORGANIZATION_ADMIN',
        organizationId: 'org_1',
        totpEnabled: false,
      },
      'fake_access_token'
    );

    expect(store.isAuthenticated).toBe(true);
    expect(store.user?.email).toBe('admin@org.com');
    expect(store.accessToken).toBe('fake_access_token');
  });

  it('should handle 2FA required state', () => {
    const store = useAuthStore();
    store.setRequiresTotp('usr_1');

    expect(store.requiresTotp).toBe(true);
    expect(store.tempUserId).toBe('usr_1');
    expect(store.isAuthenticated).toBe(false);
  });

  it('should check permissions correctly based on user role', () => {
    const store = useAuthStore();

    store.setAuth(
      {
        id: 'usr_agent',
        email: 'agent@org.com',
        fullName: 'Agent User',
        role: 'AGENT',
        organizationId: 'org_1',
        totpEnabled: false,
      },
      'token_agent'
    );

    expect(store.hasPermission('call:read')).toBe(true);
    expect(store.hasPermission('user:manage')).toBe(false);

    store.setAuth(
      {
        id: 'usr_admin',
        email: 'admin@org.com',
        fullName: 'Admin User',
        role: 'ORGANIZATION_ADMIN',
        organizationId: 'org_1',
        totpEnabled: false,
      },
      'token_admin'
    );

    expect(store.hasPermission('user:manage')).toBe(true);
  });

  it('should reset state on logout', () => {
    const store = useAuthStore();
    store.setAuth(
      {
        id: 'usr_1',
        email: 'admin@org.com',
        fullName: 'Org Admin',
        role: 'ORGANIZATION_ADMIN',
        organizationId: 'org_1',
        totpEnabled: false,
      },
      'token'
    );

    store.logout();
    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
  });
});
