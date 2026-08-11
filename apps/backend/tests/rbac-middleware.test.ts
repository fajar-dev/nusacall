import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { getPermissionsForRole, hasPermission } from '../src/shared/domain/RBAC';
import { JwtTokenService } from '../src/shared/infrastructure/JwtTokenService';
import { authMiddleware } from '../src/interface/http/middlewares/authMiddleware';
import { tenantMiddleware } from '../src/interface/http/middlewares/tenantMiddleware';
import { requirePermission } from '../src/interface/http/middlewares/requirePermission';
import { errorHandler } from '../src/interface/http/middleware/errorHandler';
import type { CustomContextVars } from '../src/interface/http/types';

describe('E1-T4: RBAC Matrix & Auth/Tenant/Permission Middlewares', () => {
  const jwtService = new JwtTokenService();

  function createTestApp() {
    const app = new Hono<{ Variables: CustomContextVars }>();
    app.onError(errorHandler as any);
    return app;
  }

  it('should map roles to permissions correctly according to security spec', () => {
    expect(getPermissionsForRole('PLATFORM_OWNER')).toContain('organization:manage');
    expect(getPermissionsForRole('ORG_ADMIN')).toContain('user:manage');
    expect(getPermissionsForRole('SUPERVISOR')).toContain('agent:supervise');
    expect(getPermissionsForRole('AGENT')).toContain('call:accept');
    expect(getPermissionsForRole('AGENT')).not.toContain('recording:download');
    expect(getPermissionsForRole('VIEWER')).toContain('report:read');
    expect(getPermissionsForRole('VIEWER')).not.toContain('call:accept');

    expect(hasPermission('AGENT', 'call:accept')).toBe(true);
    expect(hasPermission('AGENT', 'user:manage')).toBe(false);
  });

  it('authMiddleware should reject requests without token with 401', async () => {
    const app = createTestApp();
    app.use('/test', authMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');
    expect(res.status).toBe(401);
  });

  it('authMiddleware should authenticate valid token and populate auth context', async () => {
    const app = createTestApp();
    app.use('/test', authMiddleware);
    app.get('/test', (c) => c.json({ auth: c.get('auth') }));

    const token = await jwtService.signAccessToken({
      sub: 'usr_100',
      orgId: 'org_100',
      role: 'ORG_ADMIN',
    });

    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.auth.userId).toBe('usr_100');
    expect(body.auth.organizationId).toBe('org_100');
    expect(body.auth.role).toBe('ORG_ADMIN');
    expect(body.auth.permissions).toContain('user:manage');
  });

  it('tenantMiddleware should enforce tenant context and allow impersonation for PLATFORM_OWNER', async () => {
    const app = createTestApp();
    app.use('/test', authMiddleware, tenantMiddleware);
    app.get('/test', (c) => c.json({ tenant: c.get('tenant') }));

    // Owner impersonating org_impersonated
    const ownerToken = await jwtService.signAccessToken({
      sub: 'owner_1',
      orgId: null,
      role: 'PLATFORM_OWNER',
    });

    const res = await app.request('/test', {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'X-Organization-Id': 'org_impersonated',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenant.organizationId).toBe('org_impersonated');
  });

  it('requirePermission should allow access if permission present, 403 if missing', async () => {
    const app = createTestApp();
    app.use('/admin/*', authMiddleware, requirePermission('user:manage'));
    app.get('/admin/users', (c) => c.json({ ok: true }));

    const agentToken = await jwtService.signAccessToken({
      sub: 'agent_1',
      orgId: 'org_1',
      role: 'AGENT',
    });

    // AGENT lacks 'user:manage' -> 403 Forbidden
    const resForbidden = await app.request('/admin/users', {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    expect(resForbidden.status).toBe(403);

    const adminToken = await jwtService.signAccessToken({
      sub: 'admin_1',
      orgId: 'org_1',
      role: 'ORG_ADMIN',
    });

    // ORG_ADMIN has 'user:manage' -> 200 OK
    const resOk = await app.request('/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(resOk.status).toBe(200);
  });
});
