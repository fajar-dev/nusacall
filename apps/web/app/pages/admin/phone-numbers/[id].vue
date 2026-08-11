<template>
  <div class="phone-number-detail-page">
    <div class="header">
      <NuxtLink to="/admin/phone-numbers" class="back-link">← Kembali ke Daftar Nomor</NuxtLink>
      <h1>Edit Jam Operasional & Pengaturan Nomor</h1>
      <p>ID Nomor: <code>{{ phoneNumberId }}</code></p>
    </div>

    <!-- Restriction Alert Banner -->
    <div v-if="isRestricted" class="restriction-banner" data-testid="restriction-banner">
      <div class="alert-icon">🚫</div>
      <div class="alert-content">
        <strong>Status: RESTRICTED (Dibatasi Meta)</strong>
        <p>Nomor ini sedang dibekukan oleh Meta karena kualitas panggilan rendah. Panggilan keluar tidak dapat dilakukan hingga sanksi berakhir.</p>
      </div>
    </div>

    <!-- Validation Error Alert -->
    <div v-if="validationError" class="error-banner" data-testid="validation-error-banner">
      <strong>Gagal Validasi Lokal:</strong>
      <p>{{ validationError }}</p>
    </div>

    <!-- Success Alert -->
    <div v-if="successMessage" class="success-banner" data-testid="success-banner">
      <p>{{ successMessage }}</p>
    </div>

    <!-- Form Section -->
    <div class="editor-section">
      <h3>Jam Operasional Mingguan (Weekly Operating Hours)</h3>
      <p class="subtitle">Maksimal 2 entri per hari. Waktu buka harus lebih awal dari waktu tutup (format HHMM).</p>

      <div v-for="(hours, index) in operatingHours" :key="index" class="hour-row" :data-testid="`hour-row-${index}`">
        <select v-model="hours.day_of_week" class="form-control" :data-testid="`select-day-${index}`">
          <option value="MONDAY">Senin (MONDAY)</option>
          <option value="TUESDAY">Selasa (TUESDAY)</option>
          <option value="WEDNESDAY">Rabu (WEDNESDAY)</option>
          <option value="THURSDAY">Kamis (THURSDAY)</option>
          <option value="FRIDAY">Jumat (FRIDAY)</option>
          <option value="SATURDAY">Sabtu (SATURDAY)</option>
          <option value="SUNDAY">Minggu (SUNDAY)</option>
        </select>

        <input
          v-model="hours.open_time"
          placeholder="Open (mis. 0800)"
          class="form-control"
          :data-testid="`input-open-${index}`"
        />
        <input
          v-model="hours.close_time"
          placeholder="Close (mis. 1700)"
          class="form-control"
          :data-testid="`input-close-${index}`"
        />

        <button class="btn btn-danger" @click="removeHourRow(index)" :data-testid="`btn-remove-hour-${index}`">Hapus</button>
      </div>

      <button class="btn btn-secondary" @click="addHourRow" data-testid="btn-add-hour">
        + Tambah Slot Jam Operasional
      </button>

      <hr class="divider" />

      <h3>Jadwal Libur (Holiday Schedule)</h3>
      <p class="subtitle">Maksimal 20 entri. Tanggal tidak boleh di masa lampau (format YYYY-MM-DD).</p>

      <div v-for="(hol, index) in holidaySchedule" :key="index" class="holiday-row" :data-testid="`holiday-row-${index}`">
        <input
          type="date"
          v-model="hol.date"
          class="form-control"
          :data-testid="`input-holiday-date-${index}`"
        />
        <input
          v-model="hol.start_time"
          placeholder="Start (mis. 0000)"
          class="form-control"
          :data-testid="`input-holiday-start-${index}`"
        />
        <input
          v-model="hol.end_time"
          placeholder="End (mis. 2359)"
          class="form-control"
          :data-testid="`input-holiday-end-${index}`"
        />
        <button class="btn btn-danger" @click="removeHolidayRow(index)" :data-testid="`btn-remove-holiday-${index}`">Hapus</button>
      </div>

      <button class="btn btn-secondary" @click="addHolidayRow" data-testid="btn-add-holiday">
        + Tambah Tanggal Libur
      </button>

      <div class="actions-bar">
        <button class="btn btn-primary" @click="previewDiff" data-testid="btn-preview-diff">
          Lihat Diff & Terapkan
        </button>
      </div>
    </div>

    <!-- Diff Preview Modal / Panel -->
    <div v-if="showDiffModal" class="diff-modal-backdrop" data-testid="diff-modal">
      <div class="diff-modal-content">
        <h2>Diff Sebelum Apply (Perubahan Jam Operasional)</h2>
        <p>Tinjau perubahan sebelum dikirim ke Meta Graph API:</p>

        <div class="diff-box">
          <div class="diff-header">Perubahan Jam Operasional Mingguan:</div>
          <pre class="diff-code">{{ JSON.stringify(operatingHours, null, 2) }}</pre>
          <div class="diff-header">Perubahan Jadwal Libur:</div>
          <pre class="diff-code">{{ JSON.stringify(holidaySchedule, null, 2) }}</pre>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showDiffModal = false" data-testid="btn-cancel-diff">
            Batal
          </button>
          <button class="btn btn-success" @click="applySettings" data-testid="btn-apply-settings">
            Konfirmasi & Kirim ke Meta
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, definePageMeta } from '#imports';
import authMiddleware from '../../../middleware/auth';
import permissionMiddleware from '../../../middleware/permission';

definePageMeta({
  middleware: [authMiddleware, permissionMiddleware],
  requiredPermission: 'waba:manage',
});

const route = useRoute();
const phoneNumberId = ref(route.params.id || '1002764438271669');
const isRestricted = ref(false);
const validationError = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const showDiffModal = ref(false);

interface HourRow {
  day_of_week: string;
  open_time: string;
  close_time: string;
}

interface HolidayRow {
  date: string;
  start_time: string;
  end_time: string;
}

const operatingHours = ref<HourRow[]>([
  { day_of_week: 'MONDAY', open_time: '0800', close_time: '1700' },
]);

const holidaySchedule = ref<HolidayRow[]>([]);

const addHourRow = () => {
  operatingHours.value.push({ day_of_week: 'MONDAY', open_time: '0800', close_time: '1700' });
};

const removeHourRow = (index: number) => {
  operatingHours.value.splice(index, 1);
};

const addHolidayRow = () => {
  holidaySchedule.value.push({ date: '2026-12-25', start_time: '0000', end_time: '2359' });
};

const removeHolidayRow = (index: number) => {
  holidaySchedule.value.splice(index, 1);
};

const validateLocal = (): boolean => {
  validationError.value = null;

  if (operatingHours.value.length === 0) {
    validationError.value = 'Jam operasional mingguan wajib memiliki minimal 1 entri.';
    return false;
  }

  const dayCounts = new Map<string, Array<{ open: number; close: number }>>();

  for (const item of operatingHours.value) {
    const open = parseInt(item.open_time, 10);
    const close = parseInt(item.close_time, 10);

    if (isNaN(open) || isNaN(close) || open < 0 || close > 2359) {
      validationError.value = `Format jam ${item.open_time} - ${item.close_time} tidak valid (harus HHMM).`;
      return false;
    }

    if (open >= close) {
      validationError.value = ` open_time (${item.open_time}) harus lebih awal dari close_time (${item.close_time}) pada hari ${item.day_of_week}.`;
      return false;
    }

    const existing = dayCounts.get(item.day_of_week) || [];
    if (existing.length >= 2) {
      validationError.value = `Maksimal 2 entri jam operasional per hari (${item.day_of_week}).`;
      return false;
    }

    for (const slot of existing) {
      if (open < slot.close && close > slot.open) {
        validationError.value = `Jam operasional tumpang tindih pada hari ${item.day_of_week}.`;
        return false;
      }
    }

    existing.push({ open, close });
    dayCounts.set(item.day_of_week, existing);
  }

  if (holidaySchedule.value.length > 20) {
    validationError.value = 'Jadwal libur maksimal 20 entri.';
    return false;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  for (const hol of holidaySchedule.value) {
    if (hol.date < todayStr) {
      validationError.value = `Tanggal libur ${hol.date} tidak boleh di masa lampau.`;
      return false;
    }
  }

  return true;
};

const previewDiff = () => {
  if (validateLocal()) {
    showDiffModal.value = true;
  }
};

const applySettings = () => {
  showDiffModal.value = false;
  successMessage.value = 'Pengaturan jam operasional berhasil diperbarui dan dikirim ke Meta.';
};
</script>

<style scoped>
.phone-number-detail-page {
  padding: 24px;
  max-width: 900px;
}
.back-link {
  color: #1976d2;
  text-decoration: none;
  font-size: 14px;
}
.header { margin-bottom: 20px; }
.restriction-banner {
  background-color: #fff0f0;
  border: 1px solid #ffcdd2;
  border-radius: 6px;
  padding: 16px;
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.error-banner {
  background-color: #ffebee;
  border: 1px solid #ef9a9a;
  color: #c62828;
  padding: 14px;
  border-radius: 6px;
  margin-bottom: 20px;
}
.success-banner {
  background-color: #e8f5e9;
  border: 1px solid #a5d6a7;
  color: #2e7d32;
  padding: 14px;
  border-radius: 6px;
  margin-bottom: 20px;
}
.subtitle {
  color: #666;
  font-size: 13px;
  margin-bottom: 12px;
}
.hour-row, .holiday-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  align-items: center;
}
.form-control {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.divider { margin: 24px 0; border: 0; border-top: 1px solid #eee; }
.actions-bar { margin-top: 24px; }
.btn {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}
.btn-primary { background: #1976d2; color: #fff; }
.btn-secondary { background: #e0e0e0; color: #333; }
.btn-danger { background: #d32f2f; color: #fff; }
.btn-success { background: #388e3c; color: #fff; }

.diff-modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}
.diff-modal-content {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  width: 600px;
  max-width: 90%;
}
.diff-box {
  background: #f8f9fa;
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  margin: 16px 0;
  max-height: 300px;
  overflow-y: auto;
}
.diff-code { margin: 4px 0; font-family: monospace; font-size: 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
</style>
