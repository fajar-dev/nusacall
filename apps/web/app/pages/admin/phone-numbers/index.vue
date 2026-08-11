<template>
  <div class="phone-numbers-page">
    <div class="header">
      <h1>{{ $t ? $t('phoneNumbers.title', 'Kelola Nomor WhatsApp') : 'Kelola Nomor WhatsApp' }}</h1>
      <p>Manajemen WABA & Nomor Telepon Cloud API</p>
    </div>

    <!-- Restriction Alert Banner if any number is restricted -->
    <div v-if="hasRestrictedNumbers" class="restriction-banner" data-testid="restriction-banner">
      <div class="alert-icon">⚠️</div>
      <div class="alert-content">
        <strong>Peringatan Pembatasan Meta (ACCOUNT_RESTRICTION)</strong>
        <p>Satu atau lebih nomor telepon Anda sedang dikenai pembatasan oleh Meta. Panggilan keluar diblokir sementara.</p>
      </div>
    </div>

    <div class="phone-number-list" data-testid="phone-number-list">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nomor Telepon</th>
            <th>Phone Number ID</th>
            <th>Status Koneksi</th>
            <th>Status Calling</th>
            <th>Status SIP</th>
            <th>Pembatasan</th>
            <th>Terakhir Disinkronkan</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in phoneNumbers" :key="item.id" :data-testid="`phone-row-${item.id}`">
            <td><strong>{{ item.displayPhoneNumber }}</strong></td>
            <td><code>{{ item.phoneNumberId }}</code></td>
            <td>
              <span :class="['badge', item.connectionStatus === 'HEALTHY' ? 'badge-success' : 'badge-danger']">
                {{ item.connectionStatus }}
              </span>
            </td>
            <td>{{ item.callingStatus }}</td>
            <td>
              <span :class="['badge', item.sipStatus === 'ENABLED' ? 'badge-warning' : 'badge-neutral']">
                SIP: {{ item.sipStatus }}
              </span>
            </td>
            <td>
              <span v-if="item.isRestricted" class="badge badge-danger">RESTRICTED</span>
              <span v-else class="badge badge-success">NORMAL</span>
            </td>
            <td>{{ item.lastSyncedAt || '-' }}</td>
            <td class="actions">
              <button class="btn btn-secondary" @click="testConnection(item.phoneNumberId)" :data-testid="`btn-test-${item.id}`">
                Uji Koneksi
              </button>
              <NuxtLink :to="`/admin/phone-numbers/${item.id}`" class="btn btn-primary" :data-testid="`btn-detail-${item.id}`">
                Edit Jam Operasional
              </NuxtLink>
            </td>
          </tr>
          <tr v-if="phoneNumbers.length === 0">
            <td colspan="8" class="text-center">Belum ada nomor telepon terdaftar.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { definePageMeta } from '#imports';
import authMiddleware from '../../../middleware/auth';
import permissionMiddleware from '../../../middleware/permission';

definePageMeta({
  middleware: [authMiddleware, permissionMiddleware],
  requiredPermission: 'waba:manage',
});

interface PhoneNumberItem {
  id: string;
  displayPhoneNumber: string;
  phoneNumberId: string;
  connectionStatus: 'HEALTHY' | 'UNHEALTHY';
  callingStatus: string;
  sipStatus: 'ENABLED' | 'DISABLED';
  isRestricted: boolean;
  lastSyncedAt: string | null;
}

const phoneNumbers = ref<PhoneNumberItem[]>([
  {
    id: 'pn-1',
    displayPhoneNumber: '+62 812-3456-7890',
    phoneNumberId: '1002764438271669',
    connectionStatus: 'HEALTHY',
    callingStatus: 'ENABLED',
    sipStatus: 'DISABLED',
    isRestricted: false,
    lastSyncedAt: '2026-08-11 12:00',
  },
]);

const hasRestrictedNumbers = computed(() => phoneNumbers.value.some((p) => p.isRestricted));

const testConnection = (phoneNumberId: string) => {
  const item = phoneNumbers.value.find((p) => p.phoneNumberId === phoneNumberId);
  if (item) {
    item.connectionStatus = 'HEALTHY';
    item.lastSyncedAt = new Date().toLocaleString();
  }
};
</script>

<style scoped>
.phone-numbers-page {
  padding: 24px;
}
.header {
  margin-bottom: 20px;
}
.restriction-banner {
  background-color: #fff0f0;
  border: 1px solid #ffcdd2;
  border-radius: 6px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
}
.alert-icon {
  font-size: 24px;
}
.alert-content p {
  margin: 4px 0 0 0;
  color: #c62828;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}
.data-table th, .data-table td {
  border: 1px solid #e0e0e0;
  padding: 12px;
  text-align: left;
}
.data-table th {
  background-color: #f5f5f5;
}
.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.badge-success { background: #e8f5e9; color: #2e7d32; }
.badge-danger { background: #ffebee; color: #c62828; }
.badge-warning { background: #fff3e0; color: #ef6c00; }
.badge-neutral { background: #f5f5f5; color: #616161; }
.actions {
  display: flex;
  gap: 8px;
}
.btn {
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  text-decoration: none;
}
.btn-primary { background: #1976d2; color: #fff; }
.btn-secondary { background: #e0e0e0; color: #333; }
.text-center { text-align: center; }
</style>
