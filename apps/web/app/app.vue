<template>
  <MantineProvider default-color-scheme="auto">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </MantineProvider>
</template>

<script setup lang="ts">
import { MantineProvider } from '@mantine-vue/core';
</script>
