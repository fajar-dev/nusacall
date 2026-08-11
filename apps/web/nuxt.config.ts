export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  future: { compatibilityVersion: 4 },
  srcDir: 'app',
  ssr: true,
  typescript: { strict: true, typeCheck: false },
  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@nuxtjs/i18n'],
  css: ['@mantine-vue/core/styles.css', '~/assets/css/app.css'],
  runtimeConfig: {
    public: {
      apiBaseUrl: '', // NUXT_PUBLIC_API_BASE_URL
      wsUrl: '', // NUXT_PUBLIC_WS_URL
      appVersion: '0.1.0',
    },
  },
  i18n: {
    defaultLocale: 'id',
    locales: [
      { code: 'id', file: 'id.json', name: 'Indonesia' },
      { code: 'en', file: 'en.json', name: 'English' },
    ],
    lazy: false,
    langDir: 'i18n/locales',
    strategy: 'no_prefix',
  },
});
