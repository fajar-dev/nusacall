# 03 — Spesifikasi Integrasi Meta WhatsApp Cloud API Calling

> **ATURAN:** Dokumen ini adalah **satu-satunya** referensi kontrak Meta yang boleh dipakai saat implementasi. Jangan menambah endpoint, field, atau perilaku yang tidak tercantum di sini. Bila butuh sesuatu di luar dokumen ini, catat sebagai `OQ` di `13-ADR-AND-OPEN-QUESTIONS.md` dan hentikan pekerjaan pada bagian tersebut.
>
> Sumber: https://developers.facebook.com/documentation/business-messaging/whatsapp/calling (dan sub-halamannya). Terakhir divalidasi: 11 Agustus 2026.

---

## 1. Model mental

Meta menyediakan **signaling** (Graph API + Webhook) dan **media endpoint** (Meta RTC). Sisi kita menyediakan **VoIP stack sendiri** — dalam proyek ini stack tersebut adalah **browser agent (WebRTC)**.

Konfigurasi yang dipakai proyek ini:

| Aspek | Nilai |
|---|---|
| Protokol signaling | Graph API + Webhooks (HTTPS) — **bukan** SIP |
| Protokol media | WebRTC (ICE + DTLS + SRTP) |
| Codec audio | **OPUS** |
| Media clock rate | **48 kHz** |
| DTMF clock rate | **8 kHz** |
| ptime | **20 ms** |

**SIP tidak dipakai.** Bila SIP diaktifkan pada sebuah nomor, endpoint calling tidak dapat dipakai dan webhook calling tidak dikirim. Aplikasi WAJIB memvalidasi bahwa `calling.sip.status` bernilai `DISABLED` sebelum mengizinkan nomor dipakai.

---

## 2. Prasyarat wajib per nomor

1. Nomor bisnis aktif di Cloud API (bukan aplikasi WhatsApp Business).
2. App di-subscribe ke webhook field **`calls`**.
3. App yang sama di-subscribe ke WABA milik nomor tersebut.
4. App memiliki permission `whatsapp_business_messaging` (dan `whatsapp_business_management` untuk membaca/menulis settings).
5. Bisnis memiliki daily messaging limit minimal **2.000 unique recipients** (kecuali memakai public test number / sandbox account).
6. Calling **diaktifkan** pada nomor lewat `POST /<PNID>/settings` — tidak aktif secara default.

### 2.1 Ketersediaan geografis

- **UIC (panggilan masuk):** tersedia di semua lokasi Cloud API.
- **BIC (panggilan keluar):** tersedia di semua lokasi Cloud API **kecuali** USA, Kanada, Mesir, Vietnam, Nigeria. Batasan ini berlaku pada **kode negara nomor bisnis**; nomor pelanggan boleh dari negara mana pun yang didukung Cloud API.
- Indonesia (+62) didukung untuk keduanya.

Aplikasi WAJIB menyimpan daftar negara yang diblokir sebagai konstanta dan menampilkan peringatan bila nomor bisnis berada di daftar tersebut.

---

## 3. Endpoint Graph API

Base URL: `https://graph.facebook.com/v23.0`
Header: `Authorization: Bearer <ACCESS_TOKEN>`, `Content-Type: application/json`

### 3.1 Aksi panggilan — `POST /<PHONE_NUMBER_ID>/calls`

Satu endpoint untuk semua aksi, dibedakan oleh field `action`.
Nilai `action` yang valid: `connect` | `pre_accept` | `accept` | `reject` | `terminate`.

#### a. `connect` — memulai panggilan keluar (BIC)

```json
{
  "messaging_product": "whatsapp",
  "to": "6281361905133",
  "action": "connect",
  "session": { "sdp_type": "offer", "sdp": "<RFC 8866 SDP>" },
  "biz_opaque_callback_data": "call_01J8...",
  "recording":     { "status": "ENABLED", "purpose": "...", "announcement_language": "en_US" },
  "transcription": { "status": "ENABLED", "purpose": "...", "announcement_language": "en_US" }
}
```

Response sukses:
```json
{ "messaging_product": "whatsapp", "calls": [ { "id": "wacid.HBgLMTIxODU1NTI4MjgVAgARGCAyODRQIAFRoA" } ] }
```

- `to` — nomor pelanggan (callee).
- `session.sdp` — **SDP offer** dari sisi kita (dibuat browser agent).
- `biz_opaque_callback_data` — string bebas, maksimal **512 karakter**, tidak diproses Meta, dikembalikan di webhook. **Kita isi dengan `callId` internal.**
- Objek `recording`/`transcription` bersifat opsional (lihat §6).
- Error **`138006`** = belum ada izin panggilan dari user tersebut.

#### b. `pre_accept` — pra-terima panggilan masuk (SANGAT DISARANKAN)

```json
{
  "messaging_product": "whatsapp",
  "call_id": "wacid.ABGGFjFVU2AfAgo6V-Hc5eCgK5Gh",
  "action": "pre_accept",
  "session": { "sdp_type": "answer", "sdp": "<RFC 8866 SDP>" }
}
```
Response: `{ "success": true }`

Tujuan: membangun koneksi media sebelum media dialirkan → mempercepat waktu sambung dan mencegah **audio clipping**.

#### c. `accept` — menerima panggilan masuk

```json
{
  "messaging_product": "whatsapp",
  "call_id": "wacid.ABGGFjFVU2AfAgo6V-Hc5eCgK5Gh",
  "action": "accept",
  "session": { "sdp_type": "answer", "sdp": "<SDP answer yang IDENTIK dengan pre_accept>" },
  "biz_opaque_callback_data": "call_01J8...",
  "recording":     { "...": "opsional" },
  "transcription": { "...": "opsional" }
}
```
Response: `{ "messaging_product": "whatsapp", "success": true }`

**PENTING (sumber kegagalan paling umum):**
- SDP answer di `accept` **harus sama** dengan SDP answer di `pre_accept` untuk `call_id` yang sama. Berbeda → error.
- Media baru boleh dialirkan **setelah** menerima `200 OK`. Terlalu cepat → penelepon kehilangan beberapa kata pertama; terlalu lambat → penelepon mendengar hening.

#### d. `reject` — menolak panggilan masuk

```json
{ "messaging_product": "whatsapp", "call_id": "wacid...", "action": "reject" }
```

#### e. `terminate` — mengakhiri panggilan aktif

```json
{ "messaging_product": "whatsapp", "call_id": "wacid...", "action": "terminate" }
```

- WAJIB dipanggil saat sisi bisnis mengakhiri panggilan, **meskipun sudah ada paket RTCP BYE** — ini juga membuat penagihan lebih akurat.
- **Tidak perlu** dipanggil bila user yang mengakhiri; webhook terminate akan datang sendiri.

#### f. Batas waktu menjawab

Tersedia sekitar **30–60 detik** sejak webhook `connect` untuk menerima panggilan. Bila tidak direspons, panggilan diakhiri di sisi user dengan notifikasi "Not Answered" dan webhook terminate dikirim.
→ Aplikasi memakai batas internal **30 detik** (BR-006).

### 3.2 Pengaturan nomor — `POST /<PHONE_NUMBER_ID>/settings`

```json
{
  "calling": {
    "status": "ENABLED",
    "call_icon_visibility": "DEFAULT",
    "call_icons": { "restrict_to_user_countries": ["ID"] },
    "call_hours": {
      "status": "ENABLED",
      "timezone_id": "Asia/Jakarta",
      "weekly_operating_hours": [
        { "day_of_week": "MONDAY", "open_time": "0800", "close_time": "1700" }
      ],
      "holiday_schedule": [
        { "date": "2026-12-25", "start_time": "0000", "end_time": "2359" }
      ]
    },
    "callback_permission_status": "ENABLED",
    "sip": { "status": "DISABLED" }
  }
}
```

Aturan validasi yang WAJIB diterapkan di sisi aplikasi sebelum mengirim:

| Field | Aturan |
|---|---|
| `status` | `ENABLED` \| `DISABLED` |
| `call_icon_visibility` | `DEFAULT` (ikon tampil, unsolicited call diizinkan) \| `DISABLE_ALL` (ikon disembunyikan di chat, halaman info bisnis, dan seluruh entry point eksternal; unsolicited call tidak mungkin) |
| `call_icons.restrict_to_user_countries` | Daftar kode negara; array kosong = tanpa batasan. Berlaku berdasarkan negara pendaftaran nomor user, bukan lokasi fisiknya |
| `call_hours.status` | Wajib. Bila `DISABLED`, bisnis dianggap buka 24/7 |
| `call_hours.timezone_id` | Wajib, mis. `Asia/Jakarta` |
| `weekly_operating_hours` | Wajib, tidak boleh kosong. Maks **2 entri per hari**, format `HHMM` 24 jam, `open_time` < `close_time`, **tidak boleh tumpang tindih** |
| `holiday_schedule` | Opsional, maks **20 entri**, format tanggal `YYYY-MM-DD`, **tidak boleh tanggal lampau**. **Bila field tidak dikirim, jadwal libur yang ada akan DIHAPUS** |
| `callback_permission_status` | `ENABLED` → user otomatis dimintai izin telepon setelah menelepon bisnis (baik terjawab maupun missed) |

**Catatan operasional:** setelah konfigurasi diperbarui, client WhatsApp user bisa memerlukan **hingga 7 hari** untuk merefleksikannya, meski mayoritas jauh lebih cepat. Semantik pengaturan tetap dihormati di sisi server. Perubahan `status` diperbarui mendekati real-time bila nomor bisnis ada di kontak user.

### 3.3 Baca pengaturan — `GET /<PHONE_NUMBER_ID>/settings`

Mengembalikan objek `calling` beserta `restrictions` bila nomor sedang dikenai pembatasan:

```json
{
  "calling": {
    "status": "ENABLED",
    "call_icon_visibility": "DEFAULT",
    "callback_permission_status": "ENABLED",
    "call_hours": { "...": "..." },
    "sip": { "status": "DISABLED", "servers": [] },
    "restrictions": {
      "restrictions_list": [
        {
          "type": "RESTRICTED_BIZ_INITIATED_AND_USER_INITIATED_CALLING",
          "reason": "...",
          "expiration": 1754072386
        }
      ]
    }
  }
}
```

Permission app yang dibutuhkan: `whatsapp_business_management`.

### 3.4 Entry point — `POST /<PHONE_NUMBER_ID>/messages`

#### a. Pesan interaktif dengan tombol panggilan

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "6281361905133",
  "type": "interactive",
  "interactive": {
    "type": "voice_call",
    "body": { "text": "Ada kendala? Telepon kami langsung di WhatsApp." },
    "action": {
      "name": "voice_call",
      "parameters": {
        "display_text": "Telepon Sekarang",
        "ttl_minutes": 1440,
        "payload": "SUPPORT_GANGGUAN|TICKET-88123"
      }
    }
  }
}
```

| Parameter | Aturan |
|---|---|
| `display_text` | Opsional, maks **20 karakter**, default `Call Now` |
| `ttl_minutes` | Opsional, **1–43200** (30 hari), default **10080** (7 hari) |
| `payload` | Opsional, maks **512 karakter**, dikembalikan sebagai `cta_payload` di webhook `connect` dan `terminate`. **Hanya tersedia untuk client WhatsApp ≥ 2.25.27** |

Hanya boleh dikirim dalam customer service window / open conversation window. Client versi lama → webhook error `131026`.

#### b. Template dengan tombol panggilan

Pembuatan template — `POST /<WABA_ID>/message_templates`:
```json
{
  "name": "wa_voice_call_support",
  "category": "UTILITY",
  "language": "id",
  "components": [
    { "type": "BODY", "text": "Butuh bantuan? Telepon kami langsung di WhatsApp." },
    { "type": "BUTTONS", "buttons": [ { "type": "voice_call", "text": "Telepon Kami", "ttl_minutes": 1440 } ] }
  ]
}
```
Pada pembuatan template, `ttl_minutes` harus **1440–43200**. Saat pengiriman, nilainya boleh di-override dalam rentang **1–43200**.

Pengiriman — `POST /<PHONE_NUMBER_ID>/messages`:
```json
{
  "messaging_product": "whatsapp",
  "to": "6281361905133",
  "type": "template",
  "template": {
    "name": "wa_voice_call_support",
    "language": { "code": "id" },
    "components": [
      { "type": "button", "sub_type": "voice_call",
        "parameters": [
          { "type": "ttl_minutes", "ttl_minutes": 1440 },
          { "type": "payload", "payload": "SUPPORT_GANGGUAN" }
        ] }
    ]
  }
}
```

#### c. Deep link

Format: `wa.me/call/<BUSINESS_PHONE_NUMBER>`
Dengan payload: `wa.me/call/<BUSINESS_PHONE_NUMBER>?biz_payload=<payload>`

- Dikembalikan di webhook sebagai `deeplink_payload`.
- **Tidak didukung di WhatsApp desktop.**
- Payload memerlukan client ≥ 2.25.27.
- Tidak perlu template; bisa ditempel di website, aplikasi, atau QR code.

### 3.5 Media API (untuk mengunduh rekaman/transkrip)

Webhook menyertakan `url` yang **berlaku 5 menit**. Unduh dengan `GET <url>` beserta header `Authorization: Bearer <token>`. Bila kedaluwarsa, ambil URL baru lewat Media API menggunakan media `id`.

---

## 4. Webhook

Semua event calling datang pada field **`calls`** di dalam `entry[].changes[]`.

Endpoint aplikasi: `POST /webhooks/meta/:metaAppId`.
Verifikasi awal: `GET /webhooks/meta/:metaAppId?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...` → balas isi `hub.challenge` sebagai text/plain.

Verifikasi signature: header `X-Hub-Signature-256: sha256=<hex>` = HMAC-SHA256(rawBody, app_secret).

### 4.1 `connect` — panggilan masuk (UIC), berisi SDP **offer**

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<WABA_ID>",
    "changes": [{
      "field": "calls",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "6281...", "phone_number_id": "<PNID>" },
        "contacts": [{ "profile": { "name": "Budi" }, "wa_id": "6281361905133" }],
        "calls": [{
          "id": "wacid.ABGG...",
          "to": "6281...",
          "from": "6281361905133",
          "event": "connect",
          "timestamp": "1671644824",
          "direction": "USER_INITIATED",
          "deeplink_payload": "SUPPORT_GANGGUAN",
          "cta_payload": "SUPPORT_GANGGUAN|TICKET-88123",
          "session": { "sdp_type": "offer", "sdp": "<RFC 8866 SDP>" }
        }]
      }
    }]
  }]
}
```

### 4.2 `connect` — panggilan keluar (BIC), berisi SDP **answer**

Struktur sama, dengan `direction: "BUSINESS_INITIATED"`, `session.sdp_type: "answer"`, dan dapat menyertakan `biz_opaque_callback_data`.

### 4.3 Status webhook

```json
{
  "value": {
    "statuses": [{
      "id": "wacid.ABGG...",
      "type": "call",
      "status": "RINGING",
      "timestamp": "1671644824",
      "recipient_id": "6281361905133",
      "biz_opaque_callback_data": "call_01J8..."
    }]
  }
}
```
`status` ∈ `RINGING` | `ACCEPTED` | `REJECTED`.
Catatan: `ACCEPTED` umumnya tiba **setelah** panggilan tersambung; sifatnya untuk audit, bukan pemicu utama alur.

### 4.4 `terminate`

```json
{
  "calls": [{
    "id": "wacid.ABGG...",
    "to": "...", "from": "...",
    "event": "terminate",
    "direction": "USER_INITIATED",
    "deeplink_payload": "...", "cta_payload": "...",
    "biz_opaque_callback_data": "call_01J8...",
    "timestamp": "1671644824",
    "status": "COMPLETED",
    "start_time": "1671644824",
    "end_time": "1671644944",
    "duration": 120
  }],
  "errors": [{ "code": 0, "message": "...", "href": "...", "error_data": { "details": "..." } }]
}
```

- `status` ∈ `COMPLETED` | `FAILED`.
- `start_time`, `end_time`, `duration` **hanya ada bila panggilan sempat diangkat**.
- `errors` hanya ada untuk panggilan gagal.

### 4.5 `call_recording_available`

```json
{
  "calls": [{
    "id": "wacid...",
    "from": "<USER_PHONE>",
    "from_user_id": "<BSUID>",
    "from_parent_user_id": "<PARENT_BSUID>",
    "timestamp": "1728932177",
    "event": "call_recording_available",
    "call_recording": {
      "type": "audio",
      "audio": {
        "id": "1002764438271669",
        "sha256": "Y9vv...",
        "mime_type": "audio/ogg; codecs=opus",
        "url": "https://lookaside.fbsbx.com/..."
      }
    }
  }]
}
```
Datang biasanya < 1 menit setelah panggilan selesai.

### 4.6 `call_transcription_available`

```json
{
  "calls": [{
    "id": "wacid...",
    "timestamp": "1728932177",
    "event": "call_transcription_available",
    "call_transcript": {
      "document": {
        "id": "1002764438271669",
        "sha256": "Y9vv...",
        "mime_type": "application/json",
        "url": "https://lookaside.fbsbx.com/..."
      }
    }
  }]
}
```

### 4.7 `account_settings_update` (field terpisah)

Berisi `phone_number_settings.calling` dengan struktur sama seperti GET settings. Dikirim juga untuk perubahan yang kita lakukan sendiri. Field yang dipantau: `status`, `call_icon_visibility`, `callback_permission_status`, `sip.status`, `srtp_key_exchange_protocol`.

### 4.8 `account_update` (field terpisah) — peringatan & penegakan

```json
{ "field": "account_update", "value": {
    "phone_number": "6281...",
    "event": "ACCOUNT_VIOLATION",
    "violation_info": { "violation_type": "LOW_CALLING_QUALITY" }
}}
```
```json
{ "field": "account_update", "value": {
    "phone_number": "6281...",
    "event": "ACCOUNT_RESTRICTION",
    "violation_info": { "violation_type": "LOW_CALLING_QUALITY" },
    "restriction_info": [{ "restriction_type": "RESTRICTED_BIZ_INITIATED_AND_USER_INITIATED_CALLING", "expiration": 1641848057 }]
}}
```
Jenis lain: `USER_INITIATED_CALLS_LOW_PICKUP_RATE` (peringatan) dan `RESTRICTED_USER_INITIATED_CALLING_CALL_BUTTON_HIDDEN` (penegakan).

**Konsekuensi saat nomor dibekukan (7 hari):** tidak bisa melakukan BIC, tidak bisa menerima UIC, ikon call tidak tampil, tidak bisa mengirim CPR, dan tidak bisa mengubah pengaturan calling nomor tersebut.

---

## 5. Rekaman & transkripsi

Keduanya **independen**, opt-in **per panggilan**, dan disetel lewat objek terpisah pada request `connect` (BIC) atau `accept` (UIC).

### 5.1 Objek request

```json
"recording":     { "status": "ENABLED|DISABLED", "purpose": "<maks 250 char>", "announcement_language": "en_US" }
"transcription": { "status": "ENABLED|DISABLED", "purpose": "<maks 250 char>", "announcement_language": "en_US" }
```

- `purpose` **wajib** bila `status = ENABLED`; kosong → request ditolak.
- Pengumuman lisan diputar ke kedua pihak sebelum perekaman/transkripsi dimulai. Perekaman baru berjalan setelah pengumuman selesai.
- Bila keduanya aktif → **satu pengumuman gabungan**; nilai `purpose` & `announcement_language` diambil dari objek `recording`, milik `transcription` diabaikan.
- Webhook tetap terpisah untuk masing-masing fitur.

### 5.2 Bahasa pengumuman yang didukung

`en` (dan varian `en_US`, `en_AU`, `en_CA`, `en_GB`, `en_IN`, `en_NZ`), `nl`, `fr`, `de`, `hi`, `it`, `kn`, `pt`, `es`, `es_ES`, `te`, `vi`.

> **Bahasa Indonesia (`id`) TIDAK termasuk.** Aplikasi WAJIB membatasi pilihan hanya pada daftar di atas. Untuk transkripsi, `nl` dan `es_ES` valid tetapi memutar pengumuman berbahasa Inggris sampai lokalisasi tersedia.
> Rekomendasi konfigurasi default proyek: `announcement_language = "en"` dengan `purpose` berbahasa Inggris singkat, mis. `"quality assurance and service improvement"`.

### 5.3 Bahasa transkrip

Tidak ditentukan di request — Calling API mendeteksi otomatis dan melaporkannya di `transcript.language` (kode ISO 639). **Bahasa Indonesia dan Jawa termasuk yang didukung.** Bila bahasa tidak didukung, webhook tetap datang tetapi transkrip bisa kosong.

### 5.4 Format dokumen transkrip

```json
{
  "metadata": {
    "processed_at": "2026-06-18T20:16:47Z",
    "audio": { "duration": 21.76, "sample_rate": 16000, "channels": 2, "audio_format": "stereo" }
  },
  "transcript": {
    "text": "[Business] Halo, ada yang bisa dibantu? [Customer] Internet saya mati.",
    "language": "id",
    "duration": 21.76,
    "confidence": 0.83,
    "segments": [
      {
        "id": 1, "speaker": "Business", "channel": 0,
        "start": 1.16, "end": 2.44,
        "text": "Halo, ada yang bisa dibantu?", "confidence": 0.85,
        "words": [ { "word": "Halo,", "start": 1.16, "end": 1.64, "confidence": 0.89, "lang": "id" } ]
      }
    ]
  }
}
```
- `speaker` ∈ `Business` | `Customer`; `channel` 0 = bisnis, 1 = user WhatsApp.
- Atribusi tetap akurat meski kedua pihak bicara bersamaan (dua kanal terpisah).

### 5.5 Retensi

Rekaman dan transkrip tersedia untuk diunduh **7 hari** sejak webhook dikirim; setelah itu media id kedaluwarsa dan berkas dihapus. **Aplikasi WAJIB mengarsipkan sendiri dalam ≤ 24 jam** (BR-009).

### 5.6 Biaya

Rekaman dan transkripsi **saat ini gratis**; Meta menyatakan pricing terpisah direncanakan di masa depan dengan pemberitahuan sebelumnya. Aplikasi harus menyimpan penghitung penggunaan agar siap ketika berbayar.

---

## 6. Izin panggilan keluar (Call Permission)

Panggilan keluar hanya boleh dilakukan setelah user memberi izin. Cara memperoleh izin:

1. **CPR free-form** — dikirim saat customer service window terbuka.
2. **CPR lewat template** — dipakai saat window tertutup.
3. **`callback_permission_status = ENABLED`** — user otomatis dimintai izin ketika mereka menelepon bisnis (baik panggilan terjawab maupun missed).
4. **Izin permanen** — user memberikannya sendiri lewat halaman profil bisnis.

### 6.1 Batas (per pasangan bisnis + user)

| Konteks | Batas CPR | Panggilan tak terjawab beruntun |
|---|---|---|
| **Produksi** | 1 per hari, 2 per minggu | 2× → pesan sistem menyarankan meninjau izin; 4× → izin dicabut otomatis |
| **Sandbox / test number** | 25 per hari, 100 per minggu | 5× → pesan sistem; 10× → izin dicabut |

Batas jumlah **panggilan keluar** per izin yang disetujui: 100 per hari per user (naik dari 10 pada 19 Desember 2025).

Aplikasi WAJIB memberlakukan batas ini di sisi sendiri sebelum memanggil API (BR-015), dan menampilkan sisa kuota di UI.

### 6.2 Kode error terkait

| Kode | Arti | Perilaku aplikasi |
|---|---|---|
| `138006` | Tidak ada izin panggilan dari user ini | Set ledger `UNKNOWN`, tawarkan kirim CPR |
| `131026` | Pesan tidak dapat dikirim (client user terlalu lama) | Tampilkan pesan agar user memperbarui WhatsApp |

Kode error lain di luar dua ini: catat apa adanya, jangan menebak artinya. Lihat `OQ-004`.

---

## 7. DTMF

- Client WhatsApp memiliki dialpad saat menelepon nomor Cloud API; tone di-inject ke stream RTP WebRTC sesuai **RFC 4733**.
- **Tidak ada webhook untuk digit DTMF** — harus dibaca dari media stream.
- Clock rate DTMF hanya **8000**; 48000 tidak didukung. Untuk BIC, SDP offer kita diharapkan memuat clock rate 8000 (payload type 126); bila tidak ada, Meta tetap memakai 8000.
- Dialpad hanya untuk kasus DTMF, tidak untuk memulai panggilan/pesan.

**Implikasi Fase 1:** browser tidak dapat membaca DTMF masuk dari `RTCPeerConnection` tanpa akses ke RTP mentah. Karena itu **IVR berbasis DTMF masuk lingkup Fase 2** (butuh media server). Aplikasi Fase 1 tetap harus menyertakan negosiasi `telephone-event/8000` di SDP agar kompatibel. Lihat `OQ-005`.

---

## 8. Persyaratan media (WAJIB — pelanggaran = panggilan gagal)

| Persyaratan | Nilai |
|---|---|
| Codec audio | Hanya **Opus** |
| Media clock rate | **48 kHz** |
| DTMF clock rate | **8 kHz** |
| ptime | **20 ms** |

### 8.1 Rekomendasi (untuk kualitas & keandalan)

- Stack Meta adalah **ICE-LITE**; stack kita harus **ICE-FULL**.
- Sisi kita yang memulai STUN connectivity check.
- Sisi kita mengambil peran **ICE CONTROLLING**; Meta hanya mengambil peran **CONTROLLED**.
- Gunakan **regular nomination**, bukan aggressive.
- Tunggu proses ICE selesai sebelum menominasikan kandidat dan memulai DTLS.
- **Jangan mengganti kandidat di tengah panggilan.**
- DTLS: gunakan kunci **ECDH** untuk sertifikat agar paket tidak terfragmentasi; sisi kita bertindak sebagai **DTLS client**.
- Tunda audio sampai koneksi media dengan Meta terbentuk; gunakan pre-accept untuk mencegah audio clipping.

### 8.2 Bagaimana browser memenuhi ini

| Persyaratan | Cara browser memenuhinya | Aksi implementasi |
|---|---|---|
| Opus 48 kHz | Default browser | Filter SDP: buang codec selain Opus & `telephone-event` |
| ptime 20 ms | Default Opus di browser | Tambahkan/paksa `a=ptime:20` pada munging SDP |
| ICE-FULL | Browser selalu ICE-full | — |
| Peran CONTROLLING | Menurut RFC 8445, bila satu agent lite dan lawannya full, **agent full selalu mengambil peran controlling** — browser melakukan ini otomatis ketika melihat `a=ice-lite` di SDP remote | Verifikasi lewat `RTCIceTransport.role === 'controlling'`; log bila tidak |
| DTLS client | Browser menjadi DTLS client bila SDP lokal memakai `a=setup:active` | Untuk answer (UIC), browser default `a=setup:active` saat remote `actpass` → sesuai. Verifikasi lewat SDP lokal. Untuk offer (BIC), browser mengirim `a=setup:actpass`; pastikan hasil akhirnya browser menjadi client — **verifikasi di OQ-002** |
| Kandidat tidak berganti | Nonaktifkan ICE restart otomatis; jangan panggil `restartIce()` saat panggilan aktif | Terapkan guard di `PeerConnectionManager` |
| Regular nomination | Perilaku default browser | — |

**SDP munging** yang diperbolehkan hanya: menghapus codec non-Opus/non-telephone-event, menegakkan `a=ptime:20` dan `a=maxptime:20`, serta menghapus baris `a=rtcp-fb` video. Modifikasi lain dilarang tanpa ADR.

---

## 9. State machine panggilan (internal)

```
                     ┌──────────┐
   webhook connect   │          │
   (USER_INITIATED)  │  QUEUED  │
   ─────────────────►│          │
                     └────┬─────┘
                          │ ACD memilih agent
                     ┌────▼───────┐  timeout/ditolak & masih ada kandidat
                     │  OFFERING  │◄──────────────┐
                     └────┬───────┘               │
        SDP answer diterima│                      │
                     ┌────▼─────────┐             │
                     │ PRE_ACCEPTED │─────────────┘
                     └────┬─────────┘
       agent menekan Jawab│                    reject / timeout final
                     ┌────▼───────┐            ┌────────────┐
                     │   ACTIVE   │            │ NO_ANSWER  │
                     └────┬───────┘            │ / REJECTED │
        webhook terminate │                    └─────┬──────┘
                     ┌────▼───────┐                  │
                     │  WRAP_UP   │                  │
                     └────┬───────┘                  │
                          │ disposisi / timeout      │
                     ┌────▼───────┐                  │
                     │ COMPLETED  │◄─────────────────┘
                     └────────────┘

Panggilan keluar: DRAFT → DIALING → (webhook connect: answer) → RINGING → ACTIVE → WRAP_UP → COMPLETED
State terminal tambahan: FAILED, ABANDONED, STALE
```

Transisi yang diizinkan didefinisikan eksplisit di `CallStateMachine`; transisi ilegal melempar `IllegalCallTransitionError` dan dicatat.

---

## 10. Alur signaling lengkap — panggilan masuk

```
Meta                Backend                     Redis            Browser Agent
 │  webhook connect   │                          │                    │
 ├───────────────────►│ verify sig, simpan, 200  │                    │
 │                    ├─ enqueue job ───────────►│                    │
 │                    │ resolve tenant/kontak/antrian                  │
 │                    ├─ ACD pilih agent ───────►│                    │
 │                    ├───────── WS call.offer (sdp offer) ──────────►│
 │                    │                          │   createAnswer     │
 │                    │◄──────── WS call.answer_sdp ──────────────────┤
 │                    ├─ simpan sdp:answer:{wacid} ─►│                │
 │◄─ POST pre_accept ─┤                          │                    │
 ├─ 200 ─────────────►│                          │                    │
 │                    ├───────── WS call.ringing ────────────────────►│
 │                    │                          │  agent tekan Jawab │
 │                    │◄──────── WS call.answer ──────────────────────┤
 │                    ├─ ambil sdp:answer:{wacid} ──►│                │
 │◄─ POST accept ─────┤                          │                    │
 ├─ 200 OK ──────────►│                          │                    │
 │                    ├───────── WS call.accepted ───────────────────►│
 │◄════════════ MEDIA WebRTC (Opus/SRTP) ═══════════════════════════►│
 │  webhook terminate │                          │                    │
 ├───────────────────►│ update state, WRAP_UP    │                    │
 │                    ├───────── WS call.ended ──────────────────────►│
```

---

## 11. Testing & sandbox

- Public test number & sandbox account memberi batasan yang dilonggarkan (lihat §6.1). Sandbox hanya untuk Tech Partner.
- Bisnis **tidak** perlu memiliki messaging limit 2.000 unique recipients untuk menguji Calling API dengan public test number/sandbox.
- **Calling nonaktif secara default pada test number** — harus diaktifkan lewat settings.
- Hanya panggilan dari **primary device** (HP utama) yang dapat diterima; panggilan dari companion device (WhatsApp Web, desktop, tablet, smart glasses) akan ditolak.

---

## 12. Penagihan (untuk perhitungan biaya di aplikasi)

- Seluruh **panggilan user-initiated gratis**.
- Yang ditagih hanya **panggilan business-initiated yang terjawab**, dihitung dalam **pulsa 6 detik** dengan pembulatan ke atas (contoh: 56 detik = 9,33 pulsa → dihitung 10 pulsa).
- Tarif per menit bergantung pada kode negara pelanggan, volume bulanan, dan rate card kuartal berjalan. Indonesia berada di band harga terendah.
- **Customer service window 24 jam kini juga dibuka/di-refresh oleh panggilan masuk dari user**, terlepas apakah panggilan diterima atau tidak. Aplikasi memakai ini untuk menentukan kelayakan pesan free-form & CPR.
- Analitik panggilan tersedia lewat WhatsApp Business Account API dengan query `?fields=call_analytics` (lihat `OQ-006`).

---

## 13. Checklist implementasi adapter Meta

Adapter `infrastructure/meta/` WAJIB:

- [ ] Memuat base URL & versi Graph API dari konfigurasi (default `v23.0`).
- [ ] Menyelesaikan access token per `phone_number_id` lewat `TokenResolver` (dekripsi at-runtime, tidak pernah di-log).
- [ ] Timeout 10 detik, retry hanya untuk `5xx` & error jaringan (maks 2, backoff 300 ms & 900 ms), **tidak pernah** retry untuk `4xx`.
- [ ] Memetakan error Meta ke `MetaApiError` yang memuat `code`, `subcode`, `message`, `details`, `fbtrace_id`.
- [ ] Menyediakan metode: `initiateCall`, `preAcceptCall`, `acceptCall`, `rejectCall`, `terminateCall`, `getSettings`, `updateSettings`, `sendInteractiveVoiceCall`, `sendTemplateMessage`, `createTemplate`, `getMediaUrl`, `downloadMedia`.
- [ ] Mencatat setiap panggilan API ke `call_events`/`audit_logs` (tanpa SDP penuh; simpan hash SDP saja).
- [ ] Semua tipe payload didefinisikan dengan Zod di `infrastructure/meta/schemas/` dan divalidasi saat parsing webhook.
