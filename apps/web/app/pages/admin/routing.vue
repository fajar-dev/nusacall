<template>
  <div class="routing-page">
    <h1>{{ $t('routing.title') }}</h1>

    <div class="grid-layout">
      <!-- Left side: Rules list -->
      <div class="rules-section">
        <div class="section-header">
          <h2>Aturan Routing Active</h2>
          <button id="btn-add-rule" class="btn-primary" @click="showModal = true">+ Tambah Aturan</button>
        </div>

        <table id="table-routing-rules" class="data-table">
          <thead>
            <tr>
              <th>{{ $t('routing.priority') }}</th>
              <th>{{ $t('routing.field') }}</th>
              <th>{{ $t('routing.operator') }}</th>
              <th>{{ $t('routing.value') }}</th>
              <th>{{ $t('routing.targetQueue') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in rules" :key="rule.id">
              <td>{{ rule.priority }}</td>
              <td>{{ rule.matchField }}</td>
              <td><code>{{ rule.matchOperator }}</code></td>
              <td>{{ rule.matchValue }}</td>
              <td>{{ rule.targetQueueId }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Right side: Simulator -->
      <div class="simulator-section">
        <h2>Simulator Decision Table</h2>
        <form @submit.prevent="runSimulation">
          <div class="form-group">
            <label for="sim-payload">Payload Entry Point</label>
            <input id="sim-payload" v-model="simForm.payload" type="text" placeholder="misal: PROMO_SUMMER" />
          </div>
          <div class="form-group">
            <label for="sim-phone">Nomor Telepon Pemanggil</label>
            <input id="sim-phone" v-model="simForm.phoneNumber" type="text" placeholder="misal: +628123456789" />
          </div>
          <div class="form-group">
            <label for="sim-default-queue">Default Queue (Fallback)</label>
            <input id="sim-default-queue" v-model="simForm.defaultQueueId" required type="text" />
          </div>

          <button id="btn-run-simulation" type="submit" class="btn-secondary">
            {{ $t('routing.simulate') }}
          </button>
        </form>

        <div v-if="simResult" id="sim-results" class="sim-results">
          <h3>Hasil Simulasi:</h3>
          <p><strong>Antrian Tujuan:</strong> <span id="sim-target-queue">{{ simResult.targetQueueId }}</span></p>
          <p><strong>Aturan Terpilih:</strong> <span id="sim-matched-rule">{{ simResult.matchedRuleId || 'Default Queue' }}</span></p>

          <table id="table-sim-logs" class="data-table mini">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Field</th>
                <th>Operator</th>
                <th>Value</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in simResult.evaluationTable" :key="log.ruleId" :class="{ matched: log.matched }">
                <td>{{ log.ruleId }}</td>
                <td>{{ log.matchField }}</td>
                <td>{{ log.matchOperator }}</td>
                <td>{{ log.matchValue }}</td>
                <td>{{ log.matched ? '✅ MATCH' : '❌ SKIP' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface RuleItem {
  id: string;
  priority: number;
  matchField: string;
  matchOperator: string;
  matchValue: string;
  targetQueueId: string;
}

interface SimLog {
  ruleId: string;
  matchField: string;
  matchOperator: string;
  matchValue: string;
  matched: boolean;
}

const showModal = ref(false);
const rules = ref<RuleItem[]>([
  { id: 'R1', priority: 10, matchField: 'contactAttributes.tier', matchOperator: 'EQUALS', matchValue: 'VIP', targetQueueId: 'QUEUE_VIP' },
  { id: 'R2', priority: 20, matchField: 'payload', matchOperator: 'PREFIX', matchValue: 'PROMO_', targetQueueId: 'QUEUE_PROMO' },
]);

const simForm = ref({
  payload: '',
  phoneNumber: '',
  defaultQueueId: 'QUEUE_DEFAULT',
});

const simResult = ref<{
  targetQueueId: string;
  matchedRuleId: string | null;
  evaluationTable: SimLog[];
} | null>(null);

function runSimulation() {
  const logs: SimLog[] = [];
  let matchedTarget: string | null = null;
  let matchedRule: string | null = null;

  for (const r of rules.value) {
    let isMatch = false;
    if (r.matchField === 'payload' && r.matchOperator === 'PREFIX' && simForm.value.payload.startsWith(r.matchValue)) {
      isMatch = true;
    }
    logs.push({
      ruleId: r.id,
      matchField: r.matchField,
      matchOperator: r.matchOperator,
      matchValue: r.matchValue,
      matched: isMatch,
    });
    if (isMatch && !matchedRule) {
      matchedTarget = r.targetQueueId;
      matchedRule = r.id;
    }
  }

  simResult.value = {
    targetQueueId: matchedTarget || simForm.value.defaultQueueId,
    matchedRuleId: matchedRule,
    evaluationTable: logs,
  };
}
</script>

<style scoped>
.routing-page { padding: 1.5rem; }
.grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.btn-primary { background: #2563eb; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
.btn-secondary { background: #059669; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-top: 1rem; }
.data-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
.data-table th, .data-table td { border: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; }
.form-group { margin-bottom: 0.75rem; }
.form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; }
.form-group input { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; }
.sim-results { margin-top: 1.5rem; padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; }
.matched { background-color: #ecfdf5; font-weight: bold; }
</style>
