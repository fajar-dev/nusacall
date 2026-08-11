# NusaCall — Dokumentasi Produk & Teknis

**Proyek:** WhatsApp Cloud API Calling Contact Center (web-based, tanpa hardware)
**Kode proyek:** `nusacall`
**Versi dokumen:** 1.0
**Tanggal:** 11 Agustus 2026
**Status:** Baseline untuk implementasi

---

## 1. Untuk siapa dokumen ini

Dokumen ini adalah **satu-satunya sumber kebenaran (single source of truth)** bagi AI coding agent yang akan mengimplementasikan aplikasi. Dokumen ini bersifat **preskriptif**: apa yang tertulis di sini WAJIB diikuti, dan apa yang tidak tertulis di sini WAJIB ditanyakan atau dicatat sebagai asumsi di `13-ADR-AND-OPEN-QUESTIONS.md` — **bukan** ditebak.

### Aturan mutlak untuk AI coding agent

1. **JANGAN berhalusinasi endpoint, field, atau perilaku WhatsApp Cloud API.** Semua kontrak API Meta yang boleh dipakai tercantum di `03-WHATSAPP-CALLING-SPEC.md`. Bila butuh sesuatu di luar itu, hentikan dan tanyakan.
2. **JANGAN mengganti stack** yang sudah ditetapkan (lihat §3). Library tambahan hanya boleh dari daftar yang disetujui di `02-ARCHITECTURE.md` §9.
3. **JANGAN memakai `synchronize: true` pada TypeORM.** Semua perubahan skema lewat migration.
4. **JANGAN menulis kode tanpa test.** Definisi selesai (DoD) ada di `09-TESTING-STRATEGY.md` §1.
5. **JANGAN menghapus atau melonggarkan validasi tenant.** Setiap query data domain WAJIB ter-scope `organization_id` (lihat `04-DATA-MODEL.md` §3).
6. Setiap penyimpangan dari dokumen WAJIB ditulis sebagai ADR baru di `13-ADR-AND-OPEN-QUESTIONS.md`.

---

## 2. Peta dokumen

| # | File | Isi | Baca kapan |
|---|------|-----|------------|
| — | `../AGENTS.md` | Instruksi operasional AI coding agent: cara kerja, aturan NEVER/ALWAYS, DoD | **Paling pertama** |
| — | `RULES.md` | **Seluruh aturan wajib terkonsolidasi (R-001…R-228)**, bernomor & bertingkat | Selalu, saat menulis kode & review |
| 00 | `00-INDEX.md` | Dokumen ini — peta, konvensi, aturan | Selalu, pertama |
| 01 | `01-PRD.md` | Product Requirements: visi, persona, scope, user story, functional & non-functional requirement | Sebelum mulai apa pun |
| 02 | `02-ARCHITECTURE.md` | Arsitektur sistem, clean architecture, struktur folder, dependency | Sebelum menulis baris kode pertama |
| 03 | `03-WHATSAPP-CALLING-SPEC.md` | Kontrak lengkap Meta Cloud API Calling: endpoint, webhook, state machine, error, batasan | Saat menyentuh modul `calling` / `wa-accounts` |
| 04 | `04-DATA-MODEL.md` | ERD, seluruh tabel, entity TypeORM, index, strategi migration | Saat membuat entity/migration |
| 05 | `05-BACKEND-API-SPEC.md` | Kontrak REST internal (frontend ↔ backend), format error, pagination, auth | Saat membuat route/controller |
| 06 | `06-REALTIME-WEBRTC-SPEC.md` | Protokol WebSocket, signaling, siklus hidup WebRTC di browser, state machine agent | Saat mengerjakan softphone/gateway |
| 07 | `07-FRONTEND-SPEC.md` | Struktur Nuxt, halaman, komponen, state, UX softphone, design system | Saat mengerjakan frontend |
| 08 | `08-SECURITY-COMPLIANCE.md` | Auth, RBAC, enkripsi token, verifikasi signature, retensi data, consent recording | Saat menyentuh auth/kredensial/rekaman |
| 09 | `09-TESTING-STRATEGY.md` | Piramida test, tooling, fixture, mock Graph API, DoD, target coverage | Setiap task |
| 10 | `10-DEVOPS-DOCKER.md` | Docker compose, env var, tunneling webhook, CI, seed, runbook | Saat setup awal & deployment |
| 11 | `11-CODING-STANDARDS.md` | Konvensi penamaan, lint, commit, error handling, logging, i18n | Setiap task |
| 12 | `12-ROADMAP-BACKLOG.md` | Epic → story → task berurutan, siap dieksekusi satu per satu | Untuk menentukan urutan kerja |
| 13 | `13-ADR-AND-OPEN-QUESTIONS.md` | Keputusan arsitektur beserta alasannya + daftar hal yang WAJIB diverifikasi | Saat ragu |

**Urutan baca yang disarankan:** `AGENTS.md` → 00 → 01 → 02 → 13 → `RULES.md` → 04 → 03 → 05 → 06 → 07 → 09 → 11 → 10 → 12.

---

## 3. Stack yang dikunci (tidak boleh diganti)

| Layer | Teknologi | Versi minimum | Referensi |
|---|---|---|---|
| Runtime | Node.js | 22 LTS | — |
| Bahasa | TypeScript (strict) | 5.6 | — |
| Backend framework | **Hono** | 4.x | https://hono.dev/docs/ |
| ORM | **TypeORM** | 0.3.x | https://typeorm.io/docs/getting-started |
| Database | **MySQL** | 8.0 | — |
| Frontend framework | **Nuxt** | 4.x | https://nuxt.com/docs/4.x/getting-started/introduction |
| UI component | **Mantine Vue** | terbaru | https://mantine-vue.dev/getting-started |
| Icon | **Tabler Icons** | terbaru | https://docs.tabler.io/ |
| Containerization | **Docker + Docker Compose** | — | — |
| Integrasi eksternal | **Meta WhatsApp Cloud API — Calling** | Graph API v23.0+ | https://developers.facebook.com/documentation/business-messaging/whatsapp/calling |

Library pendukung (Redis, BullMQ, Zod, Pino, Vitest, dll.) didaftarkan lengkap di `02-ARCHITECTURE.md` §9. Menambah dependency di luar daftar itu memerlukan ADR.

---

## 4. Konvensi penomoran requirement

- `FR-<MODUL>-<NNN>` — Functional Requirement, mis. `FR-CALL-014`
- `NFR-<KATEGORI>-<NNN>` — Non-Functional Requirement, mis. `NFR-PERF-003`
- `BR-<NNN>` — Business Rule
- `US-<NNN>` — User Story
- `ADR-<NNN>` — Architecture Decision Record
- `OQ-<NNN>` — Open Question (wajib diverifikasi sebelum implementasi bagian terkait)

Setiap commit dan setiap test WAJIB mereferensikan ID requirement yang dipenuhinya.

---

## 5. Ringkasan produk dalam satu paragraf

NusaCall adalah aplikasi web contact center berbasis suara yang berjalan sepenuhnya di browser (tanpa softphone/hardware/PABX). Aplikasi menerima dan melakukan panggilan suara WhatsApp melalui Meta WhatsApp Cloud API Calling, mendistribusikannya ke banyak agent melalui mekanisme antrian (ACD) berbasis skill, dan mendukung banyak nomor WhatsApp Business dari banyak organisasi (multi-tenant, multi-WABA) dalam satu instalasi. Media suara mengalir langsung antara browser agent dan infrastruktur Meta melalui WebRTC; backend hanya berperan sebagai signaling relay, orchestrator, dan sistem pencatatan. Fitur rekaman dan transkripsi memakai kemampuan native Calling API, lalu diarsipkan ke object storage milik sendiri sebelum masa retensi Meta (7 hari) habis.

---

## 6. Istilah (glossary)

| Istilah | Arti |
|---|---|
| **WABA** | WhatsApp Business Account (entitas induk di Meta yang menaungi nomor bisnis) |
| **PNID** | `phone_number_id` — ID nomor bisnis di Cloud API |
| **wacid** | ID panggilan WhatsApp (`wacid.xxx`) |
| **UIC** | User-Initiated Call — pelanggan menelepon bisnis |
| **BIC** | Business-Initiated Call — bisnis menelepon pelanggan |
| **CPR** | Call Permission Request — permintaan izin agar bisnis boleh menelepon user |
| **CSW** | Customer Service Window — jendela 24 jam free-form messaging |
| **ACD** | Automatic Call Distribution — mesin distribusi panggilan ke agent |
| **Wrap-up** | Waktu setelah panggilan untuk agent mengisi disposisi |
| **Disposition** | Kode hasil panggilan (mis. `RESOLVED`, `ESCALATED`) |
| **Softphone** | Komponen UI di browser yang menangani WebRTC & kontrol panggilan |
| **Tenant / Organization** | Unit isolasi data tertinggi di aplikasi |
| **Signaling** | Pertukaran SDP/status antara backend, browser agent, dan Meta |
| **Media leg** | Jalur audio WebRTC antara browser agent dan Meta |

---

## 7. Cara mengeksekusi dokumen ini

1. Baca `13-ADR-AND-OPEN-QUESTIONS.md` §2 dan selesaikan semua `OQ` berstatus **BLOCKING** sebelum menyentuh modul terkait.
2. Kerjakan `12-ROADMAP-BACKLOG.md` secara berurutan per epic. Jangan melompat epic.
3. Untuk setiap task: baca requirement → tulis test → tulis implementasi → jalankan `pnpm verify` (lint + typecheck + test) → commit dengan format di `11-CODING-STANDARDS.md` §6.
4. Setelah setiap epic selesai, perbarui checklist di `12-ROADMAP-BACKLOG.md`.
