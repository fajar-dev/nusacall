<template>
  <div class="queues-page">
    <h1>{{ $t('queues.title') }}</h1>

    <div class="actions">
      <button id="btn-add-queue" class="btn-primary" @click="showModal = true">
        + Tambah Antrian
      </button>
    </div>

    <table id="table-queues" class="data-table">
      <thead>
        <tr>
          <th>{{ $t('queues.name') }}</th>
          <th>{{ $t('queues.strategy') }}</th>
          <th>{{ $t('queues.timeout') }}</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="q in queues" :key="q.id">
          <td>{{ q.name }}</td>
          <td>{{ q.strategy }}</td>
          <td>{{ q.timeoutSeconds }}s</td>
          <td>
            <button :id="'btn-delete-queue-' + q.id" class="btn-danger" @click="deleteQueue(q.id)">
              Hapus
            </button>
          </td>
        </tr>
        <tr v-if="queues.length === 0">
          <td colspan="4" class="empty-state">Belum ada antrian.</td>
        </tr>
      </tbody>
    </table>

    <div v-if="showModal" class="modal-backdrop">
      <div class="modal">
        <h2>Tambah Antrian</h2>
        <form @submit.prevent="createQueue">
          <div class="form-group">
            <label for="queue-name">{{ $t('queues.name') }}</label>
            <input id="queue-name" v-model="form.name" required type="text" />
          </div>
          <div class="form-group">
            <label for="queue-strategy">{{ $t('queues.strategy') }}</label>
            <select id="queue-strategy" v-model="form.strategy">
              <option value="ROUND_ROBIN">ROUND_ROBIN</option>
              <option value="LONGEST_IDLE">LONGEST_IDLE</option>
              <option value="FEWEST_CALLS">FEWEST_CALLS</option>
            </select>
          </div>
          <div class="form-group">
            <label for="queue-timeout">{{ $t('queues.timeout') }}</label>
            <input id="queue-timeout" v-model.number="form.timeoutSeconds" min="10" type="number" />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="showModal = false">Batal</button>
            <button id="btn-submit-queue" type="submit" class="btn-primary">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface QueueItem {
  id: string;
  name: string;
  strategy: string;
  timeoutSeconds: number;
}

const queues = ref<QueueItem[]>([
  { id: '1', name: 'General Queue', strategy: 'ROUND_ROBIN', timeoutSeconds: 300 },
]);

const showModal = ref(false);
const form = ref({
  name: '',
  strategy: 'ROUND_ROBIN',
  timeoutSeconds: 300,
});

function createQueue() {
  if (!form.value.name) return;
  queues.value.push({
    id: String(Date.now()),
    name: form.value.name,
    strategy: form.value.strategy,
    timeoutSeconds: form.value.timeoutSeconds,
  });
  form.value.name = '';
  showModal.value = false;
}

function deleteQueue(id: string) {
  queues.value = queues.value.filter((q) => q.id !== id);
}
</script>

<style scoped>
.queues-page { padding: 1.5rem; }
.actions { margin-bottom: 1rem; }
.btn-primary { background: #2563eb; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
.btn-secondary { background: #e5e7eb; color: #374151; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
.btn-danger { background: #dc2626; color: #fff; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; }
.data-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
.data-table th, .data-table td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
.empty-state { text-align: center; color: #6b7280; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
.modal { background: #fff; padding: 1.5rem; border-radius: 8px; width: 400px; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; }
.form-group input, .form-group select { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
</style>
