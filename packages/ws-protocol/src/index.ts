import { z } from 'zod';

export const WsMessageTypeSchema = z.enum([
  'PING',
  'PONG',
  'AGENT_STATUS_CHANGE',
  'CALL_OFFER',
  'CALL_ACCEPT',
  'CALL_HANGUP',
  'CALL_STATE_UPDATE',
  'ERROR',
]);
export type WsMessageType = z.infer<typeof WsMessageTypeSchema>;

export const BaseWsMessageSchema = z.object({
  id: z.string().uuid(),
  type: WsMessageTypeSchema,
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()),
});
export type BaseWsMessage = z.infer<typeof BaseWsMessageSchema>;
