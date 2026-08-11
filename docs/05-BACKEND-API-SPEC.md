# 05 — Spesifikasi Backend API (internal)

Base path: `/api/v1`. Seluruh skema request/response didefinisikan dengan **Zod** di `packages/contracts` dan dipublikasikan sebagai OpenAPI 3.1 di `/api/docs` (Scalar).

---

## 1. Konvensi umum

### 1.1 Format respons sukses

Objek tunggal:
```json
{ "data": { "...": "..." } }
```

Koleksi (cursor pagination — default untuk data besar):
```json
{
  "data": [ { "...": "..." } ],
  "meta": { "nextCursor": "01J8...", "hasMore": true, "limit": 50 }
}
```

Koleksi (offset pagination — untuk tabel admin):
```json
{
  "data": [],
  "meta": { "page": 1, "limit": 25, "total": 342, "totalPages": 14 }
}
```

### 1.2 Format error (WAJIB konsisten)

```json
{
  "error": {
    "code": "CALL_NOT_ASSIGNABLE",
    "message": "Panggilan tidak dapat ditugaskan pada state saat ini.",
    "details": [ { "field": "state", "issue": "expected QUEUED, got ACTIVE" } ],
    "correlationId": "01J8ZQ7X..."
  }
}
```

| HTTP | Kondisi |
|---|---|
| 400 | Validasi input gagal (`VALIDATION_ERROR`) |
| 401 | Tidak terautentikasi (`UNAUTHENTICATED`) |
| 403 | Tidak berwenang / lintas tenant (`FORBIDDEN`) |
| 404 | Tidak ditemukan (`NOT_FOUND`) |
| 409 | Konflik state / duplikat (`CONFLICT`, `ILLEGAL_STATE_TRANSITION`) |
| 422 | Aturan bisnis dilanggar (`BUSINESS_RULE_VIOLATION`) |
| 429 | Rate limit (`RATE_LIMITED`, sertakan `Retry-After`) |
| 502 | Kegagalan Graph API (`UPSTREAM_META_ERROR`, sertakan `metaCode`) |
| 500 | Kesalahan tak terduga (`INTERNAL_ERROR`) |

Pesan `message` WAJIB dalam Bahasa Indonesia dan aman ditampilkan ke pengguna. Detail teknis masuk `details` dan log.

### 1.3 Header standar

| Header | Arah | Keterangan |
|---|---|---|
| `Authorization: Bearer <accessToken>` | request | Alternatif cookie |
| `X-Correlation-Id` | request/response | Dibuat bila tidak ada |
| `X-Organization-Id` | request | Hanya untuk `PLATFORM_OWNER` yang melakukan impersonation |
| `Idempotency-Key` | request | Wajib pada seluruh endpoint aksi panggilan & pengiriman pesan |

### 1.4 Query parameter standar untuk list

`?page=&limit=&cursor=&sort=<field>:<asc|desc>&q=<pencarian>&filter[<field>]=<nilai>&from=&to=`
`limit` default 25, maksimum 100.

### 1.5 Idempotensi

Endpoint bertanda **(idem)** WAJIB menerima `Idempotency-Key`. Backend menyimpan `idempotency_keys` di Redis (TTL 24 jam) berisi hash request + respons pertama; permintaan berulang mengembalikan respons yang sama tanpa efek samping.

---

## 2. Autentikasi

| Method | Path | Deskripsi |
|---|---|---|
| POST | `/auth/login` | Body `{ email, password, totpCode? }` → set cookie `access_token` & `refresh_token`, respons profil user + permissions |
| POST | `/auth/refresh` | Rotasi refresh token |
| POST | `/auth/logout` | Cabut sesi saat ini |
| POST | `/auth/logout-all` | Cabut semua sesi user |
| GET | `/auth/me` | Profil + permission + organisasi aktif |
| POST | `/auth/totp/setup` | Menghasilkan secret + QR |
| POST | `/auth/totp/enable` | Verifikasi kode & aktifkan |
| POST | `/auth/totp/disable` | Perlu password |
| POST | `/auth/password/change` | |
| POST | `/auth/password/forgot` / `/auth/password/reset` | Alur reset via email |

---

## 3. Endpoint per modul

Notasi peran: **PO** = Platform Owner, **OA** = Org Admin, **SV** = Supervisor, **AG** = Agent.

### 3.1 Organisasi & platform (PO)

| Method | Path | Peran |
|---|---|---|
| GET/POST | `/organizations` | PO |
| GET/PATCH | `/organizations/:id` | PO, OA(sendiri) |
| GET/PATCH | `/organizations/:id/settings` | PO, OA |
| GET | `/platform/health` | PO |
| GET | `/platform/stats` | PO |

### 3.2 Meta App, WABA, nomor

| Method | Path | Peran | Catatan |
|---|---|---|---|
| GET/POST | `/meta-apps` | PO, OA | `appSecret` & `verifyToken` write-only |
| GET/PATCH/DELETE | `/meta-apps/:id` | PO, OA | |
| GET | `/meta-apps/:id/webhook-url` | PO, OA | Mengembalikan URL webhook yang harus didaftarkan di Meta |
| GET/POST | `/waba` | PO, OA | |
| GET/PATCH/DELETE | `/waba/:id` | PO, OA | |
| GET/POST | `/phone-numbers` | PO, OA | |
| GET/PATCH/DELETE | `/phone-numbers/:id` | PO, OA | |
| POST | `/phone-numbers/:id/test-connection` | OA | Memanggil `GET /<PNID>/settings` |
| POST | `/phone-numbers/:id/sync-settings` | OA | Tarik dari Meta ke lokal |
| PUT | `/phone-numbers/:id/calling-settings` **(idem)** | OA | Kirim ke Meta; validasi lokal dulu (lihat `03-...` §3.2) |
| GET | `/phone-numbers/:id/restrictions` | OA, SV | |

Contoh body `PUT /phone-numbers/:id/calling-settings`:
```json
{
  "status": "ENABLED",
  "callIconVisibility": "DEFAULT",
  "restrictToUserCountries": ["ID"],
  "callbackPermissionStatus": "ENABLED",
  "callHours": {
    "status": "ENABLED",
    "timezoneId": "Asia/Jakarta",
    "weeklyOperatingHours": [
      { "dayOfWeek": "MONDAY", "openTime": "0800", "closeTime": "1700" }
    ],
    "holidaySchedule": [ { "date": "2026-12-25", "startTime": "0000", "endTime": "2359" } ]
  }
}
```

### 3.3 User & agent

| Method | Path | Peran |
|---|---|---|
| GET/POST | `/users` | OA |
| GET/PATCH/DELETE | `/users/:id` | OA |
| POST | `/users/:id/reset-password` | OA |
| GET | `/users/:id/sessions` / DELETE `/users/:id/sessions/:sessionId` | OA |
| GET/PATCH | `/agents/:id/profile` | OA |
| GET | `/agents` | OA, SV |
| GET | `/agents/live` | SV | Status real-time seluruh agent |
| POST | `/agents/:id/force-status` | SV | Body `{ status, reason }` |
| POST | `/agents/:id/force-logout` | SV, OA |

### 3.4 Status agent (dipakai agent sendiri)

| Method | Path | Peran |
|---|---|---|
| GET | `/me/agent-state` | AG |
| POST | `/me/agent-state` | AG | Body `{ status: 'AVAILABLE'\|'BREAK'\|'BUSY'\|'OFFLINE', reason? }` |
| GET | `/me/stats/today` | AG | Panggilan hari ini, AHT, dsb. |

### 3.5 Skill, antrian, routing

| Method | Path | Peran |
|---|---|---|
| GET/POST | `/skills`, GET/PATCH/DELETE `/skills/:id` | OA |
| GET/POST | `/queues`, GET/PATCH/DELETE `/queues/:id` | OA |
| GET/PUT | `/queues/:id/skills` | OA |
| GET/PUT | `/queues/:id/agents` | OA |
| GET/POST | `/routing-rules`, PATCH/DELETE `/routing-rules/:id` | OA |
| POST | `/routing-rules/simulate` | OA | Body `{ phoneNumberId, payload?, at? }` → antrian terpilih (untuk uji konfigurasi) |
| GET | `/queues/live` | SV | Panjang antrian, waktu tunggu terlama, agent siap |

### 3.6 Panggilan

| Method | Path | Peran | Deskripsi |
|---|---|---|---|
| GET | `/calls` | SV, OA, AG(hanya miliknya) | Filter: `state`, `direction`, `queueId`, `agentId`, `phoneNumberId`, `dispositionId`, `from`, `to`, `q` (nomor/nama), `hasRecording`, `transcriptQuery` |
| GET | `/calls/:id` | idem | Detail + timeline event |
| GET | `/calls/:id/events` | SV, OA | |
| GET | `/calls/:id/quality` | SV, OA | Sampel WebRTC |
| POST | `/calls/:id/accept` **(idem)** | AG | Dipanggil setelah agent menekan Jawab (alternatif dari WS; WS adalah jalur utama) |
| POST | `/calls/:id/reject` **(idem)** | AG | |
| POST | `/calls/:id/terminate` **(idem)** | AG, SV | |
| POST | `/calls/outbound` **(idem)** | AG | Body `{ contactId?, phoneE164?, waPhoneNumberId, queueId?, callbackId? }` → membuat `call` state `DRAFT` dan meminta SDP offer via WS |
| POST | `/calls/:id/disposition` | AG | Body `{ dispositionId, note?, tags? }` |
| POST | `/calls/:id/notes` | AG, SV | |
| GET | `/calls/:id/recording/url` | SV, OA | Presigned URL (TTL 10 menit), dicatat di audit log |
| GET | `/calls/:id/transcript` | SV, OA | Segmen + teks penuh |
| GET | `/calls/:id/summary` | SV, OA | Ringkasan AI bila ada |
| POST | `/calls/:id/summary/regenerate` | SV | |

**Catatan penting:** aksi `accept` melalui REST tetap membutuhkan SDP answer yang sudah tersimpan di cache (dikirim lebih dulu lewat WS). REST hanya menjadi pemicu; tidak menerima SDP dalam body.

### 3.7 Kontak & izin

| Method | Path | Peran |
|---|---|---|
| GET/POST | `/contacts`, GET/PATCH/DELETE `/contacts/:id` | AG, SV, OA |
| GET | `/contacts/:id/timeline` | AG, SV |
| POST | `/contacts/import` | OA | Upload CSV → job |
| GET | `/contacts/export` | OA |
| GET | `/contacts/:id/permissions` | AG | Status izin per nomor bisnis |
| POST | `/contacts/:id/permissions/request` **(idem)** | AG | Body `{ waPhoneNumberId, channel: 'FREE_FORM'\|'TEMPLATE', templateName? }` |
| GET | `/permissions` | SV, OA | Daftar & filter |

Respons `GET /contacts/:id/permissions`:
```json
{
  "data": [{
    "waPhoneNumberId": "01J8...",
    "displayPhoneNumber": "628116xxxxxx",
    "status": "GRANTED_TEMPORARY",
    "expiresAt": "2026-08-18T03:00:00.000Z",
    "canCall": true,
    "canRequest": false,
    "requestQuota": { "remainingDaily": 0, "remainingWeekly": 1, "nextAvailableAt": "2026-08-12T04:12:00.000Z" },
    "cswOpenUntil": "2026-08-11T09:30:00.000Z"
  }]
}
```

### 3.8 Callback

| Method | Path | Peran |
|---|---|---|
| GET/POST | `/callbacks`, GET/PATCH/DELETE `/callbacks/:id` | AG, SV |
| POST | `/callbacks/:id/claim` | AG |
| POST | `/callbacks/:id/complete` | AG |

### 3.9 Disposisi & tag

| Method | Path | Peran |
|---|---|---|
| GET/POST | `/dispositions`, PATCH/DELETE `/dispositions/:id` | OA |
| GET | `/tags` | AG |

### 3.10 Entry point

| Method | Path | Peran |
|---|---|---|
| GET/POST | `/entry-point-payloads`, PATCH/DELETE `/:id` | OA |
| POST | `/entry-points/deeplink` | OA, SV | Body `{ waPhoneNumberId, payloadCode? }` → `{ url, qrPngBase64, qrSvg }` |
| POST | `/entry-points/interactive-call-button` **(idem)** | AG, SV | Body `{ waPhoneNumberId, contactId, bodyText, displayText?, ttlMinutes?, payloadCode? }` |
| GET/POST | `/message-templates` | OA | Sinkron & buat template |
| POST | `/message-templates/sync` | OA | |
| POST | `/message-templates/:id/send` **(idem)** | AG, SV | |

### 3.11 Analitik & laporan

| Method | Path | Peran |
|---|---|---|
| GET | `/analytics/realtime` | SV, OA | Snapshot wallboard (juga tersedia via WS) |
| GET | `/analytics/calls-summary` | SV, OA | `?from&to&groupBy=day\|hour\|queue\|agent\|phoneNumber\|disposition` |
| GET | `/analytics/agent-performance` | SV, OA | |
| GET | `/analytics/queue-performance` | SV, OA | |
| GET | `/analytics/entry-point-attribution` | SV, OA | |
| GET | `/analytics/usage` | OA | Estimasi menit & pulsa BIC per nomor |
| POST | `/reports/export` | SV, OA | Body `{ type, params, format: 'csv'\|'xlsx' }` → job |
| GET | `/reports/exports/:id` | SV, OA | Status + presigned URL |

### 3.12 Notifikasi & audit

| Method | Path | Peran |
|---|---|---|
| GET | `/notifications` | semua |
| POST | `/notifications/:id/read`, `/notifications/read-all` | semua |
| GET | `/audit-logs` | OA, PO |

### 3.13 Webhook (publik, tanpa auth JWT)

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/webhooks/meta/:metaAppId` | Verifikasi `hub.challenge` |
| POST | `/webhooks/meta/:metaAppId` | Penerimaan event; verifikasi `X-Hub-Signature-256` |

Endpoint ini **tidak** berada di bawah `/api/v1` agar URL pendek dan stabil. Rate limit longgar tetapi tetap ada (1000 req/menit per app).

### 3.14 Sistem

| Method | Path |
|---|---|
| GET | `/health/live`, `/health/ready` |
| GET | `/metrics` (Prometheus, dilindungi network policy / basic auth) |
| GET | `/api/docs` (OpenAPI UI, hanya non-produksi atau dilindungi auth) |

---

## 4. Contoh implementasi route (pola wajib)

```ts
// modules/calling/interface/http/call.router.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { acceptCallParamsSchema } from '@nusacall/contracts';
import type { AppEnv } from '../../../../shared/types/AppEnv';
import { requirePermission } from '../../../../interface/http/middleware/authorize';
import { idempotent } from '../../../../interface/http/middleware/idempotency';

export const callRouter = new Hono<AppEnv>()
  .post(
    '/:id/accept',
    requirePermission('call:accept'),
    idempotent(),
    zValidator('param', acceptCallParamsSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { calling } = c.get('container');
      const result = await calling.accept.execute({
        callId: id,
        agentUserId: c.get('auth').userId,
        tenant: c.get('tenant'),
      });
      return c.json({ data: result }, 200);
    },
  );
```

Aturan:
- Controller **tidak boleh** memuat logika bisnis — hanya validasi, panggil use case, bentuk respons.
- Semua error dilempar sebagai subclass `AppError`; middleware `errorHandler` memetakannya ke HTTP.
- Setiap route mendeklarasikan permission yang dibutuhkan secara eksplisit.

---

## 5. Rate limiting

| Grup | Batas |
|---|---|
| `/auth/login` | 5 / 15 menit per (email+IP) |
| Endpoint mutasi umum | 120 / menit per user |
| Endpoint aksi panggilan | 60 / menit per user |
| Pengiriman pesan/CPR | 30 / menit per organisasi |
| Webhook | 1000 / menit per Meta App |
| Endpoint baca | 600 / menit per user |

Implementasi: sliding window di Redis, middleware `rateLimit(bucket, opts)`.

---

## 6. Versioning

- Path versioned `/api/v1`. Perubahan breaking → `/api/v2` dengan periode dukungan paralel minimal 3 bulan.
- Field baru yang opsional bukan breaking change.
- Skema Zod di `packages/contracts` diberi versi bersama path.
