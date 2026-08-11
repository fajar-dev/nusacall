# RULES.md — Seluruh Aturan Wajib (Terkonsolidasi)

Dokumen ini mengumpulkan **semua aturan yang mengikat** dari dokumen 00–13 ke dalam satu daftar bernomor, agar mudah dirujuk saat review dan tidak ada yang terlewat.

**Cara membaca:**
- `R-xxx` = nomor aturan. Kutip nomor ini saat review PR.
- **Tingkat:** 🔴 **MUTLAK** (pelanggaran = PR ditolak) · 🟠 **WAJIB** (perlu justifikasi tertulis untuk menyimpang) · 🟡 **DEFAULT** (boleh menyimpang bila ada alasan teknis yang dicatat)
- Kolom **Sumber** menunjuk dokumen asal untuk konteks lengkap.

---

## A. Integrasi Meta WhatsApp Cloud API Calling

| # | Tingkat | Aturan | Sumber |
|---|---|---|---|
| R-001 | 🔴 | Dilarang memakai endpoint, field, atau perilaku Meta yang tidak tercantum di dokumen 03. Kebutuhan di luar itu wajib jadi Open Question. | 03 |
| R-002 | 🔴 | Verifikasi `X-Hub-Signature-256` wajib pada setiap webhook, dihitung dari **raw body** sebelum parsing JSON, dengan perbandingan timing-safe. | 03 §4, 08 §5 |
| R-003 | 🔴 | Webhook dengan signature tidak valid: simpan dengan `signature_valid = 0`, status `SKIPPED`, tetap balas `200`, jangan diproses. | 08 §5 |
| R-004 | 🔴 | Endpoint webhook wajib balas `200` dalam ≤ 300 ms (p95); seluruh pemrosesan asinkron lewat queue. | 01 NFR-PERF-001 |
| R-005 | 🔴 | Pemrosesan webhook wajib idempoten. Dedupe key = `sha256(rawBody)` dengan unique constraint. | 02 §7.1 |
| R-006 | 🔴 | SDP answer untuk `accept` **wajib identik** dengan yang dipakai `pre_accept`. Ambil dari cache Redis `sdp:answer:{wacid}`; dilarang generate ulang. | 03 §3.1c, ADR-002 |
| R-007 | 🔴 | Bila cache SDP kosong saat `accept`: lempar `SDP_ANSWER_MISSING` dan `reject` panggilan. Jangan membuat answer baru. | 06 §3.1 |
| R-008 | 🟠 | `pre_accept` selalu dipanggil sebelum `accept`, untuk mencegah audio clipping. | 03 §3.1b |
| R-009 | 🔴 | Media baru boleh dialirkan setelah `accept` mengembalikan `200 OK`. | 03 §3.1c |
| R-010 | 🔴 | `terminate` wajib dipanggil saat sisi bisnis mengakhiri panggilan, meskipun media sudah berhenti (akurasi penagihan). | 03 §3.1e, BR-011 |
| R-011 | 🟠 | Sebelum `accept` gunakan `reject`; sesudah `accept` gunakan `terminate`. (Asumsi OQ-013) | 13 §3 |
| R-012 | 🔴 | Batas waktu menjawab internal 30 detik sejak webhook `connect`. | BR-006 |
| R-013 | 🔴 | `biz_opaque_callback_data` diisi `call.id` internal (ULID) pada setiap request yang mendukungnya. | ADR-009 |
| R-014 | 🔴 | Codec audio hanya Opus 48 kHz, ptime 20 ms, DTMF clock rate 8 kHz. | 03 §8 |
| R-015 | 🔴 | SDP munging hanya boleh: buang codec non-Opus/non-telephone-event, paksa `ptime`/`maxptime` 20, set `fmtp` Opus. Baris `a=setup`, `a=ice-*`, `a=fingerprint`, `a=candidate`, `a=mid`, `c=`, `o=` tidak boleh diubah. | 06 §4.3 |
| R-016 | 🔴 | Vanilla ICE (non-trickle): tunggu ICE gathering selesai (batas 3 detik) sebelum mengirim SDP. | ADR-003 |
| R-017 | 🔴 | Dilarang `restartIce()` atau renegotiation pada panggilan aktif; kandidat tidak boleh berganti di tengah panggilan. | 03 §8.1, 06 §4.5 |
| R-018 | 🔴 | Nomor dengan `sip.status = ENABLED` tidak boleh dipakai aplikasi; tolak dengan pesan jelas. | 03 §1, ADR-013 |
| R-019 | 🔴 | Dilarang mengimplementasikan SIP, gateway PSTN, atau transfer ke nomor telepon konvensional. | 08 §8.3, ADR-013 |
| R-020 | 🟠 | Validasi `call_hours` di sisi aplikasi sebelum dikirim ke Meta: maks 2 entri/hari, `open_time` < `close_time`, tanpa tumpang tindih, maks 20 hari libur, tanggal libur tidak boleh lampau. | 03 §3.2 |
| R-021 | 🟠 | `holiday_schedule` yang tidak dikirim akan **menghapus** jadwal libur di Meta — selalu kirim state lengkap. | 03 §3.2 |
| R-022 | 🔴 | `announcement_language` hanya boleh dari daftar yang didukung Meta. `id` (Bahasa Indonesia) **tidak** termasuk. | 03 §5.2, ADR-012 |
| R-023 | 🔴 | `purpose` wajib diisi bila rekaman/transkripsi `ENABLED`, maksimal 250 karakter. | 03 §5.1 |
| R-024 | 🔴 | Rekaman & transkrip wajib diarsipkan ke storage sendiri dalam ≤ 24 jam (retensi Meta hanya 7 hari). | BR-009, 01 FR-MED-003 |
| R-025 | 🔴 | Verifikasi `sha256` berkas media sebelum disimpan; hash tidak cocok → `FAILED`, berkas dibuang. | 01 FR-MED-004 |
| R-026 | 🟠 | Panggilan keluar hanya bila ledger izin `GRANTED_*` dan belum kedaluwarsa. Error `138006` → set ledger `UNKNOWN`. | BR-007, 01 FR-PRM-005 |
| R-027 | 🔴 | Kuota CPR ditegakkan di sisi aplikasi **sebelum** memanggil API (default konservatif: 1/hari, 2/minggu per pasangan nomor+kontak). | BR-015 |
| R-028 | 🟠 | Nomor berstatus `RESTRICTED` memblokir seluruh panggilan keluar di sisi aplikasi. | 01 FR-WA-009 |
| R-029 | 🟡 | Retry Graph API hanya untuk 5xx/timeout/429 (maks 2, backoff 300 ms & 900 ms); **tidak pernah** untuk 4xx. | 03 §13 |
| R-030 | 🔴 | Panggilan dari companion device ditolak Meta — hanya dicatat, tidak ditawarkan ke agent. | BR-014 |

---

## B. Arsitektur & struktur kode

| # | Tingkat | Aturan | Sumber |
|---|---|---|---|
| R-040 | 🔴 | Media WebRTC tidak pernah melewati backend. Backend hanya signaling, orkestrasi, dan pencatatan. | ADR-001 |
| R-041 | 🔴 | Arah ketergantungan: `domain ← application ← interface`; `infrastructure` mengimplementasi port. Ditegakkan `eslint-plugin-boundaries`. | 02 §5 |
| R-042 | 🔴 | `domain` tidak boleh mengimpor framework apa pun (Hono, TypeORM, Vue). | 02 §5 |
| R-043 | 🔴 | Lintas modul hanya lewat `application/use-cases` atau domain event. Dilarang mengimpor `infrastructure` modul lain. | 02 §5 |
| R-044 | 🔴 | Domain entity terpisah dari ORM entity; konversi lewat mapper eksplisit. | 04 §5 |
| R-045 | 🔴 | Satu use case = satu file = satu kelas dengan satu metode publik `execute`. | 11 §3 |
| R-046 | 🔴 | Konstruktor use case hanya menerima port (interface), bukan implementasi konkret. | 11 §3 |
| R-047 | 🔴 | `Clock` di-inject; dilarang `new Date()` langsung di domain/application. | 11 §3 |
| R-048 | 🔴 | `process.env` hanya boleh diakses di `bootstrap/config.ts`, divalidasi Zod, gagal start bila tidak valid. | 02 §4.1, 10 §3 |
| R-049 | 🔴 | Panggilan Graph API dilarang berada di dalam transaksi database. | 02 §8 |
| R-050 | 🟠 | Domain event dipublikasikan setelah commit, lewat outbox `domain_events`. | 02 §8 |
| R-051 | 🔴 | State runtime (status agent, antrian, registry socket, cache SDP) disimpan di Redis; backend tetap stateless. | ADR-006 |
| R-052 | 🔴 | Mesin ACD berjalan di bawah leader election Redis agar tidak terjadi double-assign. | ADR-007, FR-RTE-006 |
| R-053 | 🔴 | Transisi state panggilan dijaga `CallStateMachine`; transisi ilegal melempar error dan dicatat. | FR-CALL-015 |
| R-054 | 🔴 | `call_events` bersifat append-only — dilarang UPDATE atau DELETE. | 04 §4.19 |
| R-055 | 🟠 | Adapter Meta terisolasi di satu tempat dan dapat di-mock sepenuhnya. | NFR-MNT-005 |

---

## C. Multi-tenancy & data

| # | Tingkat | Aturan | Sumber |
|---|---|---|---|
| R-060 | 🔴 | Setiap tabel domain punya `organization_id NOT NULL` dengan index. | FR-TEN-001 |
| R-061 | 🔴 | Semua akses data lewat repository yang menerima `TenantContext`; dilarang `getRepository()` langsung di use case. | 04 §3 |
| R-062 | 🔴 | Setiap repository wajib punya test negatif "tidak mengembalikan data organisasi lain". | 09 §5.3 |
| R-063 | 🔴 | `synchronize: false` selamanya; seluruh perubahan skema lewat migration. | 04 |
| R-064 | 🔴 | Setiap migration punya `up` **dan** `down` yang benar dan teruji. | 04 §6 |
| R-065 | 🟠 | Perubahan skema pada tabel besar memakai pola expand–migrate–contract. | 04 §6, 10 §9.7 |
| R-066 | 🔴 | Primary key = ULID `CHAR(26)`; timestamp disimpan UTC. | 04 §1 |
| R-067 | 🔴 | Impersonation tenant oleh Platform Owner wajib tercatat di audit log dengan alasan. | 08 §3 |
| R-068 | 🟠 | Seed data wajib idempoten (aman dijalankan berulang). | 04 §7 |
| R-069 | 🟠 | Kebijakan retensi dijalankan job terjadwal sesuai tabel di dokumen 04 §8. | 04 §8 |

---

## D. Keamanan

| # | Tingkat | Aturan | Sumber |
|---|---|---|---|
| R-080 | 🔴 | Access token & app secret Meta tidak pernah dikirim ke frontend dalam bentuk apa pun. | BR-013 |
| R-081 | 🔴 | Rahasia dienkripsi at-rest dengan AES-256-GCM, kunci dari env/KMS, mendukung rotasi. | NFR-SEC-002 |
| R-082 | 🔴 | Token hanya diambil lewat `TokenResolver`; nilai terdekripsi tidak boleh di-cache tanpa TTL (maks 5 menit) dan tidak boleh disimpan di variabel modul. | 08 §4 |
| R-083 | 🔴 | Dilarang me-log: password, token, app secret, verify token, SDP, TOTP secret, recovery code, cookie, authorization header. | 08 §7 |
| R-084 | 🔴 | SDP disimpan sebagai `sha256` di `call_events`, tidak pernah isi penuhnya. | 08 §7 |
| R-085 | 🔴 | Password di-hash Argon2id; refresh token disimpan hash-nya saja, dengan rotasi dan deteksi reuse. | 08 §2 |
| R-086 | 🔴 | Seluruh input eksternal (HTTP, WS, webhook, job payload, env) divalidasi Zod. Dilarang type assertion pada data eksternal. | NFR-SEC-004, 11 §1 |
| R-087 | 🔴 | Setiap route mendeklarasikan permission yang dibutuhkan secara eksplisit. | 08 §3 |
| R-088 | 🔴 | Agent hanya boleh membaca panggilan miliknya sendiri — ditegakkan di query, bukan di UI. | 08 §3 |
| R-089 | 🔴 | Rate limiting aktif pada seluruh grup endpoint sesuai tabel dokumen 05 §5. | 05 §5 |
| R-090 | 🔴 | Query hanya lewat query builder/parameterized; `query()` mentah dilarang tanpa ADR. | 08 §6 |
| R-091 | 🔴 | Unduhan media hanya dari domain allowlist (`lookaside.fbsbx.com`, `graph.facebook.com`). | 08 §6 |
| R-092 | 🔴 | Akses & unduhan rekaman wajib tercatat di audit log. | 08 §8.1 |
| R-093 | 🔴 | Presigned URL rekaman TTL maksimal 10 menit. | 05 §3.6 |

---

## E. Kepatuhan & etika produk

| # | Tingkat | Aturan | Sumber |
|---|---|---|---|
| R-100 | 🔴 | Rekaman **hanya** lewat fitur native Meta yang memutar pengumuman persetujuan. `MediaRecorder` dilarang di seluruh kode frontend. | ADR-008, 08 §8.1 |
| R-101 | 🔴 | Tidak ada leg PSTN dalam bentuk apa pun. | NFR-CMP-001 |
| R-102 | 🟠 | `purpose` rekaman harus mencerminkan tujuan sebenarnya dan ditinjau admin organisasi. | 08 §8.1 |
| R-103 | 🟠 | Retensi arsip dapat dikonfigurasi dengan penghapusan otomatis setelah masa retensi. | NFR-CMP-003 |
| R-104 | 🟠 | Tersedia ekspor & penghapusan data per kontak untuk permintaan subjek data. | NFR-CMP-004 |
| R-105 | 🟠 | Sistem memblokir panggilan keluar ke kontak dengan `consecutive_unanswered ≥ 3` sampai ditinjau supervisor (menjaga reputasi nomor). | 08 §8.4 |
| R-106 | 🟠 | Alert wajib saat answer rate harian < 70% atau ada indikasi penegakan dari Meta. | 08 §8.4 |

---

## F. Realtime & softphone

| # | Tingkat | Aturan | Sumber |
|---|---|---|---|
| R-120 | 🔴 | Track mikrofon tidak boleh aktif sebelum browser menerima `call.accepted`. | 06 §3.1 |
| R-121 | 🔴 | Browser tidak boleh membuat ulang SDP answer setelah dikirim; kegagalan → `call.media_error` dan backend `reject`. | 06 §3.1 |
| R-122 | 🔴 | Hanya pesan WebSocket yang terdaftar di `packages/ws-protocol` yang boleh dikirim; semua divalidasi Zod. | 06 §1.1, §7 |
| R-123 | 🔴 | Server memvalidasi kepemilikan `callId` pada setiap pesan klien; pelanggaran → tutup koneksi + audit log. | 06 §2.3 |
| R-124 | 🟠 | Klien harus idempoten terhadap pesan server (deduplikasi berdasarkan `id`, simpan 200 id terakhir). | 06 §1.2 |
| R-125 | 🟠 | Reconnect WebSocket memakai exponential backoff + jitter, diikuti `client.resync` state penuh. | NFR-REL-004 |
| R-126 | 🔴 | Kehilangan koneksi backend tidak boleh memutus panggilan aktif; UI masuk mode degradasi. | NFR-REL-005 |
| R-127 | 🔴 | `PeerConnectionManager` tidak boleh mengetahui WebSocket maupun store — hanya menerima & mengembalikan SDP. | 06 §5 |
| R-128 | 🔴 | Store `softphone` adalah satu-satunya pemilik `PeerConnectionManager`; state tidak diduplikasi di komponen. | 07 §5, 06 §6 |
| R-129 | 🟠 | Ganti perangkat input memakai `replaceTrack`, tidak boleh memicu renegotiation. | 06 §4.6 |
| R-130 | 🟠 | Pre-flight check wajib lulus sebelum agent boleh berstatus `AVAILABLE`. | 06 §4.9 |
| R-131 | 🔴 | Nada dering dibangkitkan WebAudio; dilarang aset audio eksternal. | 07 §9 |
| R-132 | 🟠 | Laporan kepatuhan (`iceRole`, `dtlsRole`, codec) dikirim tiap panggilan dan dicatat. | 06 §4.4 |

---

## G. Kualitas kode

| # | Tingkat | Aturan | Sumber |
|---|---|---|---|
| R-150 | 🔴 | `any` dilarang (implisit maupun eksplisit) kecuali di boundary library dengan komentar justifikasi. | NFR-MNT-002 |
| R-151 | 🔴 | `console.log` dilarang di kode produksi. | 11 §5 |
| R-152 | 🔴 | `TODO` wajib berformat `// TODO(#123): ...`. | 11 §10 |
| R-153 | 🔴 | Dilarang melempar string atau objek biasa — selalu subclass `AppError`. | 11 §4 |
| R-154 | 🔴 | Error dari Meta selalu dibungkus `UpstreamMetaError` dengan `metaCode`, `metaSubcode`, `fbtraceId`. | 11 §4 |
| R-155 | 🟠 | Batas ukuran: file ≤ 400 baris, fungsi ≤ 50 baris, parameter ≤ 4, nesting ≤ 3, complexity ≤ 12. | 11 §7 |
| R-156 | 🟠 | Pesan error untuk pengguna berbahasa Indonesia dan aman ditampilkan; detail teknis di `details` + log. | 05 §1.2 |
| R-157 | 🔴 | Controller tidak memuat logika bisnis — hanya validasi, panggil use case, bentuk respons. | 05 §4 |
| R-158 | 🔴 | Format respons & error API konsisten sesuai dokumen 05 §1. | 05 §1 |
| R-159 | 🟠 | Endpoint aksi panggilan & pengiriman pesan wajib menerima `Idempotency-Key`. | 05 §1.5 |
| R-160 | 🔴 | Frontend wajib `<script setup lang="ts">`, nama komponen multi-kata berprefiks domain. | 11 §9 |
| R-161 | 🔴 | Komponen tidak melakukan fetch data domain langsung — lewat composable. | 07 §5 |
| R-162 | 🔴 | Seluruh teks UI lewat i18n; dilarang hard-code teks di komponen. | 07 §10 |
| R-163 | 🟠 | Komponen dasar berasal dari Mantine Vue; dilarang membuat ulang dari nol. | 07 §4.2 |
| R-164 | 🟠 | Ikon hanya dari Tabler Icons; emoji tidak boleh dipakai sebagai ikon fungsional. | 07 §4.3 |
| R-165 | 🟠 | Format tanggal/waktu memakai zona waktu organisasi, bukan zona waktu browser. | 07 §10 |

---

## H. Testing

| # | Tingkat | Aturan | Sumber |
|---|---|---|---|
| R-180 | 🔴 | Dilarang menulis kode tanpa test. DoD dokumen 09 §1 wajib terpenuhi. | 09 §1 |
| R-181 | 🔴 | Test dilarang memanggil Meta sungguhan — selalu MSW. | 09 §4 |
| R-182 | 🔴 | Coverage minimum: domain ≥ 95%, application ≥ 90%, keseluruhan ≥ 75%. | 09 §2 |
| R-183 | 🔴 | Wajib ada test negatif: validasi gagal, tanpa izin, lintas tenant, state ilegal. | 09 §1 |
| R-184 | 🔴 | Test tidak boleh bergantung pada urutan eksekusi. | 09 §9 |
| R-185 | 🔴 | Waktu selalu di-mock untuk logika timeout/retensi; dilarang `setTimeout` nyata atau `sleep` arbitrer. | 09 §9 |
| R-186 | 🟠 | Assertion harus spesifik — bandingkan argumen pemanggilan gateway, bukan sekadar "terpanggil". | 09 §9 |
| R-187 | 🔴 | Setiap perbaikan bug disertai test regresi yang gagal sebelum perbaikan. | 09 §9 |
| R-188 | 🟠 | Fixture webhook memakai payload nyata yang dianonimkan, dan dipakai juga untuk contract test skema Zod. | 09 §6 |
| R-189 | 🔴 | `pnpm verify` wajib hijau sebelum commit. | 09 §8 |

---

## I. DevOps & operasional

| # | Tingkat | Aturan | Sumber |
|---|---|---|---|
| R-200 | 🔴 | Aplikasi gagal start bila ada env yang tidak valid. | 10 §3 |
| R-201 | 🔴 | Reverse proxy wajib `proxy_request_buffering off` pada path webhook agar raw body utuh. | 10 §2.3 |
| R-202 | 🔴 | `backend-scheduler` berjalan **tepat satu replika**. | 10 §2.3 |
| R-203 | 🟠 | MySQL dijalankan dengan `ngram_token_size=2` agar FULLTEXT bekerja untuk Bahasa Indonesia. | 10 §2.1, ADR-010 |
| R-204 | 🟠 | Migration dijalankan sebagai job terpisah sebelum rollout; hindari migrasi destruktif. | 10 §9.7 |
| R-205 | 🟠 | Gate merge CI: lint, typecheck, unit, integration, e2e, security scan wajib hijau. | 10 §6 |
| R-206 | 🟠 | Metrik Prometheus minimum sesuai daftar dokumen 10 §7 wajib tersedia. | 10 §7 |
| R-207 | 🟠 | Graceful shutdown: berhenti terima koneksi baru, selesaikan job, kirim `system.shutdown`, bersihkan registry Redis. | NFR-REL-003 |
| R-208 | 🔴 | Rahasia produksi tidak pernah masuk repositori; `gitleaks` wajib bersih. | 08 §6 |

---

## J. Proses kerja agent

| # | Tingkat | Aturan | Sumber |
|---|---|---|---|
| R-220 | 🔴 | Kerjakan `12-ROADMAP-BACKLOG.md` berurutan; jangan melompat epic. | 00 §7 |
| R-221 | 🔴 | Open Question berstatus **BLOCKING** wajib diselesaikan sebelum menyentuh modul terkait. | 13 §2 |
| R-222 | 🔴 | Asumsi sementara ditandai `// ASSUMPTION(OQ-00X)`. | 13 §3 |
| R-223 | 🔴 | Penyimpangan dari dokumen wajib ditulis sebagai ADR baru. | 00 §1 |
| R-224 | 🔴 | Menambah dependency di luar daftar yang disetujui wajib ADR terlebih dahulu. | 02 §9 |
| R-225 | 🔴 | Commit memakai Conventional Commits, tanpa trailer co-author, mencantumkan ID requirement. | 11 §6 |
| R-226 | 🟠 | Dokumen diperbarui bila kontrak berubah, dan perubahannya disebut di commit. | 00 §1 |
| R-227 | 🔴 | Epic E8 (panggilan masuk end-to-end, terverifikasi dengan nomor test sungguhan) adalah gerbang wajib sebelum epic berikutnya. | 12 |
| R-228 | 🟠 | Prioritas saat requirement bertabrakan: keamanan > kepatuhan Meta > kebenaran data > UX > kinerja. | AGENTS.md §11 |

---

## Ringkasan cepat — 12 aturan yang paling sering dilanggar

1. **R-006** — generate ulang SDP answer saat `accept` → panggilan gagal
2. **R-120** — mengaktifkan mic sebelum `call.accepted` → penelepon dengar suara sebelum diangkat
3. **R-002** — HMAC dihitung dari body hasil parse, bukan raw → semua webhook ditolak
4. **R-061** — query tanpa scope tenant → kebocoran data antar organisasi
5. **R-100** — merekam pakai `MediaRecorder` → melanggar mekanisme persetujuan
6. **R-019** — menambah transfer ke nomor HP → melanggar Terms Meta
7. **R-049** — panggil Graph API di dalam transaksi DB → koneksi DB habis
8. **R-022** — set `announcement_language: "id"` → request ditolak Meta
9. **R-024** — lupa arsip media → hilang permanen setelah 7 hari
10. **R-017** — `restartIce()` saat panggilan aktif → panggilan putus
11. **R-063** — `synchronize: true` "biar cepat" → skema produksi rusak
12. **R-183** — hanya menulis test jalur bahagia → bug lolos ke produksi
