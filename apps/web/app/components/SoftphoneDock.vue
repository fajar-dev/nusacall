<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useSoftphoneStore } from '../stores/softphone';

const softphone = useSoftphoneStore();

const statusBadgeClass = computed(() => {
  switch (softphone.currentState) {
    case 'RINGING_IN':
    case 'RINGING_OUT':
    case 'DIALING':
      return 'badge-ringing';
    case 'CONNECTING':
    case 'ON_CALL':
      return 'badge-active';
    case 'WRAP_UP':
      return 'badge-wrapup';
    case 'ERROR':
      return 'badge-error';
    default:
      return 'badge-idle';
  }
});

function handleKeyDown(e: KeyboardEvent) {
  if (!e.altKey) return;

  if (e.code === 'KeyA') {
    e.preventDefault();
    if (softphone.currentState === 'RINGING_IN') {
      softphone.answerCall();
    }
  } else if (e.code === 'KeyR') {
    e.preventDefault();
    if (softphone.currentState === 'RINGING_IN') {
      softphone.rejectCall();
    } else if (softphone.currentState === 'ON_CALL') {
      softphone.hangupCall();
    }
  } else if (e.code === 'KeyM') {
    e.preventDefault();
    if (softphone.currentState === 'ON_CALL') {
      softphone.toggleMute();
    }
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown);
  }
});
</script>

<template>
  <div class="softphone-dock" role="region" aria-label="Softphone Controls">
    <div class="dock-header">
      <div class="status-indicator">
        <span class="status-dot" :class="statusBadgeClass"></span>
        <span class="status-title">{{ softphone.currentState }}</span>
      </div>
      <div v-if="softphone.activeCall" class="call-info">
        <span class="call-party">{{ softphone.activeCall.fromNumber }}</span>
      </div>
    </div>

    <!-- State: IDLE -->
    <div v-if="softphone.currentState === 'IDLE'" class="dock-body idle-body">
      <span class="idle-text">{{ $t ? $t('softphone.idle', 'Siap Menerima Panggilan') : 'Siap Menerima Panggilan' }}</span>
    </div>

    <!-- State: RINGING_IN -->
    <div v-else-if="softphone.currentState === 'RINGING_IN'" class="dock-body ringing-body">
      <div class="action-buttons">
        <button class="btn btn-success" aria-label="Jawab Panggilan (Alt+A)" @click="softphone.answerCall()">
          Jawab (Alt+A)
        </button>
        <button class="btn btn-danger" aria-label="Tolak Panggilan (Alt+R)" @click="softphone.rejectCall()">
          Tolak (Alt+R)
        </button>
      </div>
    </div>

    <!-- State: CONNECTING / ON_CALL -->
    <div v-else-if="softphone.currentState === 'CONNECTING' || softphone.currentState === 'ON_CALL'" class="dock-body active-body">
      <div class="action-buttons">
        <button
          class="btn"
          :class="softphone.isMuted ? 'btn-warning' : 'btn-secondary'"
          aria-label="Mute Mikrofon (Alt+M)"
          @click="softphone.toggleMute()"
        >
          {{ softphone.isMuted ? 'Unmute' : 'Mute' }} (Alt+M)
        </button>
        <button
          class="btn"
          :class="softphone.isOnHold ? 'btn-warning' : 'btn-secondary'"
          aria-label="Tahan Panggilan"
          @click="softphone.toggleHold()"
        >
          {{ softphone.isOnHold ? 'Resume' : 'Hold' }}
        </button>
        <button class="btn btn-danger" aria-label="Tutup Panggilan (Alt+R)" @click="softphone.hangupCall()">
          Tutup (Alt+R)
        </button>
      </div>
    </div>

    <!-- State: WRAP_UP -->
    <div v-else-if="softphone.currentState === 'WRAP_UP'" class="dock-body wrapup-body">
      <span class="wrapup-text">Pengisian Disposisi / Wrap Up</span>
      <button class="btn btn-primary" aria-label="Selesai Wrap Up" @click="softphone.finishWrapUp()">
        Selesai Wrap-up
      </button>
    </div>

    <!-- State: ERROR -->
    <div v-else-if="softphone.currentState === 'ERROR'" class="dock-body error-body">
      <span class="error-text">{{ softphone.errorMessage }}</span>
      <button class="btn btn-secondary" aria-label="Tutup Pesan Error" @click="softphone.acknowledgeError()">
        OK
      </button>
    </div>
  </div>
</template>

<style scoped>
.softphone-dock {
  display: flex;
  flex-direction: column;
  background-color: #1e293b;
  color: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
  font-family: inherit;
  width: 100%;
  max-width: 480px;
}

.dock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.badge-idle { background-color: #94a3b8; }
.badge-ringing { background-color: #f59e0b; animation: pulse 1s infinite; }
.badge-active { background-color: #10b981; }
.badge-wrapup { background-color: #3b82f6; }
.badge-error { background-color: #ef4444; }

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.status-title {
  font-weight: 600;
  font-size: 0.875rem;
  letter-spacing: 0.05em;
}

.dock-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.action-buttons {
  display: flex;
  gap: 8px;
  width: 100%;
}

.btn {
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.btn-success { background-color: #10b981; color: #ffffff; }
.btn-success:hover { background-color: #059669; }

.btn-danger { background-color: #ef4444; color: #ffffff; }
.btn-danger:hover { background-color: #dc2626; }

.btn-secondary { background-color: #475569; color: #f8fafc; }
.btn-secondary:hover { background-color: #334155; }

.btn-warning { background-color: #f59e0b; color: #ffffff; }
.btn-warning:hover { background-color: #d97706; }

.btn-primary { background-color: #3b82f6; color: #ffffff; }
.btn-primary:hover { background-color: #2563eb; }

.idle-text, .wrapup-text, .error-text {
  font-size: 0.875rem;
  color: #cbd5e1;
}

.error-text {
  color: #fca5a5;
}
</style>
