import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { AuthService } from '../../application/AuthService';
import type { AuthUserRepository } from '../../domain/ports/AuthUserRepository';

const loginRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'User Login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            password: z.string().min(6),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: z.object({
            accessToken: z.string(),
            refreshToken: z.string(),
            user: z.object({
              id: z.string(),
              organizationId: z.string().nullable(),
              email: z.string(),
              fullName: z.string(),
              role: z.string(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Invalid credentials or inactive user',
    },
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/refresh',
  summary: 'Refresh Access Token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            refreshToken: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Token refreshed',
      content: {
        'application/json': {
          schema: z.object({
            accessToken: z.string(),
            refreshToken: z.string(),
          }),
        },
      },
    },
  },
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/logout',
  summary: 'User Logout',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            refreshToken: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Logout successful',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
  },
});

const meRoute = createRoute({
  method: 'get',
  path: '/api/v1/auth/me',
  summary: 'Get Current User Profile',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'User profile',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            organizationId: z.string().nullable(),
            email: z.string(),
            fullName: z.string(),
            role: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

export function registerAuthRoutes(
  app: OpenAPIHono,
  getAuthService: () => AuthService,
  getUserRepo: () => AuthUserRepository
) {
  app.openapi(loginRoute, async (c) => {
    const { email, password } = c.req.valid('json');
    const userAgent = c.req.header('User-Agent');
    const ip = c.req.header('X-Forwarded-For') || c.req.header('CF-Connecting-IP');
    const authService = getAuthService();
    const result = await authService.login({
      email,
      password,
      ...(userAgent ? { userAgent } : {}),
      ...(ip ? { ip } : {}),
    });
    return c.json(result, 200);
  });

  app.openapi(refreshRoute, async (c) => {
    const { refreshToken } = c.req.valid('json');
    const userAgent = c.req.header('User-Agent');
    const ip = c.req.header('X-Forwarded-For');
    const authService = getAuthService();
    const result = await authService.refresh(refreshToken, userAgent ?? undefined, ip ?? undefined);
    return c.json(result, 200);
  });

  app.openapi(logoutRoute, async (c) => {
    const { refreshToken } = c.req.valid('json');
    const authService = getAuthService();
    await authService.logout(refreshToken);
    return c.json({ success: true }, 200);
  });

  app.openapi(meRoute, async (c) => {
    const auth = (c.var as unknown as { auth?: { userId: string } }).auth;
    if (!auth?.userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const userRepo = getUserRepo();
    const user = await userRepo.findById(auth.userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    const props = user.toProps();
    return c.json(
      {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        fullName: props.fullName,
        role: user.role,
      },
      200
    );
  });
}
