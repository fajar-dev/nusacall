# 01 — Product Requirements Document (PRD)

Proyek **NusaCall** — WhatsApp Cloud API Calling Contact Center

---

## 1. Latar belakang & masalah

Bisnis yang sudah memakai WhatsApp Cloud API untuk chat kini bisa menerima dan melakukan **panggilan suara** di nomor yang sama. Namun Meta hanya menyediakan **signaling**; seluruh media suara, distribusi ke agent, pencatatan, dan pelaporan harus dibangun sendiri ("bring your own VoIP system").

Solusi yang ada di pasar mengharuskan hardware (IP phone), softphone desktop, atau PABX. Kebutuhan kita: **semua di browser**, banyak agent, banyak nomor WhatsApp, banyak organisasi, satu aplikasi.

## 2. Visi produk

> Menjadikan browser sebagai satu-satunya perangkat yang dibutuhkan seorang agent untuk melayani panggilan suara WhatsApp — lengkap dengan antrian, konteks pelanggan, rekaman, transkrip, dan pelaporan — tanpa satu pun perangkat keras telepon.

## 3. Tujuan bisnis & metrik keberhasilan

| Tujuan | Metrik | Target rilis 1.0 |
|---|---|---|
| Panggilan masuk terlayani | Answer Rate (dijawab / masuk) | ≥ 85% |
| Respons cepat | Average Speed of Answer (ASA) | ≤ 20 detik |
| Tidak ada panggilan hilang karena sistem | Technical Failure Rate | ≤ 1% |
| Kualitas percakapan | MOS estimasi dari statistik WebRTC | ≥ 3.8 |
| Kepatuhan Meta | Pickup rate cukup tinggi sehingga tombol call tidak disembunyikan Meta | Tidak pernah kena enforcement |
| Efisiensi supervisor | Waktu menemukan rekaman + transkrip suatu kasus | ≤ 30 detik |

## 4. Persona pengguna

| Persona | Peran | Kebutuhan utama |
|---|---|---|
| **Agent (Rina)** | Menjawab & melakukan panggilan | Softphone stabil, konteks pelanggan otomatis muncul, wrap-up cepat, tidak perlu install apa pun |
| **Supervisor (Budi)** | Mengawasi antrian & kualitas | Wallboard real-time, monitor status agent, akses rekaman/transkrip, laporan SLA |
| **Admin Organisasi (Dewi)** | Mengelola konfigurasi | Kelola nomor WA, jam operasional, antrian, skill, user, disposisi |
| **Platform Owner (Tim IT)** | Mengelola seluruh tenant | Kelola organisasi, Meta App, kredensial, kesehatan sistem, audit |
| **Pelanggan (end-user WhatsApp)** | Menelepon bisnis | Bisa menelepon dari chat/deep link, jelas kapan bisa menelepon, tahu kalau direkam |

## 5. Ruang lingkup

### 5.1 In-scope rilis 1.0

- Multi-tenant (banyak organisasi) & multi-WABA (banyak nomor WhatsApp per organisasi)
- Panggilan masuk (UIC): webhook → antrian → routing ke agent → pre-accept → accept → terminate
- Panggilan keluar (BIC): permission ledger → call permission request → dial dari browser
- Softphone berbasis browser (WebRTC) dengan mute, hold*, hangup, DTMF-in, volume, device selector
- ACD: antrian, skill-based routing, strategi distribusi, overflow, jam operasional
- Rekaman & transkripsi native Meta + arsip otomatis ke object storage sendiri
- Disposisi & wrap-up, catatan panggilan, tag
- Wallboard real-time & laporan historis
- Callback request (missed call / di luar jam operasional)
- Direktori kontak + riwayat interaksi
- Manajemen entry point: interactive call button, template call button, deep link generator + QR
- RBAC, audit log, notifikasi
- Sinkronisasi & pengelolaan call settings Meta dari UI
- Monitoring kesehatan integrasi (webhook lag, error rate, restriction Meta)

\* *Hold* pada rilis 1.0 = mute dua arah + musik lokal di sisi agent; hold sejati (menahan pelanggan dengan audio dari server) memerlukan media server → Fase 2.

### 5.2 Out-of-scope rilis 1.0 (Fase 2/3)

| Fitur | Alasan ditunda | Fase |
|---|---|---|
| Warm transfer / attended transfer antar agent | Butuh media server (SFU/B2BUA) | 2 |
| Conference / 3-way | Butuh media server | 2 |
| Supervisor listen / whisper / barge-in | Butuh media server | 2 |
| IVR dengan prompt audio dari server | Butuh media server untuk memainkan audio | 2 |
| Voice bot / AI agent penjawab | Butuh media pipeline + STT/TTS realtime | 3 |
| Video call & screen share | Meta menandai fitur ini masih direncanakan/dalam pengembangan | menunggu Meta |
| Integrasi SIP / bridging ke PABX | Tidak dibutuhkan (semua di browser) dan berisiko melanggar larangan PSTN | — |
| Panggilan PSTN | **DILARANG oleh Terms Meta pada leg mana pun** | tidak pernah |

### 5.3 Asumsi

- Nomor bisnis sudah aktif di Cloud API (bukan aplikasi WhatsApp Business).
- Organisasi sudah memenuhi syarat kelayakan calling dari Meta (messaging limit) atau memakai test number saat pengembangan.
- Agent memakai browser Chromium/Firefox versi terbaru di desktop, dengan mikrofon dan koneksi internet stabil (≥ 300 kbps per panggilan, jitter < 30 ms).
- Aplikasi diakses melalui HTTPS (wajib untuk `getUserMedia`).

## 6. Business rules (BR)

| ID | Aturan |
|---|---|
| BR-001 | Satu agent hanya boleh menangani **satu panggilan aktif** dalam satu waktu pada rilis 1.0. |
| BR-002 | Panggilan masuk hanya diberikan kepada agent berstatus `AVAILABLE` yang memiliki seluruh skill wajib antrian tersebut. |
| BR-003 | Strategi distribusi default adalah **longest-idle** (agent yang paling lama tidak menerima panggilan). |
| BR-004 | Jika tidak ada agent tersedia dalam `queue.max_wait_seconds`, panggilan dialihkan sesuai `overflow_action` (reject sopan + tawarkan callback, atau limpah ke antrian lain). |
| BR-005 | Panggilan masuk WAJIB di-`pre_accept` secepat mungkin setelah agent terpilih, dan di-`accept` hanya setelah agent menekan tombol jawab. |
| BR-006 | Batas waktu menjawab panggilan masuk adalah 30 detik sejak webhook `connect` diterima (buffer aman dari batas 30–60 detik milik Meta). Lewat itu, sistem menghentikan penawaran dan mencatat `NO_ANSWER`. |
| BR-007 | Panggilan keluar hanya boleh dilakukan bila ledger izin lokal berstatus `GRANTED` dan belum kedaluwarsa; kegagalan dengan error `138006` WAJIB langsung membatalkan status lokal menjadi `UNKNOWN`. |
| BR-008 | Rekaman dan transkripsi bersifat opt-in per panggilan dan hanya boleh aktif bila kebijakan organisasi mengizinkan. `purpose` wajib diisi ketika diaktifkan. |
| BR-009 | Rekaman/transkrip WAJIB diunduh dan diarsipkan ke storage sendiri **maksimal 24 jam** setelah webhook tersedia (retensi Meta 7 hari). |
| BR-010 | Setiap panggilan yang berakhir WAJIB masuk state `WRAP_UP`; agent tidak otomatis `AVAILABLE` sebelum disposisi diisi atau `wrap_up_seconds` habis. |
| BR-011 | Endpoint `terminate` WAJIB dipanggil ketika sisi bisnis mengakhiri panggilan, meskipun media sudah berhenti — demi akurasi penagihan. |
| BR-012 | Data antar organisasi tidak boleh saling terlihat dalam kondisi apa pun. |
| BR-013 | Access token Meta tidak pernah dikirim ke frontend dalam bentuk apa pun. |
| BR-014 | Panggilan dari companion device (WhatsApp Web/desktop/tablet) akan ditolak Meta; sistem hanya mencatatnya, tidak menawarkannya ke agent. |
| BR-015 | Jumlah CPR yang dikirim per pasangan (nomor bisnis, kontak) dibatasi oleh sistem sesuai batas Meta (default konservatif: 1 per 24 jam, 2 per 7 hari) sebelum request dikirim. |

## 7. User stories & acceptance criteria

Format: `US-<NNN>` — sebagai <persona>, saya ingin <kebutuhan>, agar <manfaat>.

### 7.1 Agent

**US-001 — Login & pilih status**
Sebagai agent, saya ingin masuk ke aplikasi dan mengatur status kerja, agar panggilan hanya datang ketika saya siap.
*AC:* (1) Login email+password (opsional TOTP). (2) Setelah login, status default `OFFLINE`. (3) Agent bisa memilih `AVAILABLE`, `BREAK` (dengan alasan), `BUSY`. (4) Perubahan status tercatat di `agent_status_events`. (5) Menutup tab/kehilangan koneksi > 30 detik → status otomatis `OFFLINE` dan panggilan yang sedang ditawarkan ditarik.

**US-002 — Menerima panggilan masuk**
Sebagai agent, saya ingin mendapat notifikasi panggilan masuk lengkap dengan identitas penelepon, agar saya siap sebelum menjawab.
*AC:* (1) Muncul panel panggilan masuk berisi nama profil WhatsApp, nomor, nama kontak internal jika ada, antrian, waktu tunggu, dan `cta_payload`/`deeplink_payload` bila ada. (2) Ada nada dering (bisa dimatikan). (3) Hitung mundur sisa waktu menjawab. (4) Tombol **Jawab** dan **Tolak**. (5) Menekan Jawab menyambungkan audio dalam ≤ 1,5 detik.

**US-003 — Kontrol saat panggilan berlangsung**
*AC:* Timer durasi, mute/unmute mikrofon, level meter input & output, tombol akhiri, indikator kualitas jaringan (RTT, packet loss, jitter), indikator rekaman aktif, pilih perangkat audio.

**US-004 — Wrap-up & disposisi**
*AC:* (1) Setelah panggilan berakhir, panel wrap-up muncul otomatis dengan hitung mundur. (2) Agent memilih disposisi (bertingkat), menulis catatan, menambahkan tag. (3) Tombol "Selesai" mengembalikan status ke `AVAILABLE`. (4) Jika waktu habis dan disposisi wajib belum diisi, agent masuk `BUSY` sampai diisi.

**US-005 — Melakukan panggilan keluar**
*AC:* (1) Agent mencari kontak / mengetik nomor. (2) Sistem menampilkan status izin: `Diizinkan (sampai <tgl>)`, `Permanen`, `Belum ada izin`, `Ditolak`. (3) Bila belum ada izin, tersedia tombol "Kirim permintaan izin" (free-form bila CSW terbuka, template bila tidak) dengan indikator sisa kuota permintaan. (4) Bila diizinkan, tombol "Telepon" aktif; sistem membuat SDP offer dari browser lalu memanggil endpoint Meta. (5) UI menampilkan status `RINGING` → `ACCEPTED`/`REJECTED`.

**US-006 — Melihat konteks pelanggan**
*AC:* Saat panggilan datang, panel kanan menampilkan profil kontak, riwayat panggilan sebelumnya (tanggal, durasi, disposisi, ringkasan), catatan, dan tautan ke ID pelanggan eksternal bila terisi.

**US-007 — Menandai callback**
*AC:* Agent dapat membuat permintaan callback dari panggilan mana pun; masuk daftar callback dengan jadwal & pemilik.

### 7.2 Supervisor

**US-010 — Wallboard real-time**
*AC:* Kartu metrik langsung: panggilan aktif, dalam antrian, waktu tunggu terlama, jumlah agent per status, answer rate hari ini, abandon rate. Refresh via WebSocket ≤ 2 detik.

**US-011 — Monitor agent**
*AC:* Tabel semua agent: status, durasi status, panggilan aktif, jumlah panggilan hari ini, AHT, dan tombol paksa-logout / paksa-ubah-status.

**US-012 — Tinjau rekaman & transkrip**
*AC:* (1) Cari panggilan berdasarkan tanggal, agent, antrian, nomor, disposisi, atau **isi transkrip (full-text)**. (2) Pemutar audio dengan waveform. (3) Transkrip tampil per segmen dengan label `[Business]`/`[Customer]`, klik segmen melompat ke posisi audio. (4) Unduh audio & transkrip (tercatat di audit log).

**US-013 — Laporan**
*AC:* Laporan harian/mingguan/bulanan per antrian & per agent, dapat diekspor CSV/XLSX: volume, answer rate, abandon rate, ASA, AHT, wrap-up time, distribusi disposisi, distribusi jam sibuk.

### 7.3 Admin organisasi

**US-020 — Kelola nomor WhatsApp**
*AC:* (1) Daftar nomor beserta status calling, visibilitas ikon, jam operasional, callback permission. (2) Tombol "Sinkronkan dari Meta" (GET settings) dan "Terapkan ke Meta" (POST settings). (3) Menampilkan pembatasan (restriction) aktif dari Meta beserta waktu kedaluwarsa. (4) Editor jam operasional per hari + hari libur.

**US-021 — Kelola antrian, skill, dan routing**
*AC:* CRUD antrian (strategi, wrap-up, max wait, overflow), CRUD skill, assign skill ke agent & antrian, mapping nomor → antrian.

**US-022 — Kelola user & peran**
*AC:* CRUD user, penetapan peran, reset password, nonaktifkan user, lihat sesi aktif.

**US-023 — Kelola disposisi & tag**
*AC:* CRUD disposisi bertingkat (maks 2 level), tandai wajib-catatan, aktif/nonaktif.

**US-024 — Kelola entry point**
*AC:* (1) Generator deep link `wa.me/call/<nomor>` + `biz_payload` + unduh QR PNG/SVG. (2) Kirim interactive call button ke kontak (dengan `display_text`, `ttl_minutes`, `payload`). (3) Daftar template call button yang terdaftar beserta statusnya.

**US-025 — Kebijakan rekaman**
*AC:* Per organisasi & per antrian: rekaman/transkripsi `OFF | OPTIONAL | ALWAYS`, `purpose` default, `announcement_language` default, retensi arsip (hari).

### 7.4 Platform owner

**US-030 — Kelola organisasi & Meta App**
*AC:* CRUD organisasi, daftarkan Meta App (app id, app secret, verify token), tempelkan WABA & nomor, simpan access token terenkripsi, uji koneksi.

**US-031 — Kesehatan sistem**
*AC:* Halaman health: status koneksi DB/Redis/Storage, lag pemrosesan webhook, jumlah job gagal, tingkat error Graph API per nomor, jumlah socket agent terhubung.

---

## 8. Functional requirements

### 8.1 Modul `identity` — autentikasi & otorisasi

| ID | Requirement |
|---|---|
| FR-IDN-001 | Login email + password dengan hash Argon2id. |
| FR-IDN-002 | JWT access token (TTL 15 menit) + refresh token rotasi (TTL 7 hari) disimpan httpOnly cookie `SameSite=Lax`. |
| FR-IDN-003 | Refresh token reuse detection: bila token lama dipakai ulang, seluruh sesi user dicabut. |
| FR-IDN-004 | TOTP 2FA opsional per user; wajib untuk peran `PLATFORM_OWNER`. |
| FR-IDN-005 | Peran: `PLATFORM_OWNER`, `ORG_ADMIN`, `SUPERVISOR`, `AGENT`, `VIEWER`. Permission granular per resource-action (lihat `08-SECURITY-COMPLIANCE.md` §3). |
| FR-IDN-006 | Rate limit login: 5 percobaan gagal / 15 menit / (email + IP), lalu lockout 15 menit. |
| FR-IDN-007 | Semua aksi sensitif tercatat di `audit_logs` (actor, action, resource, before/after, IP, UA). |

### 8.2 Modul `tenancy` — organisasi

| ID | Requirement |
|---|---|
| FR-TEN-001 | Seluruh entitas domain memiliki `organization_id` non-null (kecuali `organizations`, `meta_apps` milik platform, dan tabel sistem). |
| FR-TEN-002 | Setiap request terautentikasi memiliki `TenantContext` yang berisi `organizationId`; repository WAJIB memakainya. |
| FR-TEN-003 | `PLATFORM_OWNER` dapat "impersonate" konteks organisasi tertentu; setiap impersonation tercatat di audit log. |
| FR-TEN-004 | Pengaturan per organisasi: zona waktu, bahasa default, kebijakan rekaman, retensi arsip, batas CPR. |

### 8.3 Modul `wa-accounts` — akun & nomor WhatsApp

| ID | Requirement |
|---|---|
| FR-WA-001 | CRUD Meta App: `app_id`, `app_secret` (terenkripsi), `webhook_verify_token` (terenkripsi). |
| FR-WA-002 | CRUD WABA: `waba_id`, nama, relasi ke Meta App dan organisasi. |
| FR-WA-003 | CRUD nomor: `phone_number_id`, `display_phone_number`, `access_token` (terenkripsi), relasi ke WABA. |
| FR-WA-004 | Uji koneksi: `GET /<PNID>/settings` — sukses menandai `connection_status = HEALTHY`. |
| FR-WA-005 | Sinkronisasi setting calling dari Meta (status, `call_icon_visibility`, `call_icons.restrict_to_user_countries`, `call_hours`, `callback_permission_status`, `restrictions`) ke DB lokal. |
| FR-WA-006 | Terapkan setting ke Meta lewat `POST /<PNID>/settings`; sebelum kirim, validasi lokal (maks 2 entri per hari, `open_time` < `close_time`, tanpa tumpang tindih, maks 20 hari libur, tanggal libur tidak boleh masa lalu). |
| FR-WA-007 | Menangani webhook `account_settings_update` → perbarui cache setting lokal + catat event. |
| FR-WA-008 | Menangani webhook `account_update` (`ACCOUNT_VIOLATION`, `ACCOUNT_RESTRICTION`) → tandai nomor sebagai `RESTRICTED`, simpan alasan & waktu kedaluwarsa, kirim notifikasi ke `ORG_ADMIN` & `PLATFORM_OWNER`. |
| FR-WA-009 | Bila nomor `RESTRICTED`, seluruh upaya panggilan keluar diblok di sisi aplikasi dengan pesan yang jelas. |
| FR-WA-010 | Job terjadwal: sinkronisasi setting seluruh nomor setiap 6 jam. |

### 8.4 Modul `calling` — siklus hidup panggilan

| ID | Requirement |
|---|---|
| FR-CALL-001 | Endpoint webhook publik tunggal `POST /webhooks/meta/:metaAppId` yang memverifikasi `X-Hub-Signature-256` memakai app secret milik Meta App tersebut. |
| FR-CALL-002 | Verifikasi webhook `GET` (hub.mode/hub.verify_token/hub.challenge). |
| FR-CALL-003 | Webhook diterima → simpan mentah ke `webhook_events` → balas `200` dalam ≤ 500 ms → proses asinkron via queue. Payload duplikat (kombinasi hash) diabaikan (idempoten). |
| FR-CALL-004 | Router webhook mendukung field `calls`, `messages`, `account_update`, `account_settings_update`, `message_template_status_update`. |
| FR-CALL-005 | Event `connect` + `direction=USER_INITIATED` → buat entitas `Call` state `QUEUED`, resolusi kontak, tentukan antrian dari mapping nomor, masuk mesin ACD. |
| FR-CALL-006 | ACD memilih agent sesuai BR-002/003; kirim tawaran lewat WebSocket; agent browser membuat SDP answer; backend memanggil `pre_accept`. |
| FR-CALL-007 | Agent menekan Jawab → backend memanggil `accept` dengan **SDP answer yang identik** dengan yang dipakai di `pre_accept`; media baru dialirkan setelah menerima `200 OK`. |
| FR-CALL-008 | Agent menekan Tolak, atau timeout BR-006 → `reject`, panggilan ditawarkan ke agent berikutnya bila masih dalam `max_wait_seconds`. |
| FR-CALL-009 | Event `terminate` → perbarui state, simpan `status`, `start_time`, `end_time`, `duration`, error bila ada; agent masuk `WRAP_UP`. |
| FR-CALL-010 | Agent mengakhiri panggilan → backend memanggil `terminate` (BR-011). |
| FR-CALL-011 | Panggilan keluar: validasi izin → minta SDP offer ke browser agent → `POST /<PNID>/calls` `action=connect` → simpan `wacid` → tunggu webhook `connect` (SDP answer) → kirim ke browser. |
| FR-CALL-012 | Webhook status (`RINGING`/`ACCEPTED`/`REJECTED`) diteruskan ke UI agent secara real-time. |
| FR-CALL-013 | Seluruh event (webhook masuk & aksi keluar) dicatat berurutan di `call_events` sebagai jejak audit yang tidak dapat diubah. |
| FR-CALL-014 | `biz_opaque_callback_data` diisi dengan ID internal panggilan agar dapat direkonsiliasi dari webhook terminate. |
| FR-CALL-015 | Transisi state panggilan dijaga state machine eksplisit; transisi ilegal ditolak dan dicatat sebagai anomali. |
| FR-CALL-016 | Timeout guard: panggilan yang tidak menerima event apa pun selama 2 jam ditandai `STALE` oleh job pembersih. |
| FR-CALL-017 | Sistem mengenali dan memisahkan `deeplink_payload` dan `cta_payload` menjadi konteks routing (mis. payload `BILLING` → antrian Billing). |

### 8.5 Modul `routing` — ACD

| ID | Requirement |
|---|---|
| FR-RTE-001 | CRUD antrian: nama, strategi (`LONGEST_IDLE`, `ROUND_ROBIN`, `FEWEST_CALLS`, `SKILL_PRIORITY`), `max_wait_seconds`, `wrap_up_seconds`, `ring_timeout_seconds`, `overflow_action`, `overflow_queue_id`. |
| FR-RTE-002 | CRUD skill; assign ke agent (dengan level 1–5) dan ke antrian (wajib/opsional + level minimum). |
| FR-RTE-003 | Mapping routing: (nomor bisnis, payload pattern, jam) → antrian. Prioritas aturan bernomor. |
| FR-RTE-004 | Antrian menghormati jam operasional nomor; di luar jam, panggilan tidak akan masuk (Meta sudah memblokir) — namun sistem tetap mencatat percobaan bila webhook tetap diterima. |
| FR-RTE-005 | Status agent real-time disimpan di Redis (sumber kebenaran runtime) dan direplikasi ke MySQL untuk pelaporan. |
| FR-RTE-006 | Mesin ACD berjalan sebagai proses tunggal ter-lock (Redis lock) agar tidak terjadi double-assign saat backend di-scale horizontal. |
| FR-RTE-007 | Antrian menyimpan posisi & estimasi waktu tunggu untuk ditampilkan di wallboard. |

### 8.6 Modul `permissions` — izin panggilan keluar

| ID | Requirement |
|---|---|
| FR-PRM-001 | Ledger izin per (nomor bisnis, kontak): `status` (`UNKNOWN`, `REQUESTED`, `GRANTED_TEMPORARY`, `GRANTED_PERMANENT`, `DENIED`, `REVOKED`), `expires_at`, `source`, `last_request_at`. |
| FR-PRM-002 | Kirim CPR free-form saat CSW terbuka; kirim CPR template saat tertutup. |
| FR-PRM-003 | Pre-flight check kuota CPR (BR-015) sebelum memanggil API; tolak lebih awal dengan pesan jelas. |
| FR-PRM-004 | Respon user terhadap CPR (diterima/ditolak) diperbarui dari webhook `messages`; **lihat OQ-003 sebelum implementasi**. |
| FR-PRM-005 | Error `138006` dari `connect` → set status ledger `UNKNOWN` dan tawarkan kirim CPR. |
| FR-PRM-006 | Sistem melacak CSW per kontak (dibuka/di-refresh oleh pesan masuk **dan oleh panggilan masuk, terjawab maupun tidak**). |

### 8.7 Modul `media` — rekaman & transkrip

| ID | Requirement |
|---|---|
| FR-MED-001 | Saat `accept`/`connect`, sertakan objek `recording` dan/atau `transcription` sesuai kebijakan organisasi & antrian. |
| FR-MED-002 | `purpose` wajib (maks 250 karakter) dan `announcement_language` wajib bila diaktifkan; nilai default dikonfigurasi per organisasi. |
| FR-MED-003 | Webhook `call_recording_available` → job unduh: pakai `url` (berlaku 5 menit); bila gagal/expired, ambil URL baru via Media API dengan `audio.id`. |
| FR-MED-004 | Verifikasi integritas berkas dengan `sha256` sebelum disimpan; simpan ke object storage dengan key `org/{orgId}/calls/{callId}/recording.ogg`. |
| FR-MED-005 | Webhook `call_transcription_available` → unduh JSON, simpan mentah ke storage, parse ke `call_transcripts` + `transcript_segments`, dan isi kolom full-text. |
| FR-MED-006 | Retry unduh dengan exponential backoff, maksimum 8 percobaan dalam 24 jam; kegagalan final memicu alert. |
| FR-MED-007 | Job harian memverifikasi tidak ada media yang mendekati batas 7 hari tanpa terarsip. |
| FR-MED-008 | Pencarian transkrip full-text (MySQL FULLTEXT dengan parser `ngram` agar mendukung Bahasa Indonesia dan potongan kata). |
| FR-MED-009 | (Nilai tambah) Ringkasan otomatis panggilan dari transkrip: ringkasan 3 kalimat, sentimen, topik, indikator kepatuhan script. Dijalankan asinkron, dapat dimatikan per organisasi. Provider LLM abstrak di balik port `SummarizerPort` (lihat OQ-008). |
| FR-MED-010 | Indikator "sedang direkam" tampil di UI agent selama rekaman aktif. |

### 8.8 Modul `contacts`

| ID | Requirement |
|---|---|
| FR-CNT-001 | Kontak unik per (organisasi, `wa_id`). Dibuat otomatis pada panggilan/pesan pertama. |
| FR-CNT-002 | Field: nama profil WA, nama internal, `external_customer_id`, email, catatan, tag, atribut kustom (JSON). |
| FR-CNT-003 | Impor CSV & ekspor CSV dengan validasi nomor E.164. |
| FR-CNT-004 | Halaman detail kontak menampilkan linimasa interaksi (panggilan, CPR, callback, catatan). |
| FR-CNT-005 | Pencarian kontak: nomor, nama, `external_customer_id`, tag. |

### 8.9 Modul `callbacks`

| ID | Requirement |
|---|---|
| FR-CBK-001 | Callback dibuat otomatis untuk panggilan `NO_ANSWER`/`ABANDONED` (dapat dikonfigurasi) dan manual oleh agent. |
| FR-CBK-002 | Field: kontak, nomor bisnis, prioritas, jadwal, pemilik, status (`PENDING`, `SCHEDULED`, `IN_PROGRESS`, `DONE`, `CANCELLED`), catatan. |
| FR-CBK-003 | Antrian callback muncul di dashboard agent; klik untuk memulai alur panggilan keluar. |
| FR-CBK-004 | Sistem menampilkan peringatan jika kontak belum memiliki izin panggilan. |

### 8.10 Modul `analytics`

| ID | Requirement |
|---|---|
| FR-ANL-001 | Metrik real-time via WebSocket: panggilan aktif, dalam antrian, waktu tunggu terlama, agent per status. |
| FR-ANL-002 | Agregasi harian ke tabel `daily_call_stats` melalui job tengah malam (zona waktu organisasi). |
| FR-ANL-003 | Laporan: volume per jam/hari, answer rate, abandon rate, ASA, AHT, ACW (wrap-up), distribusi disposisi, kinerja per agent, kinerja per antrian. |
| FR-ANL-004 | Ekspor CSV & XLSX; ekspor besar dijalankan sebagai job dengan notifikasi unduhan. |
| FR-ANL-005 | Ambil `call_analytics` dari WhatsApp Business Account API untuk rekonsiliasi biaya; tampilkan estimasi menit terpakai per nomor (**lihat OQ-006**). |

### 8.11 Modul `entrypoints`

| ID | Requirement |
|---|---|
| FR-EPT-001 | Generator deep link `wa.me/call/<display_phone_number>` dengan `biz_payload` opsional + pratinjau + unduh QR (PNG & SVG). |
| FR-EPT-002 | Kirim pesan interaktif `voice_call` (validasi: `display_text` ≤ 20 karakter, `ttl_minutes` 1–43200). |
| FR-EPT-003 | Kelola & kirim template call button (`ttl_minutes` 1440–43200 saat pembuatan). |
| FR-EPT-004 | Katalog payload: definisikan payload bermakna (mis. `SUPPORT_GANGGUAN`) yang dipetakan ke antrian, agar `cta_payload`/`deeplink_payload` bisa dipakai routing (FR-CALL-017) dan pelaporan atribusi. |
| FR-EPT-005 | Laporan atribusi: jumlah panggilan per payload/entry point. |
| FR-EPT-006 | Peringatan di UI bahwa deep link tidak berfungsi di WhatsApp desktop dan payload butuh client ≥ 2.25.27. |

### 8.12 Modul `notifications`

| ID | Requirement |
|---|---|
| FR-NTF-001 | Notifikasi in-app (WebSocket) + email untuk: pembatasan Meta, kegagalan arsip media, token hampir kedaluwarsa, error rate tinggi, antrian melampaui SLA. |
| FR-NTF-002 | Preferensi notifikasi per user. |

---

## 9. Non-functional requirements

### 9.1 Performa

| ID | Requirement |
|---|---|
| NFR-PERF-001 | Endpoint webhook membalas `200` dalam **p95 ≤ 300 ms**, p99 ≤ 500 ms. |
| NFR-PERF-002 | Dari webhook `connect` diterima sampai tawaran muncul di layar agent: **p95 ≤ 1,5 detik**. |
| NFR-PERF-003 | Dari agent menekan Jawab sampai audio dua arah: **p95 ≤ 1,5 detik**. |
| NFR-PERF-004 | API internal (list/detail) p95 ≤ 300 ms pada 100 ribu baris panggilan. |
| NFR-PERF-005 | Satu instance backend mendukung ≥ 200 agent terkoneksi WebSocket bersamaan. |
| NFR-PERF-006 | Sistem menangani ≥ 50 panggilan bersamaan per instance backend tanpa degradasi (media tidak melewati backend). |

### 9.2 Ketersediaan & keandalan

| ID | Requirement |
|---|---|
| NFR-REL-001 | Backend stateless; state runtime di Redis sehingga dapat di-scale horizontal. |
| NFR-REL-002 | Pemrosesan webhook idempoten & at-least-once dengan dead-letter queue. |
| NFR-REL-003 | Graceful shutdown: berhenti menerima koneksi baru, selesaikan job berjalan, beri tahu agent untuk reconnect. |
| NFR-REL-004 | Frontend melakukan auto-reconnect WebSocket dengan exponential backoff + resync state penuh. |
| NFR-REL-005 | Kehilangan koneksi backend TIDAK memutus panggilan yang sedang berlangsung (media peer-to-peer ke Meta); UI menampilkan mode degradasi. |

### 9.3 Keamanan

| ID | Requirement |
|---|---|
| NFR-SEC-001 | Seluruh trafik HTTPS/WSS. HSTS aktif. |
| NFR-SEC-002 | Rahasia (app secret, access token, verify token) dienkripsi at-rest dengan AES-256-GCM, kunci dari env/KMS, mendukung rotasi kunci. |
| NFR-SEC-003 | Verifikasi `X-Hub-Signature-256` wajib; payload gagal verifikasi dibuang dan dicatat. |
| NFR-SEC-004 | Validasi input seluruh endpoint dengan Zod. |
| NFR-SEC-005 | Rate limiting per IP dan per user pada endpoint publik & mutasi. |
| NFR-SEC-006 | Tidak ada rahasia di log; redaksi otomatis untuk field sensitif (token, SDP, secret). |
| NFR-SEC-007 | Dependency scanning & audit di CI. |

### 9.4 Observability

| ID | Requirement |
|---|---|
| NFR-OBS-001 | Structured logging JSON (pino) dengan `correlationId`, `organizationId`, `callId`. |
| NFR-OBS-002 | Metrik Prometheus di `/metrics`: durasi webhook, jumlah panggilan per state, lag antrian job, error Graph API per kode. |
| NFR-OBS-003 | Health check `/health/live` & `/health/ready`. |
| NFR-OBS-004 | Statistik WebRTC (RTT, jitter, packet loss, MOS estimasi) dikirim dari browser tiap 5 detik dan disimpan per panggilan. |

### 9.5 Kualitas kode & maintainability

| ID | Requirement |
|---|---|
| NFR-MNT-001 | Clean architecture berlapis; domain tidak bergantung pada framework (lihat `02-ARCHITECTURE.md`). |
| NFR-MNT-002 | TypeScript `strict: true`, tanpa `any` implisit maupun eksplisit (kecuali di boundary dengan komentar justifikasi). |
| NFR-MNT-003 | Coverage: domain & application layer ≥ 90%, keseluruhan ≥ 75%. |
| NFR-MNT-004 | Tidak ada file > 400 baris dan fungsi > 50 baris tanpa justifikasi. |
| NFR-MNT-005 | Seluruh kontrak eksternal (Meta) terisolasi di satu adapter yang dapat di-mock. |

### 9.6 Aksesibilitas & UX

| ID | Requirement |
|---|---|
| NFR-UX-001 | Kontras WCAG 2.1 AA; seluruh aksi softphone dapat diakses via keyboard. |
| NFR-UX-002 | Bahasa antarmuka default **Indonesia**, tersedia English (i18n). |
| NFR-UX-003 | Dukungan mode gelap. |
| NFR-UX-004 | Softphone tetap terlihat (docked) di semua halaman aplikasi. |
| NFR-UX-005 | Peringatan eksplisit bila izin mikrofon ditolak atau perangkat tidak terdeteksi, dengan panduan perbaikan. |

### 9.7 Kepatuhan

| ID | Requirement |
|---|---|
| NFR-CMP-001 | Tidak ada leg PSTN dalam bentuk apa pun. |
| NFR-CMP-002 | Rekaman hanya dengan pengumuman resmi dari Meta (tidak boleh merekam diam-diam di sisi browser). |
| NFR-CMP-003 | Retensi arsip dapat dikonfigurasi, dengan penghapusan otomatis setelah masa retensi. |
| NFR-CMP-004 | Ekspor/penghapusan data per kontak untuk memenuhi permintaan subjek data. |

---

## 10. Alur pengalaman utama (happy path)

### 10.1 Panggilan masuk

```
Pelanggan tekan tombol call di chat
  → Meta kirim webhook `calls.connect` (SDP offer, direction=USER_INITIATED)
  → Backend simpan webhook, balas 200, enqueue job
  → Job: resolve nomor → organisasi, resolve kontak, tentukan antrian (mapping + payload)
  → Call state QUEUED → ACD pilih agent (AVAILABLE + skill cocok, longest idle)
  → Call state OFFERING; WS `call.offer` ke browser agent (berisi SDP offer)
  → Browser buat RTCPeerConnection + track mic (mute), setRemote(offer), createAnswer
  → WS `call.answer_sdp` ke backend
  → Backend POST /calls action=pre_accept (SDP answer)  → state PRE_ACCEPTED
  → UI agent berdering; agent tekan Jawab
  → Backend POST /calls action=accept (SDP answer IDENTIK) + objek recording/transcription
  → 200 OK → WS `call.accepted` → browser unmute mic → audio dua arah → state ACTIVE
  → Salah satu pihak menutup → webhook `calls.terminate` (+ POST terminate bila dari sisi bisnis)
  → state WRAP_UP → agent isi disposisi → state COMPLETED, agent AVAILABLE
  → Webhook `call_recording_available` / `call_transcription_available` → job arsip → tersedia di UI
```

### 10.2 Panggilan keluar

```
Agent buka kontak → sistem cek ledger izin
  → (bila perlu) kirim CPR free-form/template, tunggu persetujuan user
  → Agent tekan Telepon → WS `call.request_offer` ke browser
  → Browser createOffer (mic aktif, mute) → WS `call.offer_sdp` ke backend
  → Backend POST /calls action=connect (to, SDP offer, biz_opaque_callback_data, recording/transcription)
  → Response berisi wacid → state DIALING
  → Webhook `calls.connect` (SDP answer) → WS ke browser → setRemoteDescription
  → Webhook status RINGING → UI "berdering"
  → Webhook status ACCEPTED → state ACTIVE, browser unmute
  → Terminate seperti alur masuk
```

---

## 11. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kualitas jaringan agent buruk | Panggilan putus/berkualitas rendah | Monitoring WebRTC stats + peringatan dini + pre-call network test |
| Pickup rate rendah → Meta menyembunyikan tombol call | Kehilangan kanal | Alert saat answer rate < ambang, `call_hours` realistis, callback otomatis |
| Feedback negatif user → nomor dibekukan 7 hari | Layanan berhenti | Kontrol ketat panggilan keluar, wajib izin, monitoring `account_update` |
| Batas 30–60 detik untuk menjawab | Panggilan hilang | Timeout internal 30 detik + antrian responsif + pre-accept segera |
| Retensi media Meta 7 hari | Kehilangan bukti | Job arsip dalam 24 jam + verifikasi harian + alert |
| SDP answer `accept` ≠ `pre_accept` | Panggilan gagal | Simpan SDP answer di Redis per `wacid`, gunakan ulang, jangan generate ulang |
| Perubahan API Meta | Regresi | Adapter terisolasi + contract test + halaman changelog dipantau |
| Double-assign panggilan saat scale-out | Dua agent dapat panggilan sama | Distributed lock Redis pada mesin ACD |
| Browser tidak mendukung codec/ICE sesuai syarat | Panggilan gagal | Pre-flight capability check + daftar browser yang didukung |

---

## 12. Definisi rilis

**MVP (Fase 1)** — dianggap siap produksi bila: US-001..US-007, US-010..US-013, US-020..US-025, US-030..US-031 lulus AC; seluruh NFR §9.1–9.5 terpenuhi; test suite hijau; runbook operasional tersedia.
