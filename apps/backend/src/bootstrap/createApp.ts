import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { errorHandler } from '../interface/http/middleware/errorHandler';
import { registerAuthRoutes } from '../modules/identity/interface/http/authRoutes';
import { AppDataSource } from '../infrastructure/database/data-source';
import { TypeOrmAuthUserRepository } from '../modules/identity/infrastructure/repositories/TypeOrmAuthUserRepository';
import { TypeOrmRefreshTokenRepository } from '../modules/identity/infrastructure/repositories/TypeOrmRefreshTokenRepository';
import { Argon2PasswordHasher } from '../shared/infrastructure/Argon2PasswordHasher';
import { JwtTokenService } from '../shared/infrastructure/JwtTokenService';
import { SystemClock } from '../shared/utils/Clock';
import { AuthService } from '../modules/identity/application/AuthService';

export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.onError(errorHandler);

  app.get('/health/live', (c) => {
    return c.json({ status: 'ok' }, 200);
  });

  const getAuthService = () => {
    const userRepo = new TypeOrmAuthUserRepository(AppDataSource);
    const tokenRepo = new TypeOrmRefreshTokenRepository(AppDataSource);
    const clock = new SystemClock();
    const hasher = new Argon2PasswordHasher();
    const tokenService = new JwtTokenService();
    return new AuthService(userRepo, tokenRepo, clock, hasher, tokenService);
  };

  const getUserRepo = () => new TypeOrmAuthUserRepository(AppDataSource);

  registerAuthRoutes(app, getAuthService, getUserRepo);

  app.doc('/api/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'NusaCall API',
      version: '1.0.0',
      description: 'NusaCall WhatsApp Cloud API Calling Contact Center API',
    },
  });

  app.get(
    '/api/docs',
    apiReference({
      spec: {
        url: '/api/openapi.json',
      },
      pageTitle: 'NusaCall API Docs',
    })
  );

  return app;
}
