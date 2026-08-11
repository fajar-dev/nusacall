<template>
  <div class="users-admin-page">
    <h1>Kelola User</h1>
    <p>Manajemen Pengguna Organisasi NusaCall</p>
    <div class="user-list">
      <p>Daftar Pengguna</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports';
import authMiddleware from '../../middleware/auth';
import permissionMiddleware from '../../middleware/permission';

definePageMeta({
  middleware: [authMiddleware, permissionMiddleware],
  requiredPermission: 'user:manage',
});
</script>

<style scoped>
.users-admin-page {
  padding: 24px;
}
</style>
