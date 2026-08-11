import { describe, it, expect } from 'vitest';
import { createApp } from '../src/bootstrap/createApp';

describe('GET /health/live', () => {
  it('should return 200 OK with status ok', async () => {
    const app = createApp();
    const res = await app.request('/health/live');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
