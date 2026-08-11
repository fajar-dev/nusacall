import { createMiddleware } from 'hono/factory';
import { UnauthenticatedError } from '../../../shared/errors/AppError';
import { JwtTokenService } from '../../../shared/infrastructure/JwtTokenService';
import { getPermissionsForRole, type Role } from '../../../shared/domain/RBAC';
import type { CustomContextVars } from '../types';

const jwtService = new JwtTokenService();

export const authMiddleware = createMiddleware<{ Variables: CustomContextVars }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/access_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }
  }

  if (!token) {
    throw new UnauthenticatedError('UNAUTHENTICATED', 'Header Authorization atau token tidak ditemukan');
  }

  try {
    const payload = await jwtService.verifyAccessToken(token);
    const role = payload.role as Role;
    const permissions = getPermissionsForRole(role);

    c.set('auth', {
      userId: payload.sub,
      organizationId: payload.orgId,
      role,
      permissions,
    });
  } catch {
    throw new UnauthenticatedError('UNAUTHENTICATED', 'Access token tidak valid atau telah kadaluarsa');
  }

  await next();
});
