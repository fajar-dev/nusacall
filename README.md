# NusaCall

**Call center suara berbasis WhatsApp**

NusaCall memungkinkan pelanggan menelepon bisnis Anda lewat WhatsApp. Dibangun di atas [Meta WhatsApp Cloud API Calling](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling).

---

## Kenapa proyek ini ada

Meta kini memperbolehkan nomor WhatsApp Business menerima dan melakukan panggilan suara. Tapi Meta hanya menyediakan **signaling** — siapa menelepon siapa, kapan diangkat, kapan ditutup. Suaranya sendiri harus Anda tangani sendiri. Meta menyebutnya _"bring your own VoIP system"_.

Solusi yang ada di pasar menjawabnya dengan hardware atau PABX. NusaCall menjawabnya dengan browser: **audio mengalir langsung dari browser agent ke infrastruktur Meta** lewat WebRTC. Server kami tidak pernah menyentuh suaranya.

Konsekuensi praktisnya:

- Agent baru cukup diberi akun, tidak perlu instalasi apa pun
- Server tetap ringan walau panggilan banyak — tidak ada media yang lewat
- Kalau server sempat mati, panggilan yang sedang berlangsung **tidak putus**

---

## Apa yang bisa dilakukan

**Untuk agent**
Menerima panggilan masuk dengan konteks pelanggan yang otomatis muncul, menelepon keluar setelah pelanggan memberi izin, mencatat hasil panggilan, dan menjadwalkan callback — semua dari satu layar.

**Untuk supervisor**
Wallboard real-time, memantau status semua agent, mendengarkan rekaman, membaca transkrip, dan **mencari panggilan berdasarkan isi percakapannya** (bukan cuma nomor atau tanggal).

**Untuk admin**
Mengatur jam operasional, antrian, skill routing, kebijakan rekaman, dan membuat entry point berupa tombol panggilan di chat, template, atau deep link + QR code yang bisa ditempel di mana saja.

**Untuk banyak organisasi sekaligus**
Satu instalasi melayani banyak tenant, masing-masing dengan banyak nomor WhatsApp Business. Data antar organisasi terisolasi penuh.

---

## Cara kerjanya (versi singkat)

```
Pelanggan tekan tombol telepon di WhatsApp
        ↓
Meta kirim webhook ke server NusaCall
        ↓
Server pilih agent yang cocok (skill + paling lama menganggur)
        ↓
Browser agent menyiapkan koneksi, layar agent berdering
        ↓
Agent angkat → suara mengalir LANGSUNG browser ⟷ Meta
        ↓
Panggilan selesai → agent isi hasil → rekaman & transkrip diarsipkan
```

Rekaman dan transkripsi memakai fitur bawaan Meta — termasuk pengumuman persetujuan yang diputar otomatis ke kedua pihak. Transkripnya memisahkan suara agent dan pelanggan di kanal berbeda, jadi tetap akurat walau keduanya bicara bersamaan, dan **Bahasa Indonesia sudah didukung**.

---

## Teknologi

|                  |                                                       |
| ---------------- | ----------------------------------------------------- |
| **Backend**      | Hono · TypeORM · MySQL 8 · Redis · BullMQ             |
| **Frontend**     | Nuxt 4 · Mantine Vue · Tabler Icons · Pinia           |
| **Media**        | WebRTC (Opus 48 kHz) langsung ke Meta RTC             |
| **Penyimpanan**  | S3/MinIO untuk arsip rekaman & transkrip              |
| **Pengembangan** | Docker Compose · Vitest · Playwright · pnpm workspace |

---

## Menjalankan di lokal

**Yang perlu disiapkan:** Docker, Node.js 22, pnpm 9, dan akun Meta Developer dengan minimal satu _public test number_.

```bash
# 1. Siapkan konfigurasi
cp .env.example .env

# 2. Buat kunci rahasia (jalankan dua kali, isi JWT_SECRET & SECRET_ENCRYPTION_KEYS)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3. Nyalakan infrastruktur
docker compose -f docker-compose.dev.yml up -d mysql redis minio minio-init

# 4. Siapkan database
pnpm install
pnpm --filter backend migration:run
pnpm --filter backend seed

# 5. Jalankan semuanya
docker compose -f docker-compose.dev.yml up -d
```

**Menghubungkan webhook Meta.** Meta perlu URL HTTPS publik untuk mengirim event, jadi compose sudah menyertakan Cloudflare Tunnel:

```bash
docker compose -f docker-compose.dev.yml logs -f tunnel   # salin URL yang muncul
```

Lalu di Meta App Dashboard → Webhooks:

- **Callback URL:** `https://<url-tunnel>/webhooks/meta/<metaAppId>`
- **Subscribe field:** `calls`, `messages`, `account_update`, `account_settings_update`, `message_template_status_update`
- Subscribe app ke WABA nomor uji Anda

Terakhir, aktifkan calling pada nomor lewat halaman `/admin/phone-numbers` — **calling tidak aktif secara default**, termasuk pada test number.

### Alamat lokal

| Layanan            | URL                            |
| ------------------ | ------------------------------ |
| Aplikasi web       | http://localhost:3000          |
| API + dokumentasi  | http://localhost:3001/api/docs |
| Adminer (database) | http://localhost:8080          |
| MinIO Console      | http://localhost:9001          |
| Mailpit (email)    | http://localhost:8025          |

---

## Perintah harian

```bash
pnpm dev              # backend + frontend
pnpm test             # unit test
pnpm test:int         # integration test (butuh Docker)
pnpm test:e2e         # end-to-end (Playwright)
pnpm verify           # lint + typecheck + test — wajib hijau sebelum commit
```

---

## Struktur repositori

```
nusacall/
├─ AGENTS.md          Instruksi untuk AI coding agent
├─ CLAUDE.md          Penunjuk ke AGENTS.md
├─ docs/              Seluruh spesifikasi & aturan  ← baca ini
├─ apps/
│  ├─ backend/        Hono + TypeORM
│  └─ web/            Nuxt + Mantine Vue
├─ packages/
│  ├─ contracts/      Skema Zod yang dipakai bersama
│  ├─ ws-protocol/    Tipe pesan WebSocket
│  └─ eslint-config/
└─ docker/
```

### Dokumentasi

Semua keputusan produk dan teknis ada di [`docs/`](./docs/). Mulai dari mana:

| Kalau Anda ingin tahu…                  | Baca                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Apa yang dibangun dan kenapa            | [`docs/01-PRD.md`](./docs/01-PRD.md)                                       |
| Bagaimana sistemnya disusun             | [`docs/02-ARCHITECTURE.md`](./docs/02-ARCHITECTURE.md)                     |
| Cara kerja integrasi Meta secara detail | [`docs/03-WHATSAPP-CALLING-SPEC.md`](./docs/03-WHATSAPP-CALLING-SPEC.md)   |
| Aturan yang wajib dipatuhi saat coding  | [`docs/RULES.md`](./docs/RULES.md)                                         |
| Apa yang dikerjakan berikutnya          | [`docs/12-ROADMAP-BACKLOG.md`](./docs/12-ROADMAP-BACKLOG.md)               |
| Kenapa sesuatu diputuskan begitu        | [`docs/13-ADR-AND-OPEN-QUESTIONS.md`](./docs/13-ADR-AND-OPEN-QUESTIONS.md) |

Peta lengkapnya ada di [`docs/00-INDEX.md`](./docs/00-INDEX.md).

---

## Yang belum bisa dilakukan (dan kenapa)

Karena browser terhubung langsung ke Meta tanpa media server di tengah, beberapa fitur contact center klasik belum tersedia:

| Fitur                                  | Status        | Alasan                                        |
| -------------------------------------- | ------------- | --------------------------------------------- |
| Transfer panggilan antar agent         | Fase 2        | Butuh media server di tengah                  |
| Conference 3 pihak                     | Fase 2        | Sama                                          |
| Supervisor listen / whisper / barge-in | Fase 2        | Sama                                          |
| IVR dengan menu tekan angka            | Fase 2        | Membaca DTMF butuh akses RTP mentah           |
| Hold dengan musik tunggu               | Fase 2        | Butuh sumber audio dari server                |
| Video call & screen share              | Menunggu Meta | Masih ditandai "dalam pengembangan" oleh Meta |

Fase 2 menyisipkan media server tanpa mengubah kontrak signaling, jadi migrasinya tidak membongkar apa pun.

**Yang tidak akan pernah ada:** integrasi SIP dan transfer ke nomor telepon biasa. Terms Meta melarang leg PSTN di alur panggilan WhatsApp, titik.

---

## Hal-hal yang perlu Anda ketahui sebagai operator

**Rekaman selalu terdengar.** Meta memutar pengumuman ke kedua pihak sebelum merekam. Ini tidak bisa dimatikan, dan memang begitu seharusnya. Bahasa Indonesia belum tersedia untuk pengumuman ini — saat ini memakai Bahasa Inggris, jadi biasakan agent mengonfirmasi ulang dalam Bahasa Indonesia di awal percakapan.

**Rekaman hanya bertahan 7 hari di Meta.** NusaCall otomatis mengarsipkannya ke penyimpanan Anda sendiri dalam 24 jam. Kalau job arsip gagal berulang, Anda akan dapat notifikasi — jangan diabaikan.

**Reputasi nomor itu nyata.** Kalau terlalu banyak panggilan tidak diangkat atau pelanggan sering memblokir, Meta akan menyembunyikan tombol telepon Anda, lalu membekukan nomor selama 7 hari. NusaCall memantau ini dan memberi peringatan dini, tapi pencegahan terbaik adalah jam operasional yang jujur dan agent yang cukup.

**Panggilan keluar butuh izin.** Pelanggan harus menyetujui lebih dulu, dan Meta membatasi berapa kali Anda boleh meminta (1 per hari, 2 per minggu per pelanggan). NusaCall menegakkan batas ini sebelum request dikirim, jadi Anda tidak akan kena penalti karena kelebihan.

**Panggilan masuk gratis.** Yang berbayar hanya panggilan keluar yang diangkat, dihitung per 6 detik. Indonesia berada di band tarif terendah.

---

## Status proyek

Implementasi dikerjakan bertahap mengikuti [`docs/12-ROADMAP-BACKLOG.md`](./docs/12-ROADMAP-BACKLOG.md). Milestone penting ada di akhir **Epic E8**: panggilan masuk end-to-end yang terbukti bekerja dengan nomor WhatsApp sungguhan. Fase-fase setelahnya bergantung sepenuhnya pada jalur ini, jadi tidak ada yang dikerjakan sebelum itu terbukti.

Ada juga beberapa pertanyaan terbuka yang harus dijawab dengan pengujian nyata sebelum modul tertentu dikerjakan — daftarnya di [`docs/13-ADR-AND-OPEN-QUESTIONS.md`](./docs/13-ADR-AND-OPEN-QUESTIONS.md) §2.

---

## Berkontribusi

- Baca [`docs/11-CODING-STANDARDS.md`](./docs/11-CODING-STANDARDS.md) dan [`docs/RULES.md`](./docs/RULES.md) sebelum menulis kode
- Format commit: Conventional Commits, sertakan ID requirement (`Refs: FR-CALL-007`)
- `pnpm verify` harus hijau sebelum commit
- Kode tanpa test tidak diterima
- Menyimpang dari dokumen? Tulis ADR baru dulu

---
