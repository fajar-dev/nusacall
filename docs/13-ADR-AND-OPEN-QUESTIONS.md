# 13 — Architecture Decision Records & Open Questions

---

## 1. Architecture Decision Records (ADR)

Format: keputusan, konteks, alternatif, konsekuensi. Perubahan atas ADR memerlukan ADR baru yang menandai ADR lama sebagai *Superseded*.

---

### ADR-001 — Browser sebagai endpoint WebRTC, tanpa media server (Fase 1)
**Status:** Accepted
**Konteks:** Meta hanya menyediakan signaling; media harus ditangani sendiri. Kebutuhan eksplisit: tanpa hardware, semua di web app.
**Keputusan:** Browser agent menjadi endpoint WebRTC langsung terhadap Meta RTC. Backend hanya merelai SDP dan mengorkestrasi.
**Alternatif yang ditolak:** (a) Media server SFU/B2BUA sejak awal — kompleksitas dan biaya infrastruktur besar sebelum produk terbukti; (b) Bridge ke Asterisk/FreeSWITCH — bertentangan dengan "tanpa perangkat tambahan" dan berisiko dekat dengan larangan PSTN.
**Konsekuensi:** Positif — arsitektur ringan, backend stateless, kegagalan backend tidak memutus panggilan aktif, biaya bandwidth nol. Negatif — transfer, conference, monitoring supervisor, hold sejati, dan IVR DTMF **tidak mungkin** di Fase 1; kualitas bergantung pada jaringan agent. Fase 2 menyisipkan media server tanpa mengubah kontrak signaling backend.

---

### ADR-002 — SDP answer di-cache di Redis, tidak pernah dibuat ulang
**Status:** Accepted
**Konteks:** Meta menolak `accept` bila SDP answer berbeda dari yang dipakai saat `pre_accept`.
**Keputusan:** SDP answer disimpan di `sdp:answer:{wacid}` (TTL 300 detik) saat `pre_accept`; `AcceptCall` hanya boleh membacanya dari cache.
**Konsekuensi:** Menghilangkan kelas bug paling umum pada integrasi ini. Bila cache hilang (Redis restart), panggilan yang belum di-`accept` gagal dan ditolak dengan pesan jelas — dapat diterima karena jendelanya hanya puluhan detik.

---

### ADR-003 — Vanilla ICE (non-trickle)
**Status:** Accepted
**Konteks:** Tidak ada kanal trickle ICE dalam kontrak Meta; SDP dipertukarkan sekali lewat Graph API/webhook.
**Keputusan:** Browser menunggu ICE gathering selesai (batas 3 detik) sebelum mengirim SDP ke backend.
**Konsekuensi:** Menambah latensi ratusan milidetik. Karena `pre_accept` terjadi sebelum agent mengangkat, latensi ini tersembunyi dari pelanggan. Batas 3 detik mencegah blocking bila ada kandidat yang lambat.

---

### ADR-004 — Modular monolith, bukan microservice
**Status:** Accepted
**Konteks:** Tim kecil, batas domain masih berevolusi, kebutuhan latensi rendah antar modul.
**Keputusan:** Satu deployable dengan batas modul ditegakkan lint (`eslint-plugin-boundaries`), tiga peran proses (`api`, `worker`, `scheduler`).
**Konsekuensi:** Sederhana untuk dioperasikan; pemecahan menjadi service terpisah tetap mungkin karena batas sudah tegas.

---

### ADR-005 — Multi-tenant shared schema dengan `organization_id`
**Status:** Accepted
**Alternatif ditolak:** database per tenant (biaya operasional & migrasi berlipat), schema per tenant (kompleksitas koneksi).
**Konsekuensi:** Isolasi bergantung pada disiplin kode; karena itu `TenantScopedRepository` bersifat wajib dan setiap repository harus punya test isolasi negatif.

---

### ADR-006 — Redis sebagai sumber kebenaran state runtime
**Status:** Accepted
**Keputusan:** Status agent, antrian, registry socket, dan cache SDP disimpan di Redis; MySQL menyimpan riwayat untuk pelaporan.
**Konsekuensi:** Backend stateless dan dapat di-scale. Kehilangan Redis = semua agent harus login ulang, panggilan yang sedang ditawarkan hilang, tetapi data historis aman. Redis dijalankan dengan AOF.

---

### ADR-007 — Mesin ACD dengan leader election
**Status:** Accepted
**Konteks:** Pemilihan agent harus atomik agar tidak ada double-assign saat backend di-scale.
**Keputusan:** Satu leader (lock Redis dengan TTL & perpanjangan) menjalankan tick loop 250 ms.
**Konsekuensi:** Sederhana dan cukup untuk skala target (ratusan panggilan/menit). Bila leader mati, penerus mengambil alih dalam ≤ 2 detik; panggilan yang menunggu tetap di ZSET sehingga tidak hilang.

---

### ADR-008 — Rekaman memakai fitur native Meta, bukan perekaman di browser
**Status:** Accepted
**Konteks:** Meta menyediakan rekaman & transkripsi dengan pengumuman persetujuan yang wajib secara hukum. Perekaman di browser (`MediaRecorder`) akan melewati mekanisme tersebut.
**Keputusan:** Hanya memakai fitur native; `MediaRecorder` dilarang di seluruh kode frontend (ditegakkan lint + review).
**Konsekuensi:** Kepatuhan terjaga, kualitas dua kanal terpisah dengan diarisasi akurat, dan gratis untuk saat ini. Ketergantungan pada retensi Meta 7 hari diatasi dengan job arsip wajib.

---

### ADR-009 — `biz_opaque_callback_data` diisi dengan `call.id` internal
**Status:** Accepted
**Keputusan:** ULID panggilan internal dikirim di setiap request yang mendukung field ini (maks 512 karakter, aman).
**Konsekuensi:** Rekonsiliasi webhook `terminate` dan status tetap mungkin bahkan bila `wacid` belum tersimpan karena race condition.

---

### ADR-010 — Pencarian transkrip memakai MySQL FULLTEXT parser ngram
**Status:** Accepted
**Alternatif ditolak:** Elasticsearch/OpenSearch (menambah komponen infrastruktur yang berat untuk kebutuhan awal).
**Konsekuensi:** Cukup untuk volume awal; `ngram_token_size=2` diperlukan agar Bahasa Indonesia dan pencarian sebagian kata bekerja. Bila volume transkrip melampaui ~5 juta baris atau kebutuhan relevansi meningkat, evaluasi ulang lewat ADR baru.

---

### ADR-011 — DI manual lewat composition root
**Status:** Accepted
**Alasan:** Eksplisit, mudah dibaca manusia maupun AI, mudah di-mock, tanpa decorator magic dan tanpa dependency tambahan.

---

### ADR-012 — Bahasa pengumuman rekaman memakai `en`
**Status:** Accepted
**Konteks:** Meta belum mendukung `id` sebagai `announcement_language`. Pengumuman wajib diputar sebelum rekaman.
**Keputusan:** Default organisasi `announcement_language = "en"` dengan `purpose` singkat berbahasa Inggris. UI menjelaskan keterbatasan ini kepada admin.
**Konsekuensi:** Pelanggan Indonesia mendengar pengumuman berbahasa Inggris. Mitigasi: agent membuka percakapan dengan konfirmasi berbahasa Indonesia bahwa panggilan direkam. Tinjau ulang bila Meta menambahkan `id`.

---

### ADR-013 — Tanpa SIP dan tanpa PSTN, selamanya
**Status:** Accepted
**Konteks:** Terms Meta melarang PSTN pada leg mana pun; mode SIP menonaktifkan endpoint calling dan webhook.
**Keputusan:** Aplikasi menolak nomor dengan `sip.status = ENABLED` dan tidak akan pernah mengimplementasikan transfer ke nomor telepon konvensional.
**Konsekuensi:** Dicatat juga di README repo agar tidak ditambahkan tanpa sengaja.

---

## 2. Open Questions (OQ)

> **Aturan:** OQ berstatus **BLOCKING** harus diselesaikan sebelum menyentuh modul terkait. Setelah terjawab, perbarui status di sini, perbarui dokumen yang relevan, dan cantumkan sumbernya.

| ID | Pertanyaan | Status | Dampak bila salah | Cara memverifikasi |
|---|---|---|---|---|
| **OQ-001** | Apakah `pre_accept` benar-benar wajib menyertakan SDP answer yang sama dengan `accept`, dan apakah `pre_accept` opsional? Dokumen menyebut "sangat disarankan". | **BLOCKING** untuk E6 | Alur accept gagal / audio clipping | Uji langsung dengan test number: (a) accept tanpa pre_accept, (b) accept dengan SDP berbeda. Catat hasilnya di sini |
| **OQ-002** | Untuk panggilan **keluar** (browser sebagai offerer), apakah browser tetap berakhir sebagai DTLS client seperti yang direkomendasikan Meta? | **BLOCKING** untuk E11 | Panggilan keluar bisa gagal terbentuk | Periksa `a=setup` pada SDP answer dari Meta; bila Meta mengirim `a=setup:active`, browser menjadi server — evaluasi apakah panggilan tetap berhasil |
| **OQ-003** | Bagaimana persisnya respons user terhadap Call Permission Request diterima? Lewat webhook `messages` (interactive button reply) atau webhook khusus? Apa struktur payload dan nilai untuk izin permanen vs sementara (7 hari)? Adakah endpoint untuk membaca status izin? | **BLOCKING** untuk E11 | Ledger izin tidak akurat → panggilan keluar gagal terus | Baca halaman "User call permissions" di dokumentasi Meta; uji dengan test number; catat payload nyata sebagai fixture |
| **OQ-004** | Daftar lengkap kode error Calling API selain `138006` dan `131026`. | Non-blocking | Pesan error ke pengguna kurang informatif | Halaman Troubleshooting & Error codes Meta; kumpulkan sambil berjalan dari `webhook_events` |
| **OQ-005** | Apakah ada cara membaca DTMF dari browser tanpa media server (mis. lewat `RTCRtpReceiver` insertable streams)? | Non-blocking (fitur IVR sudah di Fase 2) | Menentukan apakah IVR bisa dimajukan ke Fase 1 | Riset WebRTC Encoded Transform; uji kelayakan singkat |
| **OQ-006** | Struktur respons `?fields=call_analytics` pada WhatsApp Business Account API. | Non-blocking | Fitur estimasi biaya (FR-ANL-005) tertunda | Panggil endpoint dengan token nyata dan dokumentasikan |
| **OQ-007** | Apakah kandidat host browser cukup untuk terhubung ke Meta RTC dari jaringan kantor (NAT simetris, firewall)? Perlukah STUN/TURN sendiri? | **BLOCKING** untuk rilis produksi | Panggilan gagal terbentuk pada sebagian agent | Uji dari beberapa jaringan berbeda (kantor, rumah, seluler). Bila perlu, siapkan coturn dan konfigurasikan lewat `GET /rtc/ice-servers` |
| **OQ-008** | Provider LLM mana yang dipakai untuk ringkasan panggilan, dan apakah data transkrip pelanggan boleh dikirim ke pihak ketiga? | Non-blocking (fitur opsional, default mati) | Risiko kepatuhan privasi | Keputusan bisnis + tinjauan privasi; pertimbangkan model self-hosted |
| **OQ-009** | Berapa jumlah agent, nomor WhatsApp, dan volume panggilan harian yang ditargetkan pada 12 bulan pertama? | Non-blocking | Menentukan kapasitas & keputusan scaling | Konfirmasi ke pemilik produk |
| **OQ-010** | Apakah `wa_id` dari webhook selalu sama dengan nomor telepon, mengingat Meta memperkenalkan username & BSUID (`from_user_id`, `from_parent_user_id`)? | **BLOCKING** untuk E4 | Resolusi kontak salah / kontak duplikat | Uji dengan akun yang memakai username; siapkan kolom `bsuid` di `contacts` bila diperlukan |
| **OQ-011** | Apakah satu Meta App dapat melayani banyak WABA dari organisasi berbeda, atau tiap organisasi wajib punya Meta App sendiri? | Non-blocking (model data sudah mendukung keduanya) | Memengaruhi proses onboarding tenant | Konfirmasi kebijakan Meta untuk Tech Provider vs bisnis langsung |
| **OQ-012** | Berapa lama tepatnya batas waktu menjawab: 30 atau 60 detik? Dokumen menyebut rentang. | Non-blocking (kita pakai 30 detik) | Kehilangan panggilan bila terlalu ketat | Ukur dari `call_events` di lingkungan uji; sesuaikan konstanta bila perlu |
| **OQ-013** | Apakah `terminate` boleh dipanggil pada panggilan yang belum di-`accept` (mis. saat agent menolak setelah `pre_accept`), atau harus `reject`? | **BLOCKING** untuk E6 | Panggilan menggantung / error API | Uji langsung; sementara pakai aturan: sebelum accept → `reject`, sesudah accept → `terminate` |

---

## 3. Asumsi yang dipakai bila OQ belum terjawab

Bila implementasi harus berjalan sebelum OQ terjawab, pakai asumsi berikut **dan tandai kodenya dengan komentar `// ASSUMPTION(OQ-00X)`** agar mudah ditemukan kembali:

| OQ | Asumsi sementara |
|---|---|
| OQ-001 | `pre_accept` selalu dipanggil; `accept` selalu memakai SDP dari cache |
| OQ-002 | Browser sebagai offerer tetap kompatibel; laporan kepatuhan mencatat peran aktual untuk evaluasi |
| OQ-003 | Status izin dikelola optimistis: `REQUESTED` setelah CPR terkirim, dan dikoreksi menjadi `UNKNOWN` bila `connect` mengembalikan `138006` |
| OQ-007 | `iceServers` kosong; dapat diisi tanpa deploy ulang lewat endpoint konfigurasi |
| OQ-010 | `wa_id` diperlakukan sebagai identitas kontak; `from_user_id`/`from_parent_user_id` **tetap disimpan** di `contacts` sebagai kolom `bsuid` & `parent_bsuid` sejak awal agar tidak perlu migrasi besar nanti |
| OQ-012 | Batas internal 30 detik |
| OQ-013 | Sebelum `accept` → `reject`; sesudah `accept` → `terminate` |

> **Catatan untuk AI coding agent:** tambahkan kolom `bsuid VARCHAR(64) NULL` dan `parent_bsuid VARCHAR(64) NULL` pada tabel `contacts` (`04-DATA-MODEL.md` §4.15) sesuai asumsi OQ-010 di atas.

---

## 4. Riwayat perubahan dokumen

| Tanggal | Versi | Perubahan |
|---|---|---|
| 2026-08-11 | 1.0 | Baseline awal seluruh dokumen |
