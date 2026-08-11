import { Hono } from 'hono';
import { errorHandler } from '../interface/http/middleware/errorHandler';

export function createApp(): Hono {
  const app = new Hono();

  app.onError(errorHandler);

  app.get('/health/live', (c) => {
    return c.json({ status: 'ok' }, 200);
  });

  return app;
}
