<template>
  <div>
    <h1>{{ $t('common.appName') }}</h1>
    <p>{{ $t('common.welcome') }}</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
});
</script>
