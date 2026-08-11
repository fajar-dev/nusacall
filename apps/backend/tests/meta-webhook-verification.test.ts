import { describe, it, expect, vi } from 'vitest';
import { createMetaWebhookRouter } from '../src/modules/meta/interface/http/MetaWebhookController';
import type { MetaAppRecord, MetaAppRepositoryPort } from '../src/modules/meta/domain/ports/MetaAppRepositoryPort';

describe('E3-T2: GET /webhooks/meta/:metaAppId Challenge Verification', () => {
  const sampleApp: MetaAppRecord = {
    id: '01J8METAAPP000000000000001',
    appId: '123456789',
    name: 'Main Meta App',
    verifyToken: 'my_super_secret_verify_token_123',
    appSecret: 'secret',
  };

  const mockRepo: MetaAppRepositoryPort = {
    findById: vi.fn().mockImplementation(async (id: string) => {
      if (id === '01J8METAAPP000000000000001') {
        return sampleApp;
      }
      return null;
    }),
  };

  const app = createMetaWebhookRouter(mockRepo);

  it('should respond with 200 text/plain hub.challenge when verify_token matches', async () => {
    const res = await app.request(
      '/meta/01J8METAAPP000000000000001?hub.mode=subscribe&hub.verify_token=my_super_secret_verify_token_123&hub.challenge=1122334455'
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const body = await res.text();
    expect(body).toBe('1122334455');
  });

  it('should return 403 Forbidden when verify_token does not match', async () => {
    const res = await app.request(
      '/meta/01J8METAAPP000000000000001?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=1122334455'
    );

    expect(res.status).toBe(403);
  });

  it('should return 400 Bad Request when required hub params are missing', async () => {
    const res = await app.request('/meta/01J8METAAPP000000000000001');
    expect(res.status).toBe(400);
  });

  it('should return 404 Not Found when metaAppId does not exist', async () => {
    const res = await app.request(
      '/meta/NON_EXISTENT_APP?hub.mode=subscribe&hub.verify_token=token&hub.challenge=123'
    );
    expect(res.status).toBe(404);
  });

  it('should return 400 Bad Request when hub.mode is not subscribe', async () => {
    const res = await app.request(
      '/meta/01J8METAAPP000000000000001?hub.mode=unsubscribe&hub.verify_token=my_super_secret_verify_token_123&hub.challenge=1122334455'
    );
    expect(res.status).toBe(400);
  });
});
