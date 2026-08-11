# 12 — Roadmap & Backlog Implementasi

> **Cara memakai dokumen ini:** kerjakan epic secara berurutan dari atas ke bawah. Jangan melompat. Setiap task memiliki *Definition of Done* tambahan di baris "DoD"; DoD umum ada di `09-TESTING-STRATEGY.md` §1. Tandai `[x]` setelah selesai dan `pnpm verify` hijau.

---

## Ringkasan fase

| Fase | Epic | Hasil |
|---|---|---|
| **Fase 0** | E0 | Fondasi repo, Docker, CI |
| **Fase 1** | E1–E4 | Identitas, tenancy, akun Meta, ingest webhook |
| **Fase 2** | E5–E8 | Softphone & panggilan masuk end-to-end (jantung produk) |
| **Fase 3** | E9–E11 | ACD lengkap, wrap-up, panggilan keluar & izin |
| **Fase 4** | E12–E14 | Rekaman, transkrip, arsip, pencarian |
| **Fase 5** | E15–E17 | Supervisi, analitik, entry point |
| **Fase 6** | E18–E20 | Callback, notifikasi, AI summary, pengerasan |
| **Fase 7** | E21+ | (Opsional) media server: transfer, conference, monitoring, IVR |

**Milestone kritis:** akhir Fase 2 harus sudah bisa menerima panggilan WhatsApp sungguhan dan berbicara dua arah lewat browser. Bila belum tercapai, jangan lanjut ke fase berikutnya.

---

## E0 — Fondasi proyek

- [x] **E0-T1** Inisialisasi monorepo pnpm + Turborepo sesuai `02-ARCHITECTURE.md` §4.
  DoD: `pnpm install` sukses, `turbo run build` jalan pada workspace kosong.
- [x] **E0-T2** Konfigurasi TypeScript, ESLint (termasuk `eslint-plugin-boundaries`), Prettier, husky + lint-staged, commitlint.
  DoD: pelanggaran batas layer benar-benar gagal saat lint (buktikan dengan test fixture).
- [x] **E0-T3** Buat `apps/backend` dengan Hono + `@hono/node-server`, entry `main.ts` yang membaca `APP_ROLE`.
  DoD: `GET /health/live` mengembalikan 200.
- [x] **E0-T4** `bootstrap/config.ts` — validasi env dengan Zod, gagal start bila tidak valid.
  DoD: unit test untuk env valid & tidak valid.
- [x] **E0-T5** Logging pino + `correlationId` via AsyncLocalStorage + redaksi field sensitif.
  DoD: test membuktikan `password`, `sdp`, `accessToken` teredaksi.
- [x] **E0-T6** Hierarki `AppError` + middleware `errorHandler` sesuai `05-BACKEND-API-SPEC.md` §1.2.
  DoD: test untuk setiap kode HTTP yang dipetakan.
- [x] **E0-T7** Koneksi TypeORM (`synchronize: false`) + skrip migration + `Clock` service.
- [x] **E0-T8** Koneksi Redis + BullMQ setup + registrasi queue kosong.
- [x] **E0-T9** Adapter object storage S3/MinIO (`StoragePort` + implementasi).
- [x] **E0-T10** `apps/web` Nuxt 4 + Mantine Vue + Tabler + Pinia + i18n (id/en) + layout `auth`/`default`.
  DoD: halaman kosong ter-render, tema kustom aktif.
- [x] **E0-T11** `packages/contracts` & `packages/ws-protocol` dengan skema Zod dasar.
- [x] **E0-T12** Dockerfile backend & web (multi-stage) + `docker-compose.dev.yml` lengkap sesuai `10-DEVOPS-DOCKER.md` §2.
  DoD: `docker compose up` menjalankan semua service dalam keadaan healthy.
- [x] **E0-T13** Setup Vitest (unit + integration dengan Testcontainers) dan Playwright.
- [x] **E0-T14** GitHub Actions `ci.yml` sesuai `10-DEVOPS-DOCKER.md` §6.
- [ ] **E0-T15** OpenAPI (`@hono/zod-openapi` + Scalar) di `/api/docs`.

---

## E1 — Tenancy & identitas

- [ ] **E1-T1** Migration `CreateTenancyAndIdentity` (`organizations`, `users`, `refresh_tokens`, `audit_logs`).
- [ ] **E1-T2** Domain & repository `Organization`, `User` + `TenantScopedRepository` (`04-DATA-MODEL.md` §3).
  DoD: test isolasi tenant negatif.
- [ ] **E1-T3** Use case autentikasi: login (Argon2id), refresh dengan rotasi + deteksi reuse, logout, logout-all.
  DoD: test reuse token mencabut seluruh family.
- [ ] **E1-T4** Middleware `auth`, `tenant`, `requirePermission` + matriks RBAC (`08-SECURITY-COMPLIANCE.md` §3).
- [ ] **E1-T5** TOTP 2FA (setup, enable, disable, recovery codes).
- [ ] **E1-T6** Rate limit login + lockout.
- [ ] **E1-T7** Audit log service + pencatatan otomatis aksi sensitif.
- [ ] **E1-T8** CRUD organisasi (PO) & pengaturan organisasi (OA).
- [ ] **E1-T9** CRUD user + reset password + kelola sesi.
- [ ] **E1-T10** Frontend: halaman login (+2FA), guard route berbasis permission, store `auth`, halaman `/admin/users`.
  DoD: E2E login → akses halaman sesuai peran; peran tanpa izin mendapat 403.

---

## E2 — Akun Meta, WABA & nomor

- [ ] **E2-T1** Migration `CreateMetaAccounts`.
- [ ] **E2-T2** `SecretCipher` (AES-256-GCM, multi-key, rotasi) + `TokenResolver`.
  DoD: test enkripsi/dekripsi, rotasi kunci, dan bahwa nilai plaintext tidak pernah ter-log.
- [ ] **E2-T3** CRUD Meta App, WABA, nomor (token write-only di API).
- [ ] **E2-T4** Klien Graph API (`infrastructure/meta/`) sesuai checklist `03-WHATSAPP-CALLING-SPEC.md` §13.
  DoD: test dengan MSW untuk sukses, 4xx (tanpa retry), 5xx (retry), timeout.
- [ ] **E2-T5** Skema Zod seluruh payload Meta + contract test terhadap fixture.
- [ ] **E2-T6** `GET/PUT` calling settings + validasi lokal lengkap (§3.2).
  DoD: 8 test validasi negatif (entri > 2/hari, tumpang tindih, open ≥ close, libur > 20, tanggal lampau, dst.).
- [ ] **E2-T7** Uji koneksi + sinkronisasi settings + job terjadwal 6 jam.
- [ ] **E2-T8** Guard: nomor dengan `sip.status = ENABLED` tidak dapat dipakai; nomor `RESTRICTED` memblokir panggilan keluar.
- [ ] **E2-T9** Frontend `/admin/phone-numbers` + detail (editor jam operasional, diff sebelum apply, banner restriction).
  DoD: E2E ubah jam operasional termasuk kasus validasi gagal.

---

## E3 — Ingest webhook

- [ ] **E3-T1** Migration `CreateWebhookAndOutbox` (`webhook_events`, `domain_events`).
- [ ] **E3-T2** `GET /webhooks/meta/:metaAppId` verifikasi `hub.challenge` (timing-safe).
- [ ] **E3-T3** `POST /webhooks/meta/:metaAppId`: raw body → verifikasi HMAC → simpan → enqueue → 200.
  DoD: test signature valid/invalid/absen; test duplikat hanya menghasilkan satu job; test p95 < 300 ms.
- [ ] **E3-T4** Worker `webhook.process` + router field (`calls`, `messages`, `account_update`, `account_settings_update`, `message_template_status_update`) + resolusi tenant dari WABA/PNID.
- [ ] **E3-T5** Retry backoff + DLQ + endpoint replay manual.
- [ ] **E3-T6** Handler `account_settings_update` & `account_update` (violation/restriction) + notifikasi.
- [ ] **E3-T7** Outbox `domain_events` + poller publikasi.
- [ ] **E3-T8** Job retensi `webhook_events` 30 hari.

---

## E4 — Kontak & routing dasar

- [ ] **E4-T1** Migration `CreateContactsAndPermissions` & `CreateRoutingAndAgents`.
- [ ] **E4-T2** Domain kontak + resolusi otomatis dari webhook (`wa_id`, `profile.name`) + normalisasi E.164.
- [ ] **E4-T3** CRUD skill, antrian, `queue_skills`, `agent_queues`, `agent_skills`.
- [ ] **E4-T4** `routing_rules` + `RoutingResolver` (prioritas, payload equals/prefix/regex, fallback default queue).
  DoD: test tabel keputusan lengkap + endpoint `/routing-rules/simulate`.
- [ ] **E4-T5** `entry_point_payloads` CRUD + pemetaan payload → antrian.
- [ ] **E4-T6** Frontend `/admin/queues`, `/admin/skills`, halaman routing + simulator.

---

## E5 — Status agent & WebSocket gateway

- [ ] **E5-T1** `AgentStateStore` berbasis Redis (`agent:{userId}`) + replikasi asinkron ke `agent_status_events`.
- [ ] **E5-T2** WS gateway: upgrade, token WS sekali pakai, registry Redis lintas instance, heartbeat, backpressure.
  DoD: integration test dua instance — pesan ke user yang terhubung di instance lain tetap sampai.
- [ ] **E5-T3** `packages/ws-protocol`: seluruh tipe pesan `06-REALTIME-WEBRTC-SPEC.md` §2 + validasi Zod.
- [ ] **E5-T4** Handler `client.hello`, `client.resync`, `agent.set_status`, ping/pong.
- [ ] **E5-T5** Frontend `WsClient` (reconnect backoff + jitter, deduplikasi id, resync) + store `ws`.
- [ ] **E5-T6** UI kartu status agent + `POST /me/agent-state`.
  DoD: E2E ubah status, tutup tab → agent `OFFLINE` dalam ≤ 30 detik.

---

## E6 — Panggilan masuk: signaling backend

- [ ] **E6-T1** Migration `CreateCallsAndEvents`.
- [ ] **E6-T2** Domain `Call` + `CallStateMachine` + `CallEvent` (append-only, `sequence`).
  DoD: test tabel transisi legal/ilegal lengkap.
- [ ] **E6-T3** Use case `HandleInboundCallConnect`: buat Call `QUEUED`, resolve kontak & antrian, catat `cta_payload`/`deeplink_payload`/`entry_point`.
- [ ] **E6-T4** `RedisSdpCache` (`sdp:answer:{wacid}`, TTL 300 detik).
- [ ] **E6-T5** Use case `PreAcceptCall`, `AcceptCall`, `RejectCall`, `TerminateCall`.
  DoD: test bahwa `accept` memakai SDP **identik** dari cache; cache kosong → `SDP_ANSWER_MISSING` + reject.
- [ ] **E6-T6** Use case `HandleCallTerminateWebhook` (status, start/end/duration, errors) + `HandleCallStatusWebhook`.
- [ ] **E6-T7** Timeout guard 30 detik (BR-006) + job `calls.stale-sweeper`.
- [ ] **E6-T8** `biz_opaque_callback_data = call.id` di seluruh request yang mendukungnya.
- [ ] **E6-T9** Handler WS `call.answer_sdp`, `call.answer`, `call.reject`, `call.hangup`, `call.ice_state`, `call.media_error`.

---

## E7 — Softphone browser (WebRTC)

- [ ] **E7-T1** `lib/webrtc/sdp.ts` — `mungeSdp` + util parser murni.
  DoD: unit test §5.7 `09-TESTING-STRATEGY.md` termasuk idempotensi dan baris yang tidak boleh berubah.
- [ ] **E7-T2** `PeerConnectionManager` (inbound & outbound, vanilla ICE, tanpa renegotiation, `close()` idempoten).
  DoD: test dengan `RTCPeerConnection` palsu; mic tidak aktif sebelum `enableMic()`.
- [ ] **E7-T3** `DeviceManager` (enumerasi, persist pilihan, `replaceTrack` tanpa renegotiation).
- [ ] **E7-T4** `StatsCollector` + `mos.ts`.
  DoD: unit test MOS terhadap nilai referensi.
- [ ] **E7-T5** `ringtone.ts` berbasis WebAudio (tanpa aset eksternal).
- [ ] **E7-T6** Store `softphone` dengan state machine `06-...` §6.
  DoD: unit test seluruh transisi termasuk jalur error.
- [ ] **E7-T7** Komponen `SoftphoneDock` untuk state IDLE / RINGING_IN / ON_CALL / WRAP_UP + shortcut keyboard + aksesibilitas.
- [ ] **E7-T8** Pre-flight check (`06-...` §4.9) sebelum agent boleh `AVAILABLE`.
- [ ] **E7-T9** Laporan kepatuhan (`iceRole`, `dtlsRole`, codec) dikirim lewat `call.ice_state` dan disimpan di `call_events`.

---

## E8 — Panggilan masuk end-to-end (MILESTONE KRITIS)

- [ ] **E8-T1** ACD minimal: pilih agent `AVAILABLE` pertama yang cocok, kirim `call.offer`, tangani timeout & penolakan, coba kandidat berikutnya.
- [ ] **E8-T2** Rangkai alur penuh sesuai `03-WHATSAPP-CALLING-SPEC.md` §10.
- [ ] **E8-T3** Integration test alur lengkap (12 skenario `09-TESTING-STRATEGY.md` §5.2).
- [ ] **E8-T4** E2E Playwright dengan echo peer lokal + fake media device.
- [ ] **E8-T5** **Uji manual dengan nomor test Meta sungguhan** — panggilan masuk dari HP, audio dua arah, terminate bersih.
  DoD: bukti rekaman layar + log `call_events` lengkap dilampirkan di PR.
- [ ] **E8-T6** Metrik & log jalur kritis: latensi webhook→offer, answer→audio.
  DoD: memenuhi NFR-PERF-002 & NFR-PERF-003 pada pengujian lokal.

---

## E9 — ACD lengkap

- [ ] **E9-T1** Leader election Redis (`acd:leader`) + tick loop 250 ms + graceful handover.
  DoD: test dua worker — tidak pernah double-assign.
- [ ] **E9-T2** Strategi `LONGEST_IDLE`, `ROUND_ROBIN`, `FEWEST_CALLS`, `SKILL_PRIORITY`.
  DoD: unit test per strategi dengan data deterministik.
- [ ] **E9-T3** Skill matching (wajib/opsional + level minimum).
- [ ] **E9-T4** `max_wait_seconds` + `overflow_action` (`REJECT` / `OVERFLOW_QUEUE` / `CALLBACK`).
- [ ] **E9-T5** ZSET antrian + posisi & estimasi waktu tunggu.
- [ ] **E9-T6** Pesan WS `queue.stats` (throttle 1/detik) + `agents.snapshot`.
- [ ] **E9-T7** Penarikan tawaran (`call.retracted`) saat agent disconnect/dipaksa ubah status.

---

## E10 — Wrap-up & disposisi

- [ ] **E10-T1** Migration `CreateDispositionsAndCallbacks`.
- [ ] **E10-T2** CRUD disposisi bertingkat (maks 2 level) + `requires_note`.
- [ ] **E10-T3** State `WRAP_UP`: timer, `require_disposition`, transisi otomatis ke `BUSY` bila lewat waktu tanpa disposisi (BR-010).
- [ ] **E10-T4** `POST /calls/:id/disposition` + catatan + tag.
- [ ] **E10-T5** UI panel wrap-up + `/admin/dispositions`.

---

## E11 — Panggilan keluar & izin

- [ ] **E11-T1** Ledger `call_permissions` + `call_permission_requests` + pelacakan CSW kontak (dibuka oleh pesan **dan** panggilan masuk).
- [ ] **E11-T2** Pre-flight kuota CPR (BR-015) sebelum memanggil API.
  DoD: test permintaan ke-2 dalam 24 jam ditolak tanpa memanggil gateway.
- [ ] **E11-T3** Kirim CPR free-form & template; catat `wamid`.
- [ ] **E11-T4** Pembaruan status izin dari webhook `messages` — **selesaikan OQ-003 dulu**.
- [ ] **E11-T5** Use case `InitiateOutboundCall`: validasi izin & restriction → `call.request_offer` → `POST connect` → simpan `wacid`.
- [ ] **E11-T6** Penanganan `138006` → ledger `UNKNOWN` + tawarkan CPR.
- [ ] **E11-T7** `call.remote_answer` → `setRemoteDescription` di browser; status `RINGING`/`ACCEPTED`/`REJECTED` ke UI.
- [ ] **E11-T8** Hitung `billable_pulses = ceil(duration/6)` untuk OUTBOUND.
- [ ] **E11-T9** Blokir kontak dengan `consecutive_unanswered ≥ 3` sampai ditinjau supervisor.
- [ ] **E11-T10** UI kontak: kartu izin, tombol kirim CPR dengan sisa kuota, tombol telepon dengan alasan nonaktif.
  DoD: E2E alur izin → telepon.

---

## E12 — Rekaman

- [ ] **E12-T1** Migration `CreateMediaAndTranscripts`.
- [ ] **E12-T2** `RecordingPolicyService` (organisasi → antrian override) + validasi `purpose` ≤ 250 dan `announcement_language` dari daftar yang didukung.
  DoD: test menolak `id` sebagai `announcement_language`.
- [ ] **E12-T3** Sisipkan objek `recording` pada `accept`/`connect`.
- [ ] **E12-T4** Handler `call_recording_available` + job `media.download` (verifikasi `sha256`, unggah ke storage, retry backoff, refresh URL via Media API).
  DoD: test hash tidak cocok → `FAILED` dan berkas tidak disimpan; URL 403 → ambil URL baru → sukses.
- [ ] **E12-T5** Job verifikasi harian mendekati batas 7 hari + alert.
- [ ] **E12-T6** Presigned URL pemutaran (TTL 10 menit) + audit unduhan.
- [ ] **E12-T7** Indikator "sedang direkam" di softphone.

---

## E13 — Transkrip & pencarian

- [ ] **E13-T1** Sisipkan objek `transcription`; tangani pengumuman gabungan (nilai diambil dari objek `recording`).
- [ ] **E13-T2** Handler `call_transcription_available` + parsing ke `call_transcripts` + `transcript_segments`.
  DoD: test dengan dokumen berbahasa Indonesia; `speaker`/`channel` benar.
- [ ] **E13-T3** Index FULLTEXT ngram + endpoint pencarian `transcriptQuery`.
  DoD: pencarian potongan kata Bahasa Indonesia mengembalikan hasil relevan.
- [ ] **E13-T4** UI detail panggilan: tab transkrip (segmen, klik-untuk-lompat, penyorotan), tab rekaman (wavesurfer), tab kualitas.

---

## E14 — Retensi & privasi

- [ ] **E14-T1** Job retensi media sesuai `media_retention_days` + penghapusan objek + audit.
- [ ] **E14-T2** Job retensi `call_quality_samples`, `call_events`, `audit_logs`.
- [ ] **E14-T3** Endpoint hapus & ekspor data kontak (`08-SECURITY-COMPLIANCE.md` §8.2).

---

## E15 — Supervisi

- [ ] **E15-T1** `GET /agents/live`, `/queues/live`, `POST /agents/:id/force-status`, `force-logout`.
- [ ] **E15-T2** Wallboard real-time + mode layar penuh.
- [ ] **E15-T3** Halaman monitor agent & antrian.
- [ ] **E15-T4** Pencarian panggilan lanjutan (filter lengkap + pencarian transkrip).

---

## E16 — Analitik & laporan

- [ ] **E16-T1** Migration `CreateAnalyticsAndAudit` + `daily_call_stats`.
- [ ] **E16-T2** Job agregasi harian (zona waktu organisasi) + backfill.
- [ ] **E16-T3** Endpoint laporan (`calls-summary`, `agent-performance`, `queue-performance`, `entry-point-attribution`, `usage`).
- [ ] **E16-T4** Ekspor CSV/XLSX sebagai job + presigned URL + notifikasi.
- [ ] **E16-T5** UI `/supervise/reports` dengan grafik ECharts.

---

## E17 — Entry point

- [ ] **E17-T1** Generator deep link + QR (PNG/SVG) + peringatan keterbatasan desktop & versi client.
- [ ] **E17-T2** Kirim pesan interaktif `voice_call` (validasi `display_text` ≤ 20, `ttl_minutes` 1–43200).
- [ ] **E17-T3** Sinkronisasi & pembuatan template call button (`ttl_minutes` 1440–43200) + handler `message_template_status_update`.
- [ ] **E17-T4** Laporan atribusi payload.
- [ ] **E17-T5** UI `/admin/entry-points` (4 tab) dengan pratinjau menyerupai chat.

---

## E18 — Callback

- [ ] **E18-T1** CRUD callback + pembuatan otomatis dari `NO_ANSWER`/`ABANDONED`/overflow.
- [ ] **E18-T2** Claim, complete, penjadwalan, prioritas.
- [ ] **E18-T3** UI daftar callback di agent desk + integrasi ke alur panggilan keluar.

---

## E19 — Notifikasi & kesehatan sistem

- [ ] **E19-T1** Domain notifikasi + pengiriman in-app (WS) & email.
- [ ] **E19-T2** Pemicu: restriction Meta, gagal arsip media, error rate tinggi, SLA antrian terlampaui, answer rate rendah, token hampir kedaluwarsa.
- [ ] **E19-T3** Preferensi notifikasi per user.
- [ ] **E19-T4** `/platform/health` + metrik Prometheus lengkap + alert rules.

---

## E20 — AI summary & pengerasan rilis

- [ ] **E20-T1** `SummarizerPort` + adapter LLM (dapat dimatikan) — **selesaikan OQ-008 dulu**.
- [ ] **E20-T2** Job `summary.generate` dari transkrip: ringkasan, sentimen, topik, action item, flag kepatuhan.
  DoD: prompt berversi; output divalidasi Zod; kegagalan tidak memblokir apa pun.
- [ ] **E20-T3** UI tab ringkasan + regenerate.
- [ ] **E20-T4** Uji beban (500 webhook/detik, 200 WS, 50 panggilan bersamaan).
- [ ] **E20-T5** Checklist keamanan `08-SECURITY-COMPLIANCE.md` §10 tuntas.
- [ ] **E20-T6** Dokumentasi operasional: runbook, panduan admin, panduan agent (Bahasa Indonesia).
- [ ] **E20-T7** UAT bersama agent sungguhan minimal 3 hari kerja.

---

## E21+ — Fase 2 (opsional, butuh media server)

Prasyarat: ADR baru memilih media server (kandidat: LiveKit, mediasoup, Janus) dan membuktikan kepatuhan syarat media Meta pada leg menuju Meta.

- [ ] **E21** Sisipkan media server sebagai endpoint WebRTC menuju Meta; browser agent terhubung ke media server.
- [ ] **E22** Warm transfer & blind transfer antar agent.
- [ ] **E23** Conference 3 pihak.
- [ ] **E24** Supervisor listen / whisper / barge-in.
- [ ] **E25** IVR: prompt audio + pembacaan DTMF dari RTP (menyelesaikan keterbatasan `OQ-005`).
- [ ] **E26** Musik tunggu & hold sejati.

---

## Urutan dependensi (ringkas)

```
E0 → E1 → E2 → E3 → E4 → E5 → E6 ─┬→ E7 → E8 (MILESTONE)
                                   │
E8 → E9 → E10 → E11 → E12 → E13 → E14
E9 → E15 → E16
E4 → E17
E10 → E18
E12/E13 → E20
semua → E19
```
