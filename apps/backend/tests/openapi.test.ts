import { describe, it, expect } from 'vitest';
import { createApp } from '../src/bootstrap/createApp';

describe('E0-T15: OpenAPI & Scalar Documentation', () => {
  it('should serve openapi.json at /api/openapi.json', async () => {
    const app = createApp();
    const res = await app.request('/api/openapi.json');

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.openapi).toBe('3.0.0');
    expect(json.info.title).toBe('NusaCall API');
  });

  it('should serve Scalar API reference at /api/docs', async () => {
    const app = createApp();
    const res = await app.request('/api/docs');

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('NusaCall API Docs');
  });
});
