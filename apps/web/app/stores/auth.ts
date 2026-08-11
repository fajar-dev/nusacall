import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface UserState {
  id: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string | null;
  totpEnabled: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserState | null>(null);
  const accessToken = ref<string | null>(null);
  const requiresTotp = ref<boolean>(false);
  const tempUserId = ref<string | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value);
  const userRole = computed(() => user.value?.role || null);

  function setAuth(userData: UserState, token: string) {
    user.value = userData;
    accessToken.value = token;
    requiresTotp.value = false;
    tempUserId.value = null;
  }

  function setRequiresTotp(userId: string) {
    requiresTotp.value = true;
    tempUserId.value = userId;
  }

  function logout() {
    user.value = null;
    accessToken.value = null;
    requiresTotp.value = false;
    tempUserId.value = null;
  }

  function hasPermission(permission: string): boolean {
    if (!user.value) return false;
    const role = user.value.role;
    if (role === 'PLATFORM_OWNER' || role === 'SUPER_ADMIN') return true;
    if (role === 'ORGANIZATION_ADMIN') {
      return ['org:read', 'org:update', 'user:read', 'user:manage', 'agent:manage', 'call:read'].includes(permission);
    }
    if (role === 'AGENT') {
      return ['call:read', 'call:accept', 'call:make'].includes(permission);
    }
    return false;
  }

  return {
    user,
    accessToken,
    requiresTotp,
    tempUserId,
    isAuthenticated,
    userRole,
    setAuth,
    setRequiresTotp,
    logout,
    hasPermission,
  };
});
