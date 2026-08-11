import { createMiddleware } from 'hono/factory';
import { ForbiddenError, UnauthenticatedError } from '../../../shared/errors/AppError';
import type { CustomContextVars } from '../types';

export const tenantMiddleware = createMiddleware<{ Variables: CustomContextVars }>(async (c, next) => {
  const auth = c.get('auth');
  if (!auth) {
    throw new UnauthenticatedError('UNAUTHENTICATED', 'Pengguna belum terautentikasi');
  }

  let organizationId = auth.organizationId;

  if (auth.role === 'PLATFORM_OWNER') {
    const impersonatedOrgId = c.req.header('X-Organization-Id');
    if (impersonatedOrgId) {
      organizationId = impersonatedOrgId;
    }
  }

  if (!organizationId) {
    throw new ForbiddenError('MISSING_TENANT_CONTEXT', 'Konteks organisasi tidak valid atau tidak ditemukan');
  }

  c.set('tenant', { organizationId });

  await next();
});
