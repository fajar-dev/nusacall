<template>
  <div>
    <h2>{{ $t('common.login') }}</h2>
    <p>{{ $t('common.appName') }} Contact Center</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
});
</script>
