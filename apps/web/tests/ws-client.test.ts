import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WsClient } from '../app/utils/WsClient';
import type { WsEnvelope } from '@nusacall/ws-protocol';

describe('E5-T5: WsClient deduplication, reconnect & ping/pong', () => {
  let mockWebSocket: any;
  let listeners: Record<string, Function | undefined>;

  beforeEach(() => {
    listeners = {};
    mockWebSocket = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
      set onopen(fn: Function) {
        listeners.open = fn;
      },
      set onmessage(fn: Function) {
        listeners.message = fn;
      },
      set onclose(fn: Function) {
        listeners.close = fn;
      },
      set onerror(fn: Function) {
        listeners.error = fn;
      },
    };

    const mockWsClass = vi.fn().mockImplementation(() => mockWebSocket);
    (mockWsClass as any).OPEN = 1;
    (mockWsClass as any).CLOSED = 3;

    vi.stubGlobal('WebSocket', mockWsClass);
    vi.stubGlobal('navigator', { userAgent: 'VitestTestAgent' });
  });

  it('should deduplicate incoming messages by ULID id up to 200 items', async () => {
    const receivedEnvelopes: WsEnvelope[] = [];
    const client = new WsClient({
      url: 'ws://localhost/ws',
      getToken: async () => 'mock-token',
      onMessage: (envelope) => receivedEnvelopes.push(envelope),
    });

    await client.connect();
    listeners.open?.();

    const env: WsEnvelope = {
      id: '01J8DUP0000000000000000001',
      type: 'notification.new',
      ts: Date.now(),
      payload: { text: 'Hello' },
    };

    // Dispatch message twice
    listeners.message?.({ data: JSON.stringify(env) });
    listeners.message?.({ data: JSON.stringify(env) });

    expect(receivedEnvelopes.length).toBe(1);
    expect(client.getProcessedIdsCount()).toBe(1);
  });

  it('should auto respond with pong when server sends ping', async () => {
    const client = new WsClient({
      url: 'ws://localhost/ws',
      getToken: async () => 'mock-token',
    });

    await client.connect();
    listeners.open?.();

    const pingEnv: WsEnvelope = {
      id: 'PING_01',
      type: 'ping',
      ts: Date.now(),
      payload: {},
    };

    listeners.message?.({ data: JSON.stringify(pingEnv) });

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"pong"')
    );
  });
});
