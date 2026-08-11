import { describe, it, expect } from 'vitest';
import { CreateWebhookAndOutboxSchema1754920000000 } from '../src/infrastructure/database/migrations/1754920000000-CreateWebhookAndOutboxSchema';

describe('E3-T1: Migration CreateWebhookAndOutbox (webhook_events, domain_events)', () => {
  it('should instantiate migration class cleanly', () => {
    const migration = new CreateWebhookAndOutboxSchema1754920000000();
    expect(migration.name).toBe('CreateWebhookAndOutboxSchema1754920000000');
    expect(typeof migration.up).toBe('function');
    expect(typeof migration.down).toBe('function');
  });
});
