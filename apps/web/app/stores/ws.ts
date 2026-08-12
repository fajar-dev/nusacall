import { defineStore } from 'pinia';
import { ref } from 'vue';
import { WsClient } from '../utils/WsClient';
import type { WsEnvelope, AgentStatus } from '@nusacall/ws-protocol';

export const useWsStore = defineStore('ws', () => {
  const isConnected = ref(false);
  const agentState = ref<{ status: AgentStatus; reason?: string }>({ status: 'OFFLINE' });
  const activeCall = ref<Record<string, unknown> | null>(null);
  const lastMessage = ref<WsEnvelope | null>(null);
  let client: WsClient | null = null;

  function init(wsUrl: string, getToken: () => Promise<string>) {
    if (client) client.disconnect();

    client = new WsClient({
      url: wsUrl,
      getToken,
      onConnect: () => {
        isConnected.value = true;
      },
      onDisconnect: () => {
        isConnected.value = false;
      },
      onMessage: (envelope: WsEnvelope) => {
        lastMessage.value = envelope;

        if (envelope.type === 'session.ready') {
          const payload = envelope.payload as Record<string, unknown>;
          if (payload.agentState) {
            agentState.value = payload.agentState as { status: AgentStatus; reason?: string };
          }
          if (payload.activeCall) {
            activeCall.value = payload.activeCall as Record<string, unknown>;
          }
        } else if (envelope.type === 'agent.state_changed') {
          const payload = envelope.payload as Record<string, unknown>;
          agentState.value = {
            status: payload.status as AgentStatus,
            reason: payload.reason as string | undefined,
          };
        }
      },
    });
  }

  async function connect() {
    if (client) {
      await client.connect();
    }
  }

  function disconnect() {
    if (client) {
      client.disconnect();
      isConnected.value = false;
      agentState.value = { status: 'OFFLINE' };
    }
  }

  function setStatus(status: AgentStatus, reason?: string) {
    if (client && isConnected.value) {
      client.send('agent.set_status', { status, reason });
    }
  }

  function sendMessage(type: string, payload: Record<string, unknown>) {
    if (client && isConnected.value) {
      client.send(type, payload);
    }
  }

  return {
    isConnected,
    agentState,
    activeCall,
    lastMessage,
    init,
    connect,
    disconnect,
    setStatus,
    sendMessage,
  };
});
