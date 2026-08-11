import { describe, it, expect } from 'vitest';
import { WsMessageTypeSchema, BaseWsMessageSchema } from '../src/index';

describe('E0-T11: WS Protocol Zod Schemas', () => {
  it('should validate WsMessageType', () => {
    expect(WsMessageTypeSchema.parse('PING')).toBe('PING');
    expect(() => WsMessageTypeSchema.parse('INVALID_MSG')).toThrow();
  });

  it('should validate BaseWsMessage schema', () => {
    const validMessage = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'PING',
      timestamp: '2026-08-11T10:00:00.000Z',
      payload: {},
    };
    const parsed = BaseWsMessageSchema.parse(validMessage);
    expect(parsed.type).toBe('PING');
  });
});
