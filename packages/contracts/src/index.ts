import { z } from 'zod';

export const UserRoleSchema = z.enum([
  'PLATFORM_OWNER',
  'ORG_ADMIN',
  'SUPERVISOR',
  'AGENT',
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AgentStatusSchema = z.enum([
  'AVAILABLE',
  'RINGING',
  'ON_CALL',
  'WRAP_UP',
  'BREAK',
  'BUSY',
  'OFFLINE',
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const CallStateSchema = z.enum([
  'INITIATED',
  'RINGING',
  'ACCEPTED',
  'ENDED',
  'FAILED',
]);
export type CallState = z.infer<typeof CallStateSchema>;

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
