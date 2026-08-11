import { describe, it, expect, vi } from 'vitest';
import type { QueryRunner } from 'typeorm';
import { CreateMetaAndWabaSchema1754910000000 } from '../src/infrastructure/database/migrations/1754910000000-CreateMetaAndWabaSchema';

describe('E2-T1: CreateMetaAndWabaSchema Migration', () => {
  it('should run up migration and create tables meta_apps, whatsapp_business_accounts, wa_phone_numbers', async () => {
    const executedQueries: string[] = [];
    const queryRunnerMock = {
      query: vi.fn().mockImplementation(async (query: string) => {
        executedQueries.push(query);
      }),
    } as unknown as QueryRunner;

    const migration = new CreateMetaAndWabaSchema1754910000000();
    await migration.up(queryRunnerMock);

    expect(executedQueries).toHaveLength(3);
    expect(executedQueries[0]).toContain('CREATE TABLE `meta_apps`');
    expect(executedQueries[1]).toContain('CREATE TABLE `whatsapp_business_accounts`');
    expect(executedQueries[2]).toContain('CREATE TABLE `wa_phone_numbers`');
  });

  it('should run down migration and drop tables', async () => {
    const executedQueries: string[] = [];
    const queryRunnerMock = {
      query: vi.fn().mockImplementation(async (query: string) => {
        executedQueries.push(query);
      }),
    } as unknown as QueryRunner;

    const migration = new CreateMetaAndWabaSchema1754910000000();
    await migration.down(queryRunnerMock);

    expect(executedQueries).toHaveLength(3);
    expect(executedQueries[0]).toContain('DROP TABLE IF EXISTS `wa_phone_numbers`');
    expect(executedQueries[1]).toContain('DROP TABLE IF EXISTS `whatsapp_business_accounts`');
    expect(executedQueries[2]).toContain('DROP TABLE IF EXISTS `meta_apps`');
  });
});
