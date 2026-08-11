import { Hono } from 'hono';
import { timingSafeEqual } from 'crypto';
import type { MetaAppRepositoryPort } from '../../domain/ports/MetaAppRepositoryPort';

export function createMetaWebhookRouter(metaAppRepository: MetaAppRepositoryPort): Hono {
  const app = new Hono();

  // GET /webhooks/meta/:metaAppId - Meta Webhook Verification Challenge
  app.get('/meta/:metaAppId', async (c) => {
    const metaAppId = c.req.param('metaAppId');
    const mode = c.req.query('hub.mode');
    const verifyToken = c.req.query('hub.verify_token');
    const challenge = c.req.query('hub.challenge');

    if (!mode || !verifyToken || !challenge) {
      return c.text('Parameter hub missing', 400);
    }

    if (mode !== 'subscribe') {
      return c.text('Invalid hub.mode', 400);
    }

    const metaApp = await metaAppRepository.findById(metaAppId);
    if (!metaApp) {
      return c.text('Meta App tidak ditemukan', 404);
    }

    const storedToken = metaApp.verifyToken;
    const verifyBuf = Buffer.from(verifyToken);
    const storedBuf = Buffer.from(storedToken);

    const tokenMatches =
      verifyBuf.length === storedBuf.length && timingSafeEqual(verifyBuf, storedBuf);

    if (!tokenMatches) {
      return c.text('hub.verify_token tidak valid', 403);
    }

    return c.text(challenge, 200);
  });

  return app;
}
