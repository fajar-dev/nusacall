<template>
  <div class="dashboard-container">
    <header class="top-nav">
      <div class="brand">
        <span class="logo">📞</span>
        <span class="brand-name">NusaCall Contact Center</span>
      </div>
      <div class="user-profile" v-if="authStore.user">
        <span class="user-info">{{ authStore.user.fullName }} ({{ authStore.user.role }})</span>
        <button class="logout-btn" @click="handleLogout">Keluar</button>
      </div>
      <div v-else>
        <NuxtLink to="/login" class="login-link">Masuk Ke Akun</NuxtLink>
      </div>
    </header>

    <main class="main-content">
      <div class="hero-card">
        <h2>Selamat datang di NusaCall 👋</h2>
        <p>Platform Contact Center WhatsApp Voice Calling Direct Browser-to-Meta WebRTC.</p>
        
        <div class="status-badge" :class="{ online: authStore.isAuthenticated }">
          <span class="dot"></span>
          <span>Status: {{ authStore.isAuthenticated ? 'Terautentikasi (' + authStore.user?.role + ')' : 'Belum Login' }}</span>
        </div>
      </div>

      <div class="nav-cards-grid">
        <NuxtLink to="/login" class="nav-card">
          <div class="card-icon">🔑</div>
          <h3>Halaman Login</h3>
          <p>Masuk dengan akun Admin, Supervisor, atau Agent demo.</p>
        </NuxtLink>

        <NuxtLink to="/admin/users" class="nav-card">
          <div class="card-icon">👥</div>
          <h3>Manajemen Pengguna</h3>
          <p>Kelola daftar user, peran (RBAC), dan hak akses.</p>
        </NuxtLink>

        <NuxtLink to="/admin/phone-numbers" class="nav-card">
          <div class="card-icon">📱</div>
          <h3>Nomor WhatsApp (WABA)</h3>
          <p>Kelola nomor telepon Meta WABA & jam operasional.</p>
        </NuxtLink>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from '#imports';
import { useAuthStore } from '~/stores/auth';

definePageMeta({
  layout: 'default',
});

const authStore = useAuthStore();
const router = useRouter();

function handleLogout() {
  authStore.logout();
  if (process.client) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
  router.push('/login');
}
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background-color: #f8f9fa;
  display: flex;
  flex-direction: column;
}

.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 1.125rem;
  color: #111827;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
}

.logout-btn {
  padding: 0.375rem 0.75rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.login-link {
  padding: 0.5rem 1rem;
  background-color: #2563eb;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
}

.main-content {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.hero-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.hero-card h2 {
  margin-top: 0;
  color: #111827;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background-color: #fee2e2;
  color: #991b1b;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  margin-top: 1rem;
}

.status-badge.online {
  background-color: #d1fae5;
  color: #065f46;
}

.status-badge .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: currentColor;
}

.nav-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.nav-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, box-shadow 0.2s;
}

.nav-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: #2563eb;
}

.card-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.nav-card h3 {
  margin: 0 0 0.5rem 0;
  color: #111827;
}

.nav-card p {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}
</style>
