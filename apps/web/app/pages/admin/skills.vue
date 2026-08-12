<template>
  <div class="skills-page">
    <h1>{{ $t('skills.title') }}</h1>

    <div class="actions">
      <button id="btn-add-skill" class="btn-primary" @click="showModal = true">
        + Tambah Skill
      </button>
    </div>

    <table id="table-skills" class="data-table">
      <thead>
        <tr>
          <th>{{ $t('skills.name') }}</th>
          <th>{{ $t('skills.description') }}</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in skills" :key="s.id">
          <td>{{ s.name }}</td>
          <td>{{ s.description || '-' }}</td>
          <td>
            <button :id="'btn-delete-skill-' + s.id" class="btn-danger" @click="deleteSkill(s.id)">
              Hapus
            </button>
          </td>
        </tr>
        <tr v-if="skills.length === 0">
          <td colspan="3" class="empty-state">Belum ada skill.</td>
        </tr>
      </tbody>
    </table>

    <div v-if="showModal" class="modal-backdrop">
      <div class="modal">
        <h2>Tambah Skill</h2>
        <form @submit.prevent="createSkill">
          <div class="form-group">
            <label for="skill-name">{{ $t('skills.name') }}</label>
            <input id="skill-name" v-model="form.name" required type="text" />
          </div>
          <div class="form-group">
            <label for="skill-description">{{ $t('skills.description') }}</label>
            <input id="skill-description" v-model="form.description" type="text" />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="showModal = false">Batal</button>
            <button id="btn-submit-skill" type="submit" class="btn-primary">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface SkillItem {
  id: string;
  name: string;
  description: string | null;
}

const skills = ref<SkillItem[]>([
  { id: '1', name: 'Bahasa Indonesia', description: 'Agent fluent in ID' },
]);

const showModal = ref(false);
const form = ref({
  name: '',
  description: '',
});

function createSkill() {
  if (!form.value.name) return;
  skills.value.push({
    id: String(Date.now()),
    name: form.value.name,
    description: form.value.description || null,
  });
  form.value.name = '';
  form.value.description = '';
  showModal.value = false;
}

function deleteSkill(id: string) {
  skills.value = skills.value.filter((s) => s.id !== id);
}
</script>

<style scoped>
.skills-page { padding: 1.5rem; }
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
.form-group input { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
</style>
