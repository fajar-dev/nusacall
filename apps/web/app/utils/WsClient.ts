import type { WsEnvelope, WsMessageType } from '@nusacall/ws-protocol';

export type WsMessageHandler = (envelope: WsEnvelope) => void;

export interface WsClientOptions {
  url: string;
  getToken: () => Promise<string>;
  onMessage?: WsMessageHandler;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (err: Event) => void;
}

export class WsClient {
  private socket: WebSocket | null = null;
  private isIntentionalClose = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly processedIds = new Set<string>();
  private readonly maxProcessedIds = 200;
  private lastEventId: string | null = null;

  constructor(private readonly options: WsClientOptions) {}

  async connect(): Promise<void> {
    this.isIntentionalClose = false;
    try {
      const token = await this.options.getToken();
      const wsUrl = `${this.options.url}?token=${encodeURIComponent(token)}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempt = 0;
        if (this.options.onConnect) this.options.onConnect();

        // After reconnect, send client.resync
        if (this.lastEventId) {
          this.send('client.resync', { lastEventId: this.lastEventId });
        } else {
          this.send('client.hello', { appVersion: '1.0.0', userAgent: navigator.userAgent });
        }
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const envelope = JSON.parse(event.data as string) as WsEnvelope;

          // Deduplication
          if (envelope.id) {
            if (this.processedIds.has(envelope.id)) return;
            this.processedIds.add(envelope.id);
            if (this.processedIds.size > this.maxProcessedIds) {
              const first = this.processedIds.values().next().value;
              if (first) this.processedIds.delete(first);
            }
            this.lastEventId = envelope.id;
          }

          // Handle server ping -> respond with pong
          if (envelope.type === 'ping') {
            this.send('pong', {}, envelope.id);
          }

          if (this.options.onMessage) {
            this.options.onMessage(envelope);
          }
        } catch {
          // Ignore unparseable
        }
      };

      this.socket.onclose = () => {
        if (this.options.onDisconnect) this.options.onDisconnect();
        if (!this.isIntentionalClose) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        if (this.options.onError) this.options.onError(err);
      };
    } catch {
      if (!this.isIntentionalClose) {
        this.scheduleReconnect();
      }
    }
  }

  send(type: string, payload: Record<string, unknown>, replyTo?: string): void {
    if (!this.socket || this.socket.readyState !== (WebSocket.OPEN ?? 1)) return;

    const envelope: WsEnvelope = {
      id: String(Date.now() + Math.random()),
      type: type as WsMessageType,
      ts: Date.now(),
      replyTo,
      payload,
    };

    this.socket.send(JSON.stringify(envelope));
  }

  disconnect(): void {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    // Exponential backoff 1s, 2s, 4s, 8s, 16s, max 30s + jitter
    const backoff = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempt));
    const jitter = Math.floor(Math.random() * 500);
    const delay = backoff + jitter;

    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  getProcessedIdsCount(): number {
    return this.processedIds.size;
  }
}
