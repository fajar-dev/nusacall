import { z } from 'zod';

export const AgentStatusEnum = z.enum(['AVAILABLE', 'ONLINE', 'RINGING', 'ON_CALL', 'WRAP_UP', 'BREAK', 'BUSY', 'OFFLINE']);
export type AgentStatus = z.infer<typeof AgentStatusEnum>;

export const WsMessageTypeSchema = z.enum([
  // Client -> Server
  'client.hello',
  'client.resync',
  'agent.set_status',
  'call.answer_sdp',
  'call.offer_sdp',
  'call.answer',
  'call.reject',
  'call.hangup',
  'call.ice_state',
  'call.stats',
  'call.media_error',
  'ping',
  'pong',

  // Server -> Client
  'session.ready',
  'agent.state_changed',
  'call.offer',
  'call.request_offer',
  'call.remote_answer',
  'call.pre_accepted',
  'call.accepted',
  'call.ringing',
  'call.rejected',
  'call.ended',
  'call.retracted',
  'call.error',
  'queue.stats',
  'agents.snapshot',
  'notification.new',
  'system.shutdown',

  // Legacy/fallback compatibility
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

export const WsEnvelopeSchema = z.object({
  id: z.string(),
  type: WsMessageTypeSchema,
  ts: z.number(),
  replyTo: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
});
export type WsEnvelope<T = Record<string, unknown>> = Omit<z.infer<typeof WsEnvelopeSchema>, 'payload'> & {
  payload: T;
};

// Client Payload Schemas
export const ClientHelloPayloadSchema = z.object({
  appVersion: z.string(),
  userAgent: z.string(),
  capabilities: z.record(z.unknown()).optional(),
});

export const ClientResyncPayloadSchema = z.object({
  lastEventId: z.string().optional(),
});

export const AgentSetStatusPayloadSchema = z.object({
  status: AgentStatusEnum,
  reason: z.string().optional(),
});

export const CallAnswerSdpPayloadSchema = z.object({
  callId: z.string(),
  sdp: z.string(),
});

export const CallOfferSdpPayloadSchema = z.object({
  callId: z.string(),
  sdp: z.string(),
});

export const CallAnswerPayloadSchema = z.object({
  callId: z.string(),
});

export const CallRejectPayloadSchema = z.object({
  callId: z.string(),
  reason: z.string().optional(),
});

export const CallHangupPayloadSchema = z.object({
  callId: z.string(),
});

export const CallIceStatePayloadSchema = z.object({
  callId: z.string(),
  iceConnectionState: z.string(),
  iceRole: z.string().optional(),
  dtlsRole: z.string().optional(),
});

export const CallStatsPayloadSchema = z.object({
  callId: z.string(),
  rttMs: z.number().optional(),
  jitterMs: z.number().optional(),
  packetLossPct: z.number().optional(),
  audioLevelIn: z.number().optional(),
  audioLevelOut: z.number().optional(),
  mos: z.number().optional(),
});

export const CallMediaErrorPayloadSchema = z.object({
  callId: z.string(),
  code: z.string(),
  message: z.string(),
});

// Server Payload Schemas
export const SessionReadyPayloadSchema = z.object({
  user: z.record(z.unknown()),
  agentState: z.record(z.unknown()),
  activeCall: z.record(z.unknown()).optional(),
  serverTime: z.number(),
});

export const AgentStateChangedPayloadSchema = z.object({
  status: AgentStatusEnum,
  reason: z.string().optional(),
  since: z.number(),
});

export const CallOfferPayloadSchema = z.object({
  callId: z.string(),
  wacid: z.string(),
  direction: z.string(),
  sdp: z.string(),
  sdpType: z.literal('offer'),
  contact: z.record(z.unknown()),
  queue: z.record(z.unknown()).optional(),
  ringTimeoutSeconds: z.number(),
  deadlineAt: z.number(),
  payloadContext: z.string().optional(),
});

export const CallAcceptedPayloadSchema = z.object({
  callId: z.string(),
  recording: z.boolean(),
  transcription: z.boolean(),
});

export const CallEndedPayloadSchema = z.object({
  callId: z.string(),
  endReason: z.string(),
  durationSeconds: z.number(),
  wrapUpSeconds: z.number(),
  requireDisposition: z.boolean(),
});

export function parseWsEnvelope(raw: string): WsEnvelope {
  const json = JSON.parse(raw);
  return WsEnvelopeSchema.parse(json) as WsEnvelope;
}
