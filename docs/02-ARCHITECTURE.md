# 02 — Arsitektur Sistem

---

## 1. Prinsip arsitektur

1. **Media tidak pernah melewati backend.** Audio mengalir langsung browser agent ↔ Meta RTC (WebRTC). Backend hanya signaling + orkestrasi + pencatatan. Konsekuensi: backend murah, mudah di-scale, dan kegagalan backend tidak memutus panggilan berjalan.
2. **Clean architecture.** Domain murni TypeScript, tanpa import framework. Ketergantungan selalu mengarah ke dalam: `interface → application → domain`, dan `infrastructure` mengimplementasikan port milik `domain`/`application`.
3. **Modular monolith.** Satu deployable, tetapi batas modul ditegakkan lewat struktur folder + lint rule. Modul berkomunikasi hanya lewat application service atau domain event — tidak boleh mengimpor infrastructure milik modul lain.
4. **Stateless service, stateful Redis.** Semua state runtime (status agent, antrian, socket registry, SDP cache) di Redis.
5. **Event-driven internal.** Webhook dan perubahan state menghasilkan domain event; side effect (arsip media, notifikasi, statistik) menjadi consumer.
6. **Semua integrasi eksternal ada di balik port.** Meta Graph API, object storage, email, LLM — semuanya interface yang dapat di-mock.

---

## 2. Diagram konteks

```
                   ┌────────────────────────────────────────────┐
                   │              META / WHATSAPP               │
                   │  Graph API  •  Webhooks  •  Meta RTC (SRTP)│
                   └───┬─────────────┬──────────────────┬───────┘
     HTTPS (Graph API) │             │ Webhook HTTPS    │ WebRTC (DTLS/SRTP, Opus)
                       │             │                  │
        ┌──────────────▼─────────────▼──────────┐       │
        │        NUSACALL BACKEND (Hono)        │       │
        │  ┌──────────────────────────────────┐ │       │
        │  │ HTTP API │ Webhook │ WS Gateway  │ │       │
        │  ├──────────────────────────────────┤ │       │
        │  │  Application (use cases)          │ │      │
        │  ├──────────────────────────────────┤ │       │
        │  │  Domain (entities, state machine) │ │      │
        │  ├──────────────────────────────────┤ │       │
        │  │  Infrastructure (TypeORM, Redis,  │ │      │
        │  │  BullMQ, Graph client, S3)        │ │      │
        │  └──────────────────────────────────┘ │       │
        └───┬──────────┬──────────┬─────────────┘       │
            │          │          │                     │
     ┌──────▼───┐ ┌────▼────┐ ┌───▼──────┐              │
     │  MySQL 8 │ │ Redis 7 │ │ S3/MinIO │              │
     └──────────┘ └─────────┘ └──────────┘              │
                       ▲                                 │
                       │ WSS (signaling) + HTTPS (REST)  │
        ┌──────────────┴──────────────────────────────┐  │
        │        NUSACALL FRONTEND (Nuxt 4)           │◄─┘
        │  Softphone (WebRTC) • Agent Desk • Admin    │
        └─────────────────────────────────────────────┘
```

**Catatan penting:** panah WebRTC menghubungkan **browser** langsung ke **Meta RTC**, tidak melewati backend.

---

## 3. Komponen runtime

| Komponen | Proses | Tanggung jawab |
|---|---|---|
| `api` | Hono HTTP server | REST API, webhook endpoint, health, metrics |
| `ws` | Hono + `@hono/node-ws` (proses yang sama dengan `api`) | Signaling agent, push event real-time |
| `worker` | Proses Node terpisah (BullMQ worker) | Pemrosesan webhook, arsip media, agregasi statistik, notifikasi, ringkasan AI |
| `scheduler` | Proses Node terpisah (BullMQ repeatable jobs) | Sinkronisasi setting, verifikasi arsip, agregasi harian, pembersih panggilan basi |
| `acd` | Berjalan di dalam `worker`, dilindungi Redis lock | Mesin distribusi panggilan |
| `web` | Nuxt (SSR/hybrid) | Frontend |

Pada pengembangan, `api`, `worker`, `scheduler` boleh dijalankan dalam satu container dengan flag `APP_ROLE=all`, tetapi kodenya harus sudah dipisah sejak awal.

---

## 4. Struktur folder — monorepo

```
nusacall/
├─ apps/
│  ├─ backend/
│  └─ web/
├─ packages/
│  ├─ contracts/          # Zod schema + tipe yang dipakai bersama BE & FE
│  ├─ ws-protocol/        # Definisi tipe pesan WebSocket (shared)
│  └─ eslint-config/
├─ docker/
│  ├─ mysql/init.sql
│  └─ nginx/
├─ docs/                  # dokumen ini
├─ docker-compose.yml
├─ docker-compose.dev.yml
├─ pnpm-workspace.yaml
├─ turbo.json
└─ package.json
```

Package manager: **pnpm workspaces**. Task runner: **Turborepo**.

### 4.1 Struktur `apps/backend`

```
apps/backend/src/
├─ main.ts                       # entry: pilih role (api|worker|scheduler|all)
├─ bootstrap/
│  ├─ createApp.ts               # rakit Hono app + middleware global
│  ├─ container.ts               # composition root (DI manual, lihat §6)
│  ├─ config.ts                  # baca & validasi env via Zod
│  └─ shutdown.ts
├─ shared/
│  ├─ domain/                    # Entity base, ValueObject, DomainEvent, Result
│  ├─ errors/                    # AppError hierarchy + mapping ke HTTP
│  ├─ logging/
│  ├─ observability/             # metrics, tracing
│  ├─ types/
│  └─ utils/
├─ modules/
│  ├─ identity/
│  ├─ tenancy/
│  ├─ wa-accounts/
│  ├─ calling/
│  ├─ routing/
│  ├─ permissions/
│  ├─ media/
│  ├─ contacts/
│  ├─ callbacks/
│  ├─ analytics/
│  ├─ entrypoints/
│  ├─ notifications/
│  └─ audit/
├─ infrastructure/
│  ├─ database/
│  │  ├─ data-source.ts
│  │  ├─ migrations/
│  │  └─ transaction/            # unit of work
│  ├─ redis/
│  ├─ queue/                     # BullMQ setup, queue names, job types
│  ├─ storage/                   # S3 adapter
│  ├─ meta/                      # Graph API client + tipe payload Meta
│  ├─ mailer/
│  └─ llm/
└─ interface/
   ├─ http/
   │  ├─ routes.ts               # registrasi seluruh router modul
   │  ├─ middleware/             # auth, tenant, error, rateLimit, requestId
   │  └─ openapi.ts
   ├─ webhook/
   │  └─ meta.controller.ts
   └─ ws/
      ├─ gateway.ts
      ├─ handlers/
      └─ registry.ts             # peta socket ↔ user, berbasis Redis pub/sub
```

### 4.2 Anatomi satu modul (contoh `calling`)

```
modules/calling/
├─ domain/
│  ├─ entities/
│  │  ├─ Call.ts                 # agregat root + invariant
│  │  └─ CallEvent.ts
│  ├─ value-objects/
│  │  ├─ CallId.ts
│  │  ├─ Wacid.ts
│  │  └─ SdpPayload.ts
│  ├─ enums/CallState.ts
│  ├─ state-machine/CallStateMachine.ts
│  ├─ events/                    # CallQueued, CallAnswered, CallEnded, ...
│  └─ ports/
│     ├─ CallRepository.ts
│     ├─ MetaCallingGateway.ts
│     └─ SdpCache.ts
├─ application/
│  ├─ use-cases/
│  │  ├─ HandleInboundCallConnect.ts
│  │  ├─ PreAcceptCall.ts
│  │  ├─ AcceptCall.ts
│  │  ├─ RejectCall.ts
│  │  ├─ TerminateCall.ts
│  │  ├─ InitiateOutboundCall.ts
│  │  ├─ HandleCallStatusWebhook.ts
│  │  └─ HandleCallTerminateWebhook.ts
│  ├─ dto/
│  └─ mappers/
├─ infrastructure/
│  ├─ TypeOrmCallRepository.ts
│  ├─ CallOrmEntity.ts
│  └─ RedisSdpCache.ts
└─ interface/
   ├─ http/call.router.ts
   └─ ws/call.ws-handler.ts
```

### 4.3 Struktur `apps/web` (Nuxt 4)

```
apps/web/
├─ app/
│  ├─ app.vue
│  ├─ layouts/            # default, auth, agent, blank
│  ├─ pages/
│  ├─ components/
│  │  ├─ softphone/
│  │  ├─ calls/
│  │  ├─ queues/
│  │  ├─ contacts/
│  │  ├─ admin/
│  │  └─ ui/              # wrapper tipis di atas Mantine Vue
│  ├─ composables/
│  ├─ stores/             # Pinia
│  ├─ lib/
│  │  ├─ webrtc/          # PeerConnectionManager, DeviceManager, StatsCollector
│  │  ├─ ws/              # WsClient (reconnect, heartbeat, typed)
│  │  └─ api/             # generated/typed API client
│  ├─ middleware/
│  ├─ plugins/
│  └─ assets/
├─ i18n/locales/{id,en}.json
├─ nuxt.config.ts
└─ tests/
```

---

## 5. Aturan ketergantungan (ditegakkan lint)

| Dari | Boleh mengimpor |
|---|---|
| `domain` | hanya `shared/domain`, `shared/errors` |
| `application` | `domain` modul sendiri, `shared/*`, port modul lain |
| `infrastructure` | `domain` & `application` modul sendiri, `infrastructure/*` global |
| `interface` | `application` modul sendiri, `shared/*` |
| lintas modul | **hanya** `application/use-cases` atau domain event — dilarang mengimpor `infrastructure` modul lain |

Gunakan `eslint-plugin-boundaries` dengan konfigurasi di `packages/eslint-config`.

---

## 6. Dependency injection

Tanpa framework DI berat. Gunakan **composition root manual** di `bootstrap/container.ts`:

```ts
export function buildContainer(deps: Infra): Container {
  const callRepo = new TypeOrmCallRepository(deps.dataSource);
  const sdpCache = new RedisSdpCache(deps.redis);
  const metaGateway = new MetaCallingGateway(deps.graphClient, deps.tokenResolver);

  return {
    calling: {
      handleInboundConnect: new HandleInboundCallConnect(callRepo, contactRepo, routingService, eventBus),
      preAccept: new PreAcceptCall(callRepo, metaGateway, sdpCache, eventBus),
      accept: new AcceptCall(callRepo, metaGateway, sdpCache, recordingPolicy, eventBus),
      // ...
    },
    // ...
  };
}
```

Alasan: eksplisit, mudah dibaca AI/manusia, mudah di-mock di test, tanpa magic decorator. Container diletakkan di Hono context via middleware.

---

## 7. Aliran data kritikal

### 7.1 Ingest webhook (wajib idempoten & cepat)

```
POST /webhooks/meta/:metaAppId
  1. Baca raw body (WAJIB raw, sebelum parsing JSON) → verifikasi HMAC SHA-256 dengan app_secret
  2. Hitung dedupeKey = sha256(rawBody)
  3. INSERT IGNORE ke webhook_events (dedupeKey unique) — jika duplikat → langsung 200
  4. enqueue job `webhook.process` { webhookEventId }
  5. return 200 "EVENT_RECEIVED"
```

Worker `webhook.process`:
```
  1. Ambil payload, tentukan field (calls|messages|account_update|...)
  2. Resolusi tenant dari entry[].id (WABA ID) & value.metadata.phone_number_id
  3. Dispatch ke use case sesuai jenis event
  4. Tandai processed_at; kegagalan → retry backoff (5 kali) → DLQ + alert
```

### 7.2 Cache SDP (mencegah kegagalan `accept`)

`accept` WAJIB memakai SDP answer yang sama persis dengan `pre_accept`. Simpan di Redis:
`sdp:answer:{wacid}` → string SDP, TTL 300 detik. Use case `AcceptCall` **hanya boleh** membaca dari cache ini; bila kosong → error `SDP_ANSWER_MISSING` dan panggilan di-`reject` dengan pesan jelas.

### 7.3 Registry socket agent

Redis:
- `ws:user:{userId}` → set berisi `{instanceId}:{socketId}`
- `ws:instance:{instanceId}` → set socketId (untuk pembersihan saat restart)
- Pub/sub channel `ws:broadcast` untuk mengirim pesan ke user yang tersambung di instance lain.

### 7.4 State agent

Redis hash `agent:{userId}`: `{ status, statusSince, activeCallId, lastAssignedAt, skills, queues, instanceId }`.
Setiap perubahan → tulis Redis + publish event → worker menuliskan `agent_status_events` ke MySQL (asinkron, untuk pelaporan).

### 7.5 Mesin ACD

```
Loop (tick 250 ms, hanya pada pemegang lock `acd:leader`):
  Untuk setiap antrian dengan panggilan menunggu (ZSET `queue:{queueId}:waiting`, score = enqueuedAt):
    1. Ambil panggilan terdepan
    2. Cari kandidat agent: status AVAILABLE, skill memenuhi, tidak sedang ditawari
    3. Urutkan sesuai strategi antrian
    4. Ambil kandidat pertama → set `offer:{callId}` (TTL = ring_timeout) → kirim WS
    5. Bila ditolak/timeout → tandai agent no-answer, coba kandidat berikutnya
    6. Bila max_wait terlampaui → jalankan overflow_action
```

---

## 8. Transaksi & konsistensi

- Satu use case = satu transaksi database bila menyentuh > 1 agregat. Gunakan pola **Unit of Work** (`runInTransaction(cb)`) berbasis `DataSource.transaction`.
- Panggilan ke Graph API **tidak boleh** berada di dalam transaksi database. Pola: transaksi → commit → panggil API → transaksi kedua untuk menyimpan hasil. Bila panggilan API gagal setelah commit, state panggilan dikembalikan lewat kompensasi eksplisit yang tercatat di `call_events`.
- Domain event dipublikasikan setelah commit (outbox sederhana: tabel `domain_events` + poller, agar tidak hilang saat crash).

---

## 9. Dependency yang disetujui

### 9.1 Backend

| Paket | Kegunaan |
|---|---|
| `hono`, `@hono/node-server`, `@hono/node-ws` | HTTP + WebSocket |
| `@hono/zod-validator`, `@hono/zod-openapi`, `@scalar/hono-api-reference` | Validasi & dokumentasi API |
| `zod` | Skema & validasi |
| `typeorm`, `mysql2`, `reflect-metadata` | ORM & driver |
| `ioredis` | Redis client |
| `bullmq` | Job queue & scheduler |
| `pino`, `pino-pretty` | Logging |
| `prom-client` | Metrics |
| `argon2` | Password hashing |
| `jose` | JWT sign/verify |
| `otplib`, `qrcode` | TOTP 2FA & QR |
| `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | Object storage (MinIO/S3) |
| `nodemailer` | Email |
| `undici` | HTTP client ke Graph API |
| `date-fns`, `date-fns-tz` | Tanggal & zona waktu |
| `libphonenumber-js` | Normalisasi nomor E.164 |
| `nanoid` / `uuid` | ID |
| `exceljs`, `csv-stringify` | Ekspor laporan |
| `vitest`, `@vitest/coverage-v8`, `testcontainers`, `msw`, `@faker-js/faker` | Testing |
| `eslint`, `@typescript-eslint/*`, `eslint-plugin-boundaries`, `prettier` | Kualitas kode |

### 9.2 Frontend

| Paket | Kegunaan |
|---|---|
| `nuxt` (4.x), `vue` | Framework |
| `@mantine-vue/core`, `@mantine-vue/nuxt` (bila tersedia) | UI component |
| `@tabler/icons-vue` | Ikon |
| `pinia`, `@pinia/nuxt` | State management |
| `@vueuse/core`, `@vueuse/nuxt` | Utilitas composable |
| `zod` | Validasi form (via `packages/contracts`) |
| `@nuxtjs/i18n` | Internasionalisasi |
| `vue-echarts`, `echarts` | Grafik laporan & wallboard |
| `wavesurfer.js` | Pemutar rekaman + waveform |
| `qrcode` | QR deep link |
| `date-fns`, `date-fns-tz` | Tanggal |
| `vitest`, `@vue/test-utils`, `@nuxt/test-utils`, `playwright` | Testing |

**Menambah paket di luar daftar ini memerlukan ADR baru.**

---

## 10. Keputusan penting yang tidak boleh diubah tanpa ADR

| Keputusan | Alasan singkat |
|---|---|
| Tanpa media server pada Fase 1 | Browser sudah mampu jadi endpoint WebRTC yang memenuhi syarat Meta; menambah media server melipatgandakan kompleksitas tanpa manfaat untuk MVP |
| Redis sebagai sumber kebenaran state runtime | Backend stateless & dapat di-scale |
| Modular monolith, bukan microservice | Tim kecil, batas domain masih berevolusi |
| SDP answer di-cache, bukan digenerate ulang | Meta menolak `accept` bila SDP berbeda dari `pre_accept` |
| Media diarsipkan ke storage sendiri | Retensi Meta hanya 7 hari |
| Multi-tenant shared-schema dengan `organization_id` | Sederhana, cukup untuk skala target; isolasi ditegakkan di repository layer |
