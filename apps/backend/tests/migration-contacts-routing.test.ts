import { describe, it, expect, vi } from 'vitest';
import type { QueryRunner } from 'typeorm';
import { CreateContactsAndRoutingSchema1754930000000 } from '../src/infrastructure/database/migrations/1754930000000-CreateContactsAndRoutingSchema';

describe('E4-T1: Migration CreateContactsAndRoutingSchema', () => {
  it('should execute up queries to create contacts, skills, queues, and routing tables', async () => {
    const migration = new CreateContactsAndRoutingSchema1754930000000();
    const queryRunner = {
      query: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(8);
    expect(queryRunner.query).toHaveBeenNthCalledWith(1, expect.stringContaining('CREATE TABLE contacts'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(2, expect.stringContaining('CREATE TABLE skills'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(3, expect.stringContaining('CREATE TABLE queues'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(4, expect.stringContaining('CREATE TABLE queue_skills'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(5, expect.stringContaining('CREATE TABLE agent_queues'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(6, expect.stringContaining('CREATE TABLE agent_skills'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(7, expect.stringContaining('CREATE TABLE entry_point_payloads'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(8, expect.stringContaining('CREATE TABLE routing_rules'));
  });

  it('should execute down queries to drop contacts and routing tables in reverse order', async () => {
    const migration = new CreateContactsAndRoutingSchema1754930000000();
    const queryRunner = {
      query: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;

    await migration.down(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(8);
    expect(queryRunner.query).toHaveBeenNthCalledWith(1, expect.stringContaining('DROP TABLE IF EXISTS routing_rules'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(2, expect.stringContaining('DROP TABLE IF EXISTS entry_point_payloads'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(3, expect.stringContaining('DROP TABLE IF EXISTS agent_skills'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(4, expect.stringContaining('DROP TABLE IF EXISTS agent_queues'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(5, expect.stringContaining('DROP TABLE IF EXISTS queue_skills'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(6, expect.stringContaining('DROP TABLE IF EXISTS queues'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(7, expect.stringContaining('DROP TABLE IF EXISTS skills'));
    expect(queryRunner.query).toHaveBeenNthCalledWith(8, expect.stringContaining('DROP TABLE IF EXISTS contacts'));
  });
});
