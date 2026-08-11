import { createMiddleware } from 'hono/factory';
import { ForbiddenError, UnauthenticatedError } from '../../../shared/errors/AppError';
import type { Permission } from '../../../shared/domain/RBAC';
import type { CustomContextVars } from '../types';

export const requirePermission = (perm: Permission) =>
  createMiddleware<{ Variables: CustomContextVars }>(async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      throw new UnauthenticatedError('UNAUTHENTICATED', 'Pengguna belum terautentikasi');
    }
    if (!auth.permissions.includes(perm)) {
      throw new ForbiddenError('MISSING_PERMISSION', `Izin '${perm}' diperlukan untuk mengakses fungsi ini`);
    }
    await next();
  });
