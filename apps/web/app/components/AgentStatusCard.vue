<template>
  <div class="agent-status-card">
    <div class="status-header">
      <span class="status-indicator" :class="agentState.status.toLowerCase()" />
      <span class="status-title">{{ $t('agent.statusTitle') || 'Status Agent' }}</span>
      <span class="status-badge" :class="agentState.status.toLowerCase()">
        {{ agentState.status }}
      </span>
    </div>

    <div class="status-controls">
      <div class="btn-group">
        <button
          v-for="st in statuses"
          :key="st"
          class="status-btn"
          :class="{ active: agentState.status === st, [st.toLowerCase()]: true }"
          @click="selectStatus(st)"
        >
          {{ st }}
        </button>
      </div>

      <div v-if="needsReason" class="reason-input-wrapper">
        <input
          v-model="reasonText"
          type="text"
          class="reason-input"
          :placeholder="$t('agent.reasonPlaceholder') || 'Alasan (misal: Sibuk / Wrap Up)...'"
          @keyup.enter="applyState"
        />
        <button class="submit-reason-btn" @click="applyState">
          {{ $t('common.save') || 'Simpan' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useWsStore } from '../stores/ws';
import type { AgentStatus } from '@nusacall/ws-protocol';

const wsStore = useWsStore();
const agentState = computed(() => wsStore.agentState);

const statuses: AgentStatus[] = ['AVAILABLE', 'BUSY', 'WRAP_UP', 'BREAK', 'OFFLINE'];
const selectedStatus = ref<AgentStatus>('AVAILABLE');
const reasonText = ref('');

const needsReason = computed(() => {
  return selectedStatus.value === 'BUSY' || selectedStatus.value === 'WRAP_UP';
});

function selectStatus(status: AgentStatus) {
  selectedStatus.value = status;
  if (status !== 'BUSY' && status !== 'WRAP_UP') {
    reasonText.value = '';
    wsStore.setStatus(status);
  }
}

function applyState() {
  wsStore.setStatus(selectedStatus.value, reasonText.value);
}
</script>

<style scoped>
.agent-status-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.status-indicator.available { background: #10b981; }
.status-indicator.busy { background: #ef4444; }
.status-indicator.wrap_up { background: #f59e0b; }
.status-indicator.break { background: #3b82f6; }
.status-indicator.offline { background: #9ca3af; }

.status-title {
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
  flex: 1;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}
.status-badge.available { background: #d1fae5; color: #065f46; }
.status-badge.busy { background: #fee2e2; color: #991b1b; }
.status-badge.wrap_up { background: #fef3c7; color: #92400e; }
.status-badge.break { background: #dbeafe; color: #1e40af; }
.status-badge.offline { background: #f3f4f6; color: #374151; }

.btn-group {
  display: flex;
  gap: 6px;
}

.status-btn {
  flex: 1;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.status-btn.active.available { background: #10b981; color: #ffffff; border-color: #10b981; }
.status-btn.active.busy { background: #ef4444; color: #ffffff; border-color: #ef4444; }
.status-btn.active.wrap_up { background: #f59e0b; color: #ffffff; border-color: #f59e0b; }
.status-btn.active.offline { background: #6b7280; color: #ffffff; border-color: #6b7280; }

.reason-input-wrapper {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.reason-input {
  flex: 1;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 12px;
}

.submit-reason-btn {
  padding: 6px 12px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
</style>
