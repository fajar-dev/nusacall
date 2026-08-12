import { describe, it, expect } from 'vitest';
import {
  WsMessageTypeSchema,
  WsEnvelopeSchema,
  parseWsEnvelope,
  ClientHelloPayloadSchema,
  AgentSetStatusPayloadSchema,
  CallOfferPayloadSchema,
  CallAcceptedPayloadSchema,
} from '../src/index';

describe('E5-T3: WS Protocol Envelope & Payload Zod Schemas', () => {
  it('should validate WsMessageType for catalog messages', () => {
    expect(WsMessageTypeSchema.parse('client.hello')).toBe('client.hello');
    expect(WsMessageTypeSchema.parse('call.offer')).toBe('call.offer');
    expect(WsMessageTypeSchema.parse('agent.set_status')).toBe('agent.set_status');
    expect(() => WsMessageTypeSchema.parse('INVALID_MSG')).toThrow();
  });

  it('should parse valid WsEnvelope JSON string', () => {
    const raw = JSON.stringify({
      id: '01J8ENV0000000000000000001',
      type: 'client.hello',
      ts: Date.now(),
      payload: { appVersion: '1.0.0', userAgent: 'NusaCallBrowser/1.0' },
    });

    const parsed = parseWsEnvelope(raw);
    expect(parsed.type).toBe('client.hello');
    expect(parsed.id).toBe('01J8ENV0000000000000000001');
  });

  it('should validate ClientHello and AgentSetStatus payload schemas', () => {
    const hello = ClientHelloPayloadSchema.parse({
      appVersion: '1.0.0',
      userAgent: 'Mozilla/5.0',
    });
    expect(hello.appVersion).toBe('1.0.0');

    const status = AgentSetStatusPayloadSchema.parse({
      status: 'ONLINE',
      reason: 'Available',
    });
    expect(status.status).toBe('ONLINE');
  });

  it('should validate CallOffer and CallAccepted server payload schemas', () => {
    const offer = CallOfferPayloadSchema.parse({
      callId: 'CALL_01',
      wacid: 'WACID_01',
      direction: 'INBOUND',
      sdp: 'v=0...',
      sdpType: 'offer',
      contact: { waId: '628123456789' },
      ringTimeoutSeconds: 30,
      deadlineAt: Date.now() + 30000,
    });
    expect(offer.callId).toBe('CALL_01');

    const accepted = CallAcceptedPayloadSchema.parse({
      callId: 'CALL_01',
      recording: true,
      transcription: false,
    });
    expect(accepted.recording).toBe(true);
  });
});
