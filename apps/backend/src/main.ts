import { serve } from '@hono/node-server';
import { createApp } from './bootstrap/createApp';

export type AppRole = 'api' | 'worker' | 'scheduler' | 'all';

export function runServer(port = 3000) {
  const role: AppRole = (process.env.APP_ROLE as AppRole) || 'all';
  const app = createApp();

  if (role === 'api' || role === 'all') {
    return serve({
      fetch: app.fetch,
      port,
    });
  }

  return null;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 3000);
  runServer(port);
}
