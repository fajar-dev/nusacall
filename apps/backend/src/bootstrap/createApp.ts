import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { errorHandler } from '../interface/http/middleware/errorHandler';

export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.onError(errorHandler);

  app.get('/health/live', (c) => {
    return c.json({ status: 'ok' }, 200);
  });

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
