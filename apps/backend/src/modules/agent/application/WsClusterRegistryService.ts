import type { WsEnvelope } from '@nusacall/ws-protocol';

export interface RedisPubSubLikePort {
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, callback: (channel: string, message: string) => void): Promise<void>;
  set(key: string, value: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

export interface LocalConnectionHandlerPort {
  sendToLocalUser(userId: string, envelope: WsEnvelope): boolean;
}

export class WsClusterRegistryService {
  constructor(
    public readonly instanceId: string,
    private readonly redis: RedisPubSubLikePort,
    private readonly localHandler: LocalConnectionHandlerPort
  ) {
    // Subscribe ke global WS pub/sub bus
    this.redis.subscribe('ws:bus', (_channel, message) => {
      try {
        const payload = JSON.parse(message) as { targetUserId: string; envelope: WsEnvelope };
        if (payload.targetUserId) {
          this.localHandler.sendToLocalUser(payload.targetUserId, payload.envelope);
        }
      } catch {
        // Ignore unparseable pubsub messages
      }
    });
  }

  async registerUserLocation(userId: string): Promise<void> {
    const key = `ws:user:${userId}`;
    await this.redis.set(key, JSON.stringify({ instanceId: this.instanceId, connectedAt: Date.now() }));
  }

  async unregisterUserLocation(userId: string): Promise<void> {
    const key = `ws:user:${userId}`;
    const raw = await this.redis.get(key);
    if (raw) {
      try {
        const data = JSON.parse(raw) as { instanceId: string };
        if (data.instanceId === this.instanceId) {
          await this.redis.del(key);
        }
      } catch {
        await this.redis.del(key);
      }
    }
  }

  async sendToUser(targetUserId: string, envelope: WsEnvelope): Promise<boolean> {
    // Coba kirim lokal dulu
    const sentLocally = this.localHandler.sendToLocalUser(targetUserId, envelope);
    if (sentLocally) return true;

    // Kalau tidak di koneksi lokal instance ini, kirim via Redis pub/sub ke instance lain
    const pubCount = await this.redis.publish('ws:bus', JSON.stringify({ targetUserId, envelope }));
    return pubCount > 0;
  }
}
