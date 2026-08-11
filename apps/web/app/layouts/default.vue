<template>
  <div class="default-layout">
    <header class="app-header">
      <div class="header-brand">NusaCall</div>
    </header>
    <main class="app-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.default-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-header {
  height: 60px;
  background: var(--nc-color-brand);
  color: white;
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  font-weight: 600;
}
.app-main {
  flex: 1;
  padding: 1.5rem;
}
</style>
