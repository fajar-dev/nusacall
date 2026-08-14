<template>
  <div class="login-container">
    <div class="brand-header">
      <div class="logo-icon">📞</div>
      <h1 class="brand-title">NusaCall</h1>
      <p class="brand-subtitle">WhatsApp Cloud API Calling Contact Center</p>
    </div>

    <form @submit.prevent="handleLogin" class="login-form">
      <div v-if="errorMessage" class="error-alert">
        <span>⚠️ {{ errorMessage }}</span>
      </div>

      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          placeholder="admin@nusacall.com"
          class="input-control"
          :disabled="isLoading"
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <div class="password-input-wrapper">
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            placeholder="••••••••"
            class="input-control"
            :disabled="isLoading"
          />
          <button
            type="button"
            class="toggle-password-btn"
            @click="showPassword = !showPassword"
          >
            {{ showPassword ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>

      <button type="submit" class="submit-btn" :disabled="isLoading">
        <span v-if="isLoading" class="spinner">⏳</span>
        <span>{{ isLoading ? 'Memproses...' : 'Masuk' }}</span>
      </button>

      <div class="quick-seed-section">
        <span class="quick-title">⚡ Klik untuk Isi Cepat (Demo):</span>
        <div class="quick-buttons">
          <button
            type="button"
            class="chip-btn admin-chip"
            @click="fillDemo('admin@nusacall.com')"
          >
            Admin
          </button>
          <button
            type="button"
            class="chip-btn supervisor-chip"
            @click="fillDemo('supervisor@nusacall.com')"
          >
            Supervisor
          </button>
          <button
            type="button"
            class="chip-btn agent-chip"
            @click="fillDemo('agent@nusacall.com')"
          >
            Agent
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRuntimeConfig } from '#imports';
import { useAuthStore } from '~/stores/auth';

definePageMeta({
  layout: 'auth',
});

const config = useRuntimeConfig();
const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');

function fillDemo(demoEmail: string) {
  email.value = demoEmail;
  password.value = 'Password123!';
  errorMessage.value = '';
}

async function handleLogin() {
  errorMessage.value = '';
  isLoading.value = true;

  try {
    const apiBase = config.public.apiBaseUrl || (process.client ? `${window.location.protocol}//${window.location.hostname}:3005` : 'http://127.0.0.1:3005');
    
    const response = await $fetch<{
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        organizationId: string | null;
        email: string;
        fullName: string;
        role: string;
      };
    }>(`${apiBase}/api/v1/auth/login`, {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
      },
    });

    authStore.setAuth(
      {
        id: response.user.id,
        email: response.user.email,
        fullName: response.user.fullName,
        role: response.user.role,
        organizationId: response.user.organizationId,
        totpEnabled: false,
      },
      response.accessToken
    );

    if (process.client) {
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
    }

    if (response.user.role === 'ADMIN' || response.user.role === 'SUPERVISOR') {
      router.push('/admin/users');
    } else {
      router.push('/');
    }
  } catch (err: any) {
    console.error('Login error:', err);
    if (err?.data?.message) {
      errorMessage.value = err.data.message;
    } else if (err?.status === 401) {
      errorMessage.value = 'Email atau password salah.';
    } else {
      errorMessage.value = 'Gagal terhubung ke server. Pastikan backend API berjalan.';
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.brand-header {
  text-align: center;
}

.logo-icon {
  font-size: 2.5rem;
  margin-bottom: 0.25rem;
}

.brand-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.brand-subtitle {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.25rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.error-alert {
  padding: 0.75rem 1rem;
  background-color: #fff0f0;
  border: 1px solid #ffcdd2;
  border-radius: 6px;
  color: #d32f2f;
  font-size: 0.875rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-control {
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-size: 0.95rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-control:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.toggle-password-btn {
  position: absolute;
  right: 0.625rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.25rem;
}

.submit-btn {
  width: 100%;
  padding: 0.75rem;
  background-color: #2563eb;
  color: white;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.quick-seed-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 1rem;
  border-top: 1px dashed #e0e0e0;
}

.quick-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #666;
}

.quick-buttons {
  display: flex;
  gap: 0.5rem;
}

.chip-btn {
  flex: 1;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid #ddd;
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.2s;
}

.chip-btn:hover {
  background: #e9ecef;
}

.admin-chip:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.supervisor-chip:hover {
  border-color: #7c3aed;
  color: #7c3aed;
}

.agent-chip:hover {
  border-color: #059669;
  color: #059669;
}
</style>
