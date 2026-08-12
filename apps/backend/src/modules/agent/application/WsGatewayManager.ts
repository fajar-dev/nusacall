import type { WsEnvelope } from '@nusacall/ws-protocol';
import type { AgentStateStorePort, AgentStatusType } from '../domain/ports/AgentStateStorePort';
import type { LocalConnectionHandlerPort, WsClusterRegistryService } from './WsClusterRegistryService';
import type { WsTokenService } from './WsTokenService';
import { ulid } from 'ulid';

export interface MinimalWebSocketConnection {
  userId: string;
  organizationId: string;
  isAlive: boolean;
  missedPings: number;
  bufferedAmount?: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export class WsGatewayManager implements LocalConnectionHandlerPort {
  private readonly connections = new Map<string, MinimalWebSocketConnection>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly maxBufferedBytes = 1024 * 1024; // 1 MB backpressure limit

  constructor(
    private readonly tokenService: WsTokenService,
    private readonly agentStateStore: AgentStateStorePort,
    private clusterRegistry?: WsClusterRegistryService
  ) {}

  setClusterRegistry(clusterRegistry: WsClusterRegistryService): void {
    this.clusterRegistry = clusterRegistry;
  }

  async authenticateAndConnect(
    token: string,
    socket: Omit<MinimalWebSocketConnection, 'userId' | 'organizationId' | 'isAlive' | 'missedPings'>
  ): Promise<MinimalWebSocketConnection> {
    const payload = await this.tokenService.consumeToken(token);

    const wsConn: MinimalWebSocketConnection = {
      ...socket,
      userId: payload.userId,
      organizationId: payload.organizationId,
      isAlive: true,
      missedPings: 0,
    };

    // Close previous connection if exists for same user
    const existing = this.connections.get(payload.userId);
    if (existing) {
      existing.close(4000, 'Tersambung di sesi baru');
    }

    this.connections.set(payload.userId, wsConn);

    if (this.clusterRegistry) {
      await this.clusterRegistry.registerUserLocation(payload.userId);
    }

    return wsConn;
  }

  async disconnect(userId: string): Promise<void> {
    const conn = this.connections.get(userId);
    if (conn) {
      this.connections.delete(userId);
      if (this.clusterRegistry) {
        await this.clusterRegistry.unregisterUserLocation(userId);
      }
      // Update agent state to OFFLINE on disconnect
      await this.agentStateStore.setAgentState(userId, conn.organizationId, 'OFFLINE', 'Disconnected');
    }
  }

  sendToLocalUser(userId: string, envelope: WsEnvelope): boolean {
    const conn = this.connections.get(userId);
    if (!conn) return false;

    // Check backpressure
    if (conn.bufferedAmount && conn.bufferedAmount > this.maxBufferedBytes) {
      conn.close(1008, 'Max backpressure threshold exceeded');
      this.disconnect(userId);
      return false;
    }

    try {
      conn.send(JSON.stringify(envelope));
      return true;
    } catch {
      this.disconnect(userId);
      return false;
    }
  }

  async handleIncomingMessage(userId: string, raw: string): Promise<void> {
    const conn = this.connections.get(userId);
    if (!conn) return;

    let envelope: WsEnvelope;
    try {
      envelope = JSON.parse(raw) as WsEnvelope;
    } catch {
      return;
    }

    // Reset missed pings on any activity
    conn.isAlive = true;
    conn.missedPings = 0;

    switch (envelope.type) {
      case 'ping':
        this.sendToLocalUser(userId, {
          id: ulid(),
          type: 'pong',
          ts: Date.now(),
          replyTo: envelope.id,
          payload: {},
        });
        break;

      case 'pong':
        break;

      case 'client.hello':
      case 'client.resync': {
        const agentState = await this.agentStateStore.getAgentState(userId);
        this.sendToLocalUser(userId, {
          id: ulid(),
          type: 'session.ready',
          ts: Date.now(),
          replyTo: envelope.id,
          payload: {
            user: { userId, organizationId: conn.organizationId },
            agentState: agentState || { status: 'OFFLINE' },
            serverTime: Date.now(),
          },
        });
        break;
      }

      case 'agent.set_status': {
        const statusPayload = envelope.payload as { status: AgentStatusType; reason?: string };
        if (statusPayload && statusPayload.status) {
          const updated = await this.agentStateStore.setAgentState(
            userId,
            conn.organizationId,
            statusPayload.status,
            statusPayload.reason
          );
          this.sendToLocalUser(userId, {
            id: ulid(),
            type: 'agent.state_changed',
            ts: Date.now(),
            replyTo: envelope.id,
            payload: {
              status: updated.status,
              reason: updated.reason,
              since: updated.updatedEpochMs,
            },
          });
        }
        break;
      }
    }
  }

  startHeartbeat(intervalMs = 20000): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      for (const [userId, conn] of this.connections.entries()) {
        if (conn.missedPings >= 2) {
          // Missed 2 consecutive pings -> disconnect
          conn.close(4001, 'Heartbeat timeout');
          this.disconnect(userId);
          continue;
        }

        conn.missedPings += 1;
        this.sendToLocalUser(userId, {
          id: ulid(),
          type: 'ping',
          ts: Date.now(),
          payload: {},
        });
      }
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}
