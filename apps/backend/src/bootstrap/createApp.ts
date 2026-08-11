import { Hono } from 'hono';

export function createApp(): Hono {
  const app = new Hono();

  app.get('/health/live', (c) => {
    return c.json({ status: 'ok' }, 200);
  });

  return app;
}
