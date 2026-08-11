import { describe, it, expect } from 'vitest';
import { createApp } from '../src/bootstrap/createApp';
import {
  ValidationError,
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  RateLimitError,
  UpstreamMetaError,
  InternalError,
} from '../src/shared/errors/AppError';

describe('AppError & errorHandler middleware', () => {
  it('should map ValidationError to 400', async () => {
    const app = createApp();
    app.get('/test-400', () => {
      throw new ValidationError('VALIDATION_ERROR', 'Input tidak valid', [{ field: 'email', issue: 'invalid format' }]);
    });

    const res = await app.request('/test-400');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Input tidak valid');
    expect(body.error.details).toEqual([{ field: 'email', issue: 'invalid format' }]);
  });

  it('should map UnauthenticatedError to 401', async () => {
    const app = createApp();
    app.get('/test-401', () => {
      throw new UnauthenticatedError();
    });

    const res = await app.request('/test-401');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should map ForbiddenError to 403', async () => {
    const app = createApp();
    app.get('/test-403', () => {
      throw new ForbiddenError();
    });

    const res = await app.request('/test-403');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('should map NotFoundError to 404', async () => {
    const app = createApp();
    app.get('/test-404', () => {
      throw new NotFoundError();
    });

    const res = await app.request('/test-404');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('should map ConflictError to 409', async () => {
    const app = createApp();
    app.get('/test-409', () => {
      throw new ConflictError();
    });

    const res = await app.request('/test-409');
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('should map BusinessRuleError to 422', async () => {
    const app = createApp();
    app.get('/test-422', () => {
      throw new BusinessRuleError();
    });

    const res = await app.request('/test-422');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('should map RateLimitError to 429 and include Retry-After header', async () => {
    const app = createApp();
    app.get('/test-429', () => {
      throw new RateLimitError('RATE_LIMITED', 'Terlalu banyak request', undefined, 60);
    });

    const res = await app.request('/test-429');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('should map UpstreamMetaError to 502', async () => {
    const app = createApp();
    app.get('/test-502', () => {
      throw new UpstreamMetaError('UPSTREAM_META_ERROR', 'Meta Graph API gagal', { metaCode: 138006 });
    });

    const res = await app.request('/test-502');
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe('UPSTREAM_META_ERROR');
  });

  it('should map InternalError to 500', async () => {
    const app = createApp();
    app.get('/test-500', () => {
      throw new InternalError();
    });

    const res = await app.request('/test-500');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('should map unhandled generic Error to 500 INTERNAL_ERROR', async () => {
    const app = createApp();
    app.get('/test-unhandled', () => {
      throw new Error('Unexpected crash');
    });

    const res = await app.request('/test-unhandled');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
