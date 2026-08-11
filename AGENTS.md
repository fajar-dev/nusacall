# AGENTS.md

**Proyek:** NusaCall — WhatsApp Cloud API Calling Contact Center (web app, tanpa hardware)
**Untuk:** AI coding agent yang mengerjakan repositori ini
**Versi:** 1.0 · 11 Agustus 2026

---

## 0. Baca ini lebih dulu

Kamu adalah AI coding agent yang mengimplementasikan aplikasi ini. Kamu **bukan** perancangnya — perancangannya sudah selesai dan tertulis di folder [`docs/`](./docs/).

Aturan paling penting:

> **Jangan menebak. Jangan berhalusinasi. Kalau tidak ada di `docs/`, tanyakan.**

Kalau kamu menemukan sesuatu yang tidak tercakup dokumen, **berhenti** pada bagian itu, catat sebagai Open Question baru di [`docs/13-ADR-AND-OPEN-QUESTIONS.md`](./docs/13-ADR-AND-OPEN-QUESTIONS.md) §2, dan lanjutkan ke task lain yang tidak terblokir.

---

## 1. Ringkasan produk (satu paragraf)

NusaCall adalah aplikasi web contact center suara. Pelanggan menelepon lewat WhatsApp; panggilan masuk melalui webhook Meta, didistribusikan ke agent lewat antrian berbasis skill, dan **audio mengalir langsung dari browser agent ke infrastruktur Meta lewat WebRTC** — backend tidak pernah dilewati media. Multi-tenant (banyak organisasi) dan multi-WABA (banyak nomor WhatsApp). Rekaman dan transkripsi memakai fitur native Calling API lalu diarsipkan ke object storage sendiri sebelum retensi Meta 7 hari habis.

---

## 2. Stack yang dikunci

| Layer | Teknologi | Wajib |
|---|---|---|
| Runtime | Node.js 22 LTS | ✅ |
| Bahasa | TypeScript strict | ✅ |
| Backend | **Hono** 4.x | ✅ |
| ORM | **TypeORM** 0.3.x | ✅ |
| Database | **MySQL** 8.0 | ✅ |
| Frontend | **Nuxt** 4.x | ✅ |
| UI | **Mantine Vue** | ✅ |
| Ikon | **Tabler Icons** | ✅ |
| Container | **Docker + Compose** | ✅ |
| Integrasi | Meta WhatsApp Cloud API — Calling (Graph v23.0+) | ✅ |

Dependency pendukung yang **disetujui** ada di [`docs/02-ARCHITECTURE.md`](./docs/02-ARCHITECTURE.md) §9. Menambah paket di luar daftar itu = wajib bikin ADR baru lebih dulu.

---

## 3. Urutan membaca dokumen

Sebelum menulis baris kode pertama, baca berurutan:

1. [`docs/00-INDEX.md`](./docs/00-INDEX.md) — peta & konvensi
2. [`docs/01-PRD.md`](./docs/01-PRD.md) — apa yang dibangun & kenapa
3. [`docs/02-ARCHITECTURE.md`](./docs/02-ARCHITECTURE.md) — bagaimana strukturnya
4. [`docs/13-ADR-AND-OPEN-QUESTIONS.md`](./docs/13-ADR-AND-OPEN-QUESTIONS.md) — keputusan & hal yang belum pasti
5. [`docs/RULES.md`](./docs/RULES.md) — **seluruh aturan wajib, terkonsolidasi**

Lalu baca dokumen spesifik sesuai modul yang sedang dikerjakan (tabel di `docs/00-INDEX.md` §2).

---

## 4. Cara kerja: satu task, satu siklus

```
1. Ambil task berikutnya dari docs/12-ROADMAP-BACKLOG.md (BERURUTAN, jangan lompat epic)
2. Baca requirement (FR-*/NFR-*/BR-*) yang dirujuk task itu
3. Cek docs/13 §2 — ada OQ BLOCKING untuk modul ini? Kalau ya, berhenti & laporkan
4. Tulis test lebih dulu (unit + integration + test negatif)
5. Implementasi sampai test hijau
6. pnpm verify   ← lint + typecheck + test + coverage
7. Commit dengan format Conventional Commits (§7)
8. Centang [x] task di docs/12-ROADMAP-BACKLOG.md
9. Lanjut task berikutnya
```

**Jangan** mengerjakan banyak epic sekaligus. **Jangan** melewati langkah 4.

---

## 5. Aturan mutlak — NEVER

Melanggar salah satu dari ini = pekerjaan ditolak.

| # | NEVER |
|---|---|
| N1 | **Jangan** menambah endpoint/field/perilaku Meta yang tidak ada di `docs/03-WHATSAPP-CALLING-SPEC.md` |
| N2 | **Jangan** pakai `synchronize: true` di TypeORM — semua lewat migration |
| N3 | **Jangan** query data domain tanpa scope `organization_id` |
| N4 | **Jangan** kirim access token / app secret Meta ke frontend, dalam bentuk apa pun |
| N5 | **Jangan** generate ulang SDP answer saat `accept` — wajib ambil dari cache Redis (`sdp:answer:{wacid}`) |
| N6 | **Jangan** aktifkan track mikrofon di browser sebelum menerima `call.accepted` |
| N7 | **Jangan** pakai `MediaRecorder` atau merekam audio di sisi browser — rekaman hanya lewat fitur native Meta |
| N8 | **Jangan** implementasikan SIP, PSTN, atau transfer ke nomor telepon konvensional — dilarang Terms Meta |
| N9 | **Jangan** panggil Graph API di dalam transaksi database |
| N10 | **Jangan** panggil `restartIce()` atau renegotiation pada panggilan yang sedang aktif |
| N11 | **Jangan** log SDP, token, password, atau rahasia apa pun |
| N12 | **Jangan** pakai `any`, `console.log`, atau `TODO` tanpa nomor issue |
| N13 | **Jangan** tulis kode tanpa test |
| N14 | **Jangan** ubah keputusan ADR tanpa menulis ADR baru |
| N15 | **Jangan** ganti stack atau tambah dependency di luar daftar yang disetujui |

## 6. Aturan mutlak — ALWAYS

| # | ALWAYS |
|---|---|
| A1 | Validasi semua input eksternal (HTTP, WS, webhook, job, env) dengan Zod |
| A2 | Verifikasi `X-Hub-Signature-256` pada setiap webhook, memakai **raw body** |
| A3 | Balas webhook `200` dalam ≤ 300 ms, proses asinkron lewat queue |
| A4 | Isi `biz_opaque_callback_data` dengan `call.id` internal |
| A5 | Panggil `pre_accept` sebelum `accept`, dengan SDP answer yang **identik** |
| A6 | Panggil `terminate` saat sisi bisnis mengakhiri panggilan, walau media sudah berhenti |
| A7 | Arsipkan rekaman & transkrip ke storage sendiri dalam ≤ 24 jam |
| A8 | Enkripsi rahasia at-rest dengan AES-256-GCM |
| A9 | Inject `Clock` — jangan pakai `new Date()` langsung di domain/application |
| A10 | Hormati batas layer: `domain ← application ← interface`, infrastructure mengimplementasi port |
| A11 | Semua teks UI lewat i18n (`$t()`), default Bahasa Indonesia |
| A12 | Tulis test negatif: validasi gagal, tanpa izin, lintas tenant, state ilegal |
| A13 | Cantumkan ID requirement (`FR-*`) di deskripsi commit/PR |
| A14 | Tandai asumsi sementara dengan `// ASSUMPTION(OQ-00X)` |

---

## 7. Commit & branch

Format **Conventional Commits**, ringkas, tanpa trailer co-author:

```
feat(calling): tambah use case pre-accept panggilan masuk

Menyimpan SDP answer di Redis agar accept memakai SDP identik.
Refs: FR-CALL-006, FR-CALL-007
```

Tipe: `feat` `fix` `refactor` `perf` `test` `docs` `build` `ci` `chore`
Scope: nama modul (`calling`, `routing`, `media`, `web`, `infra`)
Branch: `feat/<epic>-<ringkas>` · `fix/<issue>-<ringkas>`

---

## 8. Perintah

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm --filter backend migration:run
pnpm --filter backend seed

pnpm dev            # backend + web
pnpm test           # unit
pnpm test:int       # integration (butuh Docker)
pnpm test:e2e       # Playwright
pnpm verify         # ← WAJIB hijau sebelum commit
```

---

## 9. Definition of Done

Task selesai **hanya bila semua** terpenuhi:

- [ ] Requirement yang dirujuk benar-benar terpenuhi
- [ ] Unit test untuk logika domain & application
- [ ] Integration test untuk endpoint/repository/handler
- [ ] Test negatif ada
- [ ] `pnpm verify` hijau
- [ ] Migration punya `up` **dan** `down` yang teruji
- [ ] Tidak ada `any`, `console.log`, `TODO` tanpa issue
- [ ] Dokumen diperbarui bila kontrak berubah
- [ ] Task dicentang di `docs/12-ROADMAP-BACKLOG.md`

---

## 10. Milestone kritis

**Akhir Epic E8** aplikasi harus sudah bisa menerima panggilan WhatsApp sungguhan dan berbicara dua arah lewat browser, diverifikasi dengan nomor test Meta.

**Kalau ini belum tercapai, JANGAN lanjut ke epic berikutnya.** Seluruh fase setelahnya bergantung pada jalur ini bekerja.

---

## 11. Kalau kamu ragu

| Situasi | Yang harus dilakukan |
|---|---|
| Kontrak Meta tidak jelas | Catat `OQ` baru di `docs/13` §2, pakai asumsi di §3 dokumen itu, tandai `// ASSUMPTION(OQ-00X)` |
| Butuh dependency baru | Tulis ADR di `docs/13` §1, tunggu persetujuan manusia |
| Requirement bertabrakan | Prioritas: keamanan > kepatuhan Meta > kebenaran data > UX > kinerja. Laporkan konfliknya |
| Dokumen salah/usang | Perbaiki dokumen **dan** sebutkan perubahannya di commit |
| Test sulit ditulis | Itu tanda desainnya salah — refactor, jangan lewati test |

---

## 12. Struktur repositori

```
nusacall/
├─ AGENTS.md              ← kamu di sini
├─ CLAUDE.md              ← penunjuk ke AGENTS.md
├─ docs/                  ← SELURUH aturan & spesifikasi
│  ├─ RULES.md            ← aturan wajib, terkonsolidasi
│  └─ 00..13-*.md
├─ apps/
│  ├─ backend/            ← Hono + TypeORM
│  └─ web/                ← Nuxt + Mantine Vue
├─ packages/
│  ├─ contracts/          ← Zod schema bersama
│  ├─ ws-protocol/        ← tipe pesan WebSocket
│  └─ eslint-config/
├─ docker/
├─ docker-compose.yml
└─ docker-compose.dev.yml
```

---

## 13. Larangan yang gampang terlanggar tanpa sadar

Empat hal ini terlihat wajar tapi akan merusak produk atau melanggar Terms Meta. Ingat baik-baik:

1. **"Tambahkan transfer ke nomor HP supervisor"** → PSTN. Dilarang. Selamanya.
2. **"Rekam pakai MediaRecorder biar tidak tergantung Meta"** → melewati pengumuman persetujuan yang wajib secara hukum.
3. **"Generate answer baru saja biar simpel"** → Meta menolak `accept` dengan SDP berbeda. Ini bug paling umum di integrasi ini.
4. **"Bikin nada dering pakai file mp3"** → pakai WebAudio; tidak boleh ada aset audio eksternal.
