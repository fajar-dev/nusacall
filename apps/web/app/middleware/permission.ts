import { defineNuxtRouteMiddleware, createError } from '#imports';
import { useAuthStore } from '../stores/auth';

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();
  const requiredPermission = to.meta.requiredPermission as string | undefined;

  if (requiredPermission && !authStore.hasPermission(requiredPermission)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman ini.',
    });
  }
});
