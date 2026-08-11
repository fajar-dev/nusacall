import { describe, it, expect, vi } from 'vitest';
import { CreateTenancyAndIdentity1754900000000 } from '../src/infrastructure/database/migrations/1754900000000-CreateTenancyAndIdentity';

describe('E1-T1: Migration CreateTenancyAndIdentity', () => {
  it('should execute up queries for tenancy and identity tables', async () => {
    const migration = new CreateTenancyAndIdentity1754900000000();
    const queryRunner = {
      query: vi.fn().mockResolvedValue(undefined),
    };

    await migration.up(queryRunner as any);

    expect(queryRunner.query).toHaveBeenCalledTimes(4);
    const calls = queryRunner.query.mock.calls;
    expect(calls[0]?.[0]).toContain('CREATE TABLE IF NOT EXISTS organizations');
    expect(calls[1]?.[0]).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(calls[2]?.[0]).toContain('CREATE TABLE IF NOT EXISTS refresh_tokens');
    expect(calls[3]?.[0]).toContain('CREATE TABLE IF NOT EXISTS audit_logs');
  });

  it('should execute down queries dropping tables in reverse order', async () => {
    const migration = new CreateTenancyAndIdentity1754900000000();
    const queryRunner = {
      query: vi.fn().mockResolvedValue(undefined),
    };

    await migration.down(queryRunner as any);

    expect(queryRunner.query).toHaveBeenCalledTimes(4);
    const calls = queryRunner.query.mock.calls;
    expect(calls[0]?.[0]).toContain('DROP TABLE IF EXISTS audit_logs');
    expect(calls[1]?.[0]).toContain('DROP TABLE IF EXISTS refresh_tokens');
    expect(calls[2]?.[0]).toContain('DROP TABLE IF EXISTS users');
    expect(calls[3]?.[0]).toContain('DROP TABLE IF EXISTS organizations');
  });
});
