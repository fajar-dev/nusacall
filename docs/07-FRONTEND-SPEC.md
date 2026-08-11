# 07 — Spesifikasi Frontend (Nuxt 4 + Mantine Vue + Tabler Icons)

---

## 1. Konfigurasi dasar

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  future: { compatibilityVersion: 4 },
  srcDir: 'app',
  ssr: true,
  typescript: { strict: true, typeCheck: true },
  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@nuxtjs/i18n'],
  css: ['@mantine-vue/core/styles.css', '~/assets/css/app.css'],
  runtimeConfig: {
    public: {
      apiBaseUrl: '',      // NUXT_PUBLIC_API_BASE_URL
      wsUrl: '',           // NUXT_PUBLIC_WS_URL
      appVersion: '',
    },
  },
  i18n: {
    defaultLocale: 'id',
    locales: [
      { code: 'id', file: 'id.json', name: 'Indonesia' },
      { code: 'en', file: 'en.json', name: 'English' },
    ],
    strategy: 'no_prefix',
  },
});
```

**Aturan rendering:** halaman publik (login) SSR; seluruh halaman aplikasi (`/app/**`) memakai `definePageMeta({ ssr: false })` karena bergantung pada WebSocket, WebRTC, dan state klien. Halaman agent desk **wajib** client-only.

---

## 2. Struktur route

```
/login                                  layout: auth
/forgot-password, /reset-password       layout: auth

/                                       → redirect sesuai peran

/desk                                   layout: agent   (AGENT, SUPERVISOR)
  /desk                                 Agent Desk (default; softphone + antrian + kontak)
  /desk/calls                           Riwayat panggilan saya
  /desk/callbacks                       Daftar callback saya
  /desk/contacts                        Direktori kontak
  /desk/contacts/:id                    Detail kontak + timeline

/supervise                              layout: default (SUPERVISOR, ORG_ADMIN)
  /supervise/wallboard                  Wallboard real-time
  /supervise/agents                     Monitor agent
  /supervise/queues                     Monitor antrian
  /supervise/calls                      Pencarian panggilan (termasuk pencarian transkrip)
  /supervise/calls/:id                  Detail panggilan: timeline, rekaman, transkrip, ringkasan
  /supervise/reports                    Laporan & ekspor

/admin                                  layout: default (ORG_ADMIN)
  /admin/phone-numbers                  Daftar & pengaturan nomor
  /admin/phone-numbers/:id              Detail nomor: calling settings, jam operasional, restriction
  /admin/queues                         Antrian & routing
  /admin/skills
  /admin/users
  /admin/dispositions
  /admin/entry-points                   Deep link, QR, tombol panggilan, template
  /admin/policies                       Kebijakan rekaman/transkripsi/retensi
  /admin/audit

/platform                               layout: default (PLATFORM_OWNER)
  /platform/organizations
  /platform/meta-apps
  /platform/health
```

---

## 3. Layout

| Layout | Isi |
|---|---|
| `auth` | Kartu terpusat, logo, tanpa navigasi |
| `default` | Sidebar navigasi + header (organisasi aktif, notifikasi, profil) + slot konten |
| `agent` | Sama seperti `default` **plus SoftphoneDock yang selalu tampil** (bawah kanan, dapat diperkecil) dan panel konteks kanan |

`SoftphoneDock` dipasang di layout, **bukan** di halaman, agar panggilan tidak terputus saat berpindah halaman.

---

## 4. Design system

### 4.1 Token

```css
:root {
  --nc-color-brand: #0F7B6C;        /* aksen utama */
  --nc-color-brand-hover: #0C6558;
  --nc-color-danger: #C92A2A;
  --nc-color-warning: #E8590C;
  --nc-color-success: #2B8A3E;
  --nc-color-info: #1971C2;
  --nc-radius: 10px;
  --nc-font: 'Inter', system-ui, -apple-system, sans-serif;
  --nc-font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

Warna status agent (dipakai konsisten di seluruh aplikasi):

| Status | Warna | Ikon Tabler |
|---|---|---|
| `AVAILABLE` | success | `IconCircleCheck` |
| `RINGING` | info (berkedip) | `IconBellRinging` |
| `ON_CALL` | brand | `IconPhoneCall` |
| `WRAP_UP` | warning | `IconClipboardText` |
| `BREAK` | gray | `IconCoffee` |
| `BUSY` | danger | `IconCircleMinus` |
| `OFFLINE` | gray-light | `IconPlugConnectedX` |

### 4.2 Pemakaian Mantine Vue

- Seluruh komponen dasar (Button, TextInput, Select, Modal, Table, Badge, Tabs, Drawer, Notification) berasal dari Mantine Vue. **Dilarang** membuat komponen dasar sendiri dari nol.
- `MantineProvider` dipasang di `app.vue` dengan tema kustom (§4.1) dan `defaultColorScheme: 'auto'`.
- Wrapper tipis di `components/ui/` hanya bila diperlukan untuk konsistensi (mis. `UiPageHeader`, `UiDataTable`, `UiConfirmDialog`, `UiEmptyState`).
- Toast/notifikasi memakai sistem notifikasi Mantine.

### 4.3 Ikon

Hanya dari `@tabler/icons-vue`. Ukuran standar 18 px (inline), 20 px (tombol), 24 px (header). Dilarang memakai emoji sebagai ikon fungsional.

---

## 5. State management (Pinia)

| Store | Isi | Catatan |
|---|---|---|
| `auth` | user, permissions, organisasi aktif | Persist minimal; token di cookie httpOnly |
| `ws` | status koneksi, antrean pesan keluar, deduplikasi id | Satu-satunya pemilik `WsClient` |
| `softphone` | state machine (§6 `06-...`), panggilan aktif, perangkat, mute, statistik | **Satu-satunya** pemilik `PeerConnectionManager` |
| `agent` | status agent, statistik hari ini, antrian yang diikuti | |
| `queues` | statistik antrian real-time | Supervisor |
| `agents` | snapshot agent | Supervisor |
| `notifications` | daftar & jumlah belum dibaca | |
| `ui` | sidebar, tema, preferensi tabel | Persist di localStorage |

Aturan:
- Komponen **tidak boleh** memanggil `fetch`/`$fetch` langsung untuk data domain; gunakan composable `useApi()`/`useApiQuery()`.
- Store tidak boleh mengimpor komponen.
- Semua efek samping WebRTC berada di `softphone` store atau `lib/webrtc`.

---

## 6. Composable utama

| Composable | Kegunaan |
|---|---|
| `useApi()` | Wrapper `$fetch` dengan base URL, kredensial, penanganan 401 (refresh sekali), pemetaan error ke `AppError` frontend |
| `useApiQuery(key, fn, opts)` | Caching + revalidasi ringan (stale-while-revalidate) untuk list |
| `useWs()` | Akses terketik ke store `ws`; `onWsMessage(type, handler)` dengan pembersihan otomatis |
| `useSoftphone()` | API tingkat tinggi: `answer()`, `reject()`, `hangup()`, `toggleMute()`, `dial(contact)` |
| `usePermission()` | `can('call:accept')` untuk kondisi UI |
| `useAudioDevices()` | Enumerasi & persist perangkat pilihan |
| `useCallTimer(startedAt)` | Timer durasi hemat render |
| `useFormatters()` | Format durasi, tanggal (zona waktu organisasi), nomor telepon |

---

## 7. Halaman kunci — spesifikasi detail

### 7.1 Agent Desk (`/desk`)

Tata letak 3 kolom (desktop ≥ 1280 px):

| Kolom | Lebar | Isi |
|---|---|---|
| Kiri | 280 px | Kartu status agent (dropdown status + alasan), statistik hari ini (panggilan, AHT, waktu siap), daftar antrian yang diikuti + jumlah menunggu |
| Tengah | fleksibel | Tab: **Beranda** (callback saya + panggilan terakhir), **Kontak** (pencarian + dial pad), **Riwayat** |
| Kanan | 360 px | Panel konteks: profil kontak panggilan aktif/terakhir, riwayat interaksi, catatan cepat, status izin panggilan |

`SoftphoneDock` (mengambang, 360×auto):
- **IDLE:** tombol "Panggilan baru", indikator status koneksi.
- **RINGING_IN:** nama & nomor penelepon, nama antrian, waktu tunggu, hitung mundur besar, tombol **Jawab** (hijau, juga bisa via `Enter`) & **Tolak** (`Esc`), badge asal (`Deep Link`, `Tombol CTA`, dsb.).
- **ON_CALL:** timer, tombol mute (`M`), tutup (`Ctrl+Shift+H`), pilih perangkat, indikator kualitas (3 batang + tooltip RTT/jitter/loss), badge "Sedang direkam" bila aktif.
- **WRAP_UP:** hitung mundur, `select` disposisi (bertingkat), textarea catatan, input tag, tombol **Selesai**.

Aturan aksesibilitas: seluruh tombol memiliki `aria-label`, hitung mundur diumumkan lewat `aria-live="polite"`, fokus otomatis ke tombol Jawab saat panggilan masuk.

### 7.2 Wallboard (`/supervise/wallboard`)

- Baris kartu metrik: Panggilan Aktif, Dalam Antrian, Tunggu Terlama, Agent Siap, Answer Rate Hari Ini, Abandon Rate.
- Tabel antrian: nama, menunggu, tunggu terlama (berubah merah > SLA), agent siap, agent on-call.
- Grid agent: kartu per agent dengan warna status, durasi status, panggilan aktif.
- Mode layar penuh (untuk TV) dengan tipografi diperbesar, tanpa navigasi.
- Sumber data: `queue.stats` & `agents.snapshot` via WebSocket; fallback polling 10 detik bila WS terputus.

### 7.3 Detail panggilan (`/supervise/calls/:id`)

- Header: arah, nomor, kontak, agent, antrian, durasi, disposisi, badge rekaman/transkrip.
- Tab **Linimasa**: `call_events` berurutan dengan ikon & waktu relatif.
- Tab **Rekaman**: `wavesurfer.js`, kontrol kecepatan (0.75×–2×), unduh (dicatat audit).
- Tab **Transkrip**: daftar segmen dua warna (`Business` kiri, `Customer` kanan), timestamp klik-untuk-lompat, penyorotan kata pencarian, tombol salin.
- Tab **Ringkasan AI** (bila aktif): ringkasan, sentimen, topik, action item.
- Tab **Kualitas**: grafik RTT/jitter/loss/MOS sepanjang panggilan (ECharts).

### 7.4 Pengaturan nomor (`/admin/phone-numbers/:id`)

- Banner status koneksi & pembatasan aktif (bila ada) beserta hitung mundur kedaluwarsa.
- Section **Calling**: toggle aktif, visibilitas ikon (dengan penjelasan efek `DISABLE_ALL`), pembatasan negara (multi-select), callback permission.
- Section **Jam operasional**: editor per hari (maksimum 2 rentang), pemilih zona waktu, tabel hari libur dengan validasi tanggal lampau, pratinjau "buka/tutup sekarang".
- Section **Kebijakan rekaman**: mode, `purpose` (counter 250 karakter), bahasa pengumuman (hanya daftar yang didukung Meta — `id` **tidak** tersedia, tampilkan catatan penjelas).
- Tombol **Sinkronkan dari Meta** dan **Terapkan ke Meta** dengan dialog konfirmasi menampilkan diff sebelum/sesudah.
- Peringatan wajib bila `sip.status = ENABLED`: nomor tidak dapat dipakai aplikasi ini.

### 7.5 Entry points (`/admin/entry-points`)

- Tab **Deep Link**: pilih nomor + payload → pratinjau URL, QR (unduh PNG/SVG), tombol salin. Catatan tetap: tidak berfungsi di WhatsApp desktop; payload butuh client ≥ 2.25.27.
- Tab **Tombol Panggilan**: form kirim pesan interaktif (validasi `display_text` ≤ 20 karakter, `ttl_minutes` 1–43200) dengan pratinjau menyerupai chat WhatsApp.
- Tab **Template**: daftar template call button beserta status persetujuan, tombol sinkronisasi, form pembuatan (`ttl_minutes` 1440–43200).
- Tab **Payload**: CRUD katalog payload + antrian tujuan + statistik atribusi.

### 7.6 Kontak & izin (`/desk/contacts/:id`)

- Header kontak: nama, nomor, ID pelanggan eksternal, tag.
- Kartu **Izin Panggilan** per nomor bisnis: status berwarna, kedaluwarsa, sisa kuota permintaan, tombol "Kirim permintaan izin" (nonaktif dengan alasan bila kuota habis atau nomor dibatasi), indikator CSW terbuka/tertutup.
- Linimasa interaksi.
- Tombol **Telepon** — nonaktif dengan tooltip alasan bila belum diizinkan.

---

## 8. Penanganan error & keadaan kosong

- Setiap tabel memiliki state: loading (skeleton), kosong (`UiEmptyState` + ajakan aksi), error (pesan + tombol coba lagi).
- Kegagalan API menampilkan notifikasi dengan `message` dari backend; `correlationId` ditampilkan kecil untuk pelaporan.
- Kehilangan koneksi WS menampilkan banner tetap "Koneksi realtime terputus — mencoba menyambung kembali…" dan menonaktifkan tombol aksi panggilan.

---

## 9. Kinerja frontend

| Aturan | Detail |
|---|---|
| Bundle | Route-level code splitting; halaman admin lazy |
| Tabel besar | Virtual scroll bila > 200 baris |
| Timer | Satu `requestAnimationFrame`/interval global untuk seluruh timer durasi |
| WS | Throttle update wallboard maksimum 1× per detik |
| Grafik | Impor ECharts secara modular (hanya chart yang dipakai) |
| Gambar/audio | Tidak ada aset audio eksternal — nada dering dibangkitkan WebAudio |

---

## 10. i18n

- Seluruh teks lewat `$t()`; **dilarang** hard-code teks berbahasa Indonesia di komponen.
- Kunci berformat `namespace.key`, mis. `softphone.answer`, `admin.phoneNumber.applyToMeta`.
- Format tanggal/waktu memakai zona waktu organisasi (bukan browser) melalui `useFormatters()`.
- Bahasa default `id`; berkas `en.json` wajib lengkap (test memvalidasi paritas kunci).

---

## 11. Aksesibilitas

- Navigasi keyboard penuh pada softphone (Jawab, Tolak, Mute, Tutup, Selesai).
- Fokus terjebak (focus trap) di modal, dikembalikan setelah tutup.
- Kontras minimal AA; status tidak pernah disampaikan hanya lewat warna (selalu ada ikon + teks).
- `prefers-reduced-motion` dihormati (animasi berkedip dimatikan).
