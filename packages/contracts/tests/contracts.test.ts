import { describe, it, expect } from 'vitest';
import { UserRoleSchema, AgentStatusSchema, PaginationQuerySchema } from '../src/index';

describe('E0-T11: Contracts Zod Schemas', () => {
  it('should validate UserRole', () => {
    expect(UserRoleSchema.parse('AGENT')).toBe('AGENT');
    expect(() => UserRoleSchema.parse('INVALID')).toThrow();
  });

  it('should validate AgentStatus', () => {
    expect(AgentStatusSchema.parse('AVAILABLE')).toBe('AVAILABLE');
    expect(() => AgentStatusSchema.parse('OFFLINE_INVALID')).toThrow();
  });

  it('should apply pagination query defaults', () => {
    const result = PaginationQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});
