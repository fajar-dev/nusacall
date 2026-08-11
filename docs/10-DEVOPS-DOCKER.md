# 10 — DevOps, Docker & Operasional

---

## 1. Prasyarat

- Docker Engine ≥ 26 dan Docker Compose v2
- Node.js 22 + pnpm 9 (untuk menjalankan skrip di host bila diperlukan)
- Akun Meta Developer dengan Meta App, WABA, dan minimal satu **public test number**
- Tunnel HTTPS publik untuk webhook saat pengembangan (Cloudflare Tunnel / ngrok)

---

## 2. Layanan pada `docker-compose.dev.yml`

| Service | Image | Port host | Keterangan |
|---|---|---|---|
| `mysql` | `mysql:8.0` | 3306 | Data utama |
| `redis` | `redis:7-alpine` | 6379 | State runtime, queue, pub/sub |
| `minio` | `minio/minio` | 9000, 9001 | Object storage kompatibel S3 |
| `minio-init` | `minio/mc` | — | Membuat bucket `nusacall-media` |
| `backend` | build lokal | 3001 | `APP_ROLE=all` saat dev |
| `web` | build lokal | 3000 | Nuxt dev server |
| `adminer` | `adminer` | 8080 | Inspeksi DB (dev saja) |
| `mailpit` | `axllent/mailpit` | 8025 | Penangkap email dev |
| `tunnel` | `cloudflare/cloudflared` | — | Meng-expose `backend` untuk webhook |

### 2.1 `docker-compose.dev.yml`

```yaml
name: nusacall

services:
  mysql:
    image: mysql:8.0
    command: >
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_0900_ai_ci
      --default-time-zone=+00:00
      --ngram_token_size=2
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpass}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-nusacall}
      MYSQL_USER: ${MYSQL_USER:-nusacall}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-nusacall}
    ports: ['3306:3306']
    volumes:
      - mysql-data:/var/lib/mysql
      - ./docker/mysql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost', '-p${MYSQL_ROOT_PASSWORD:-rootpass}']
      interval: 5s
      timeout: 5s
      retries: 20

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports: ['6379:6379']
    volumes: ['redis-data:/data']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      retries: 20

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minioadmin}
    ports: ['9000:9000', '9001:9001']
    volumes: ['minio-data:/data']
    healthcheck:
      test: ['CMD', 'mc', 'ready', 'local']
      interval: 5s
      retries: 20

  minio-init:
    image: minio/mc
    depends_on: { minio: { condition: service_healthy } }
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 ${S3_ACCESS_KEY:-minioadmin} ${S3_SECRET_KEY:-minioadmin} &&
      mc mb --ignore-existing local/${S3_BUCKET:-nusacall-media} &&
      mc anonymous set none local/${S3_BUCKET:-nusacall-media}"

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
      target: development
    env_file: [.env]
    environment:
      APP_ROLE: all
      NODE_ENV: development
    ports: ['3001:3001', '9229:9229']
    volumes:
      - ./apps/backend:/app/apps/backend
      - ./packages:/app/packages
      - backend-node-modules:/app/node_modules
    depends_on:
      mysql: { condition: service_healthy }
      redis: { condition: service_healthy }
      minio: { condition: service_healthy }
    command: pnpm --filter backend dev

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: development
    env_file: [.env]
    environment:
      NUXT_PUBLIC_API_BASE_URL: http://localhost:3001
      NUXT_PUBLIC_WS_URL: ws://localhost:3001/ws
    ports: ['3000:3000']
    volumes:
      - ./apps/web:/app/apps/web
      - ./packages:/app/packages
      - web-node-modules:/app/node_modules
    depends_on: [backend]
    command: pnpm --filter web dev

  adminer:
    image: adminer
    ports: ['8080:8080']
    depends_on: [mysql]

  mailpit:
    image: axllent/mailpit
    ports: ['8025:8025', '1025:1025']

  tunnel:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate --url http://backend:3001
    depends_on: [backend]

volumes:
  mysql-data: {}
  redis-data: {}
  minio-data: {}
  backend-node-modules: {}
  web-node-modules: {}
```

> `--ngram_token_size=2` diperlukan agar FULLTEXT dengan parser ngram bekerja baik untuk Bahasa Indonesia (lihat `04-DATA-MODEL.md` §4.21).

### 2.2 Dockerfile backend (multi-stage)

```dockerfile
# apps/backend/Dockerfile
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache tini
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile

FROM deps AS development
COPY . .
EXPOSE 3001 9229
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "--filter", "backend", "dev"]

FROM deps AS build
COPY . .
RUN pnpm --filter backend build && pnpm prune --prod

FROM node:22-alpine AS production
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/apps/backend/dist ./apps/backend/dist
COPY --from=build --chown=app:app /app/packages ./packages
USER app
ENV NODE_ENV=production APP_ROLE=api
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/backend/dist/main.js"]
```

Dockerfile frontend mengikuti pola serupa dengan target `development` (nuxt dev) dan `production` (`node .output/server/index.mjs`).

### 2.3 Compose produksi

`docker-compose.yml` menjalankan `backend-api` (`APP_ROLE=api`, replika ≥ 2), `backend-worker` (`APP_ROLE=worker`), `backend-scheduler` (`APP_ROLE=scheduler`, replika **tepat 1**), dan `web`, di belakang reverse proxy (Nginx/Traefik) yang menangani TLS, WebSocket upgrade, dan sticky-session **tidak diperlukan** (registry socket berbasis Redis).

Konfigurasi Nginx yang wajib untuk WebSocket:
```nginx
location /ws {
  proxy_pass http://backend;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;
}
location /webhooks/ {
  proxy_pass http://backend;
  proxy_request_buffering off;   # raw body untuk verifikasi HMAC
  client_max_body_size 2m;
}
```

---

## 3. Variabel lingkungan

`.env.example` (WAJIB dibuat, tanpa nilai rahasia nyata):

```dotenv
# ── Aplikasi ────────────────────────────────
NODE_ENV=development
APP_ROLE=all                      # api | worker | scheduler | all
APP_PORT=3001
APP_BASE_URL=http://localhost:3001
WEB_BASE_URL=http://localhost:3000
LOG_LEVEL=debug

# ── Database ────────────────────────────────
DB_HOST=mysql
DB_PORT=3306
DB_NAME=nusacall
DB_USER=nusacall
DB_PASSWORD=nusacall
DB_CONNECTION_LIMIT=20

# ── Redis ───────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Object storage ──────────────────────────
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=nusacall-media
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true

# ── Keamanan ────────────────────────────────
JWT_SECRET=                       # >= 32 byte acak
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
SECRET_ENCRYPTION_KEYS=k1:<base64-32-byte>
SECRET_ENCRYPTION_ACTIVE_KEY_ID=k1
CORS_ORIGINS=http://localhost:3000

# ── Meta / WhatsApp ─────────────────────────
META_GRAPH_BASE_URL=https://graph.facebook.com
META_GRAPH_VERSION=v23.0
META_HTTP_TIMEOUT_MS=10000
PUBLIC_WEBHOOK_BASE_URL=          # URL tunnel, mis. https://xxx.trycloudflare.com

# ── Panggilan ───────────────────────────────
CALL_ANSWER_TIMEOUT_SECONDS=30
CALL_RING_TIMEOUT_SECONDS=15
SDP_CACHE_TTL_SECONDS=300
ACD_TICK_MS=250

# ── Media ───────────────────────────────────
MEDIA_DOWNLOAD_MAX_ATTEMPTS=8
MEDIA_ARCHIVE_DEADLINE_HOURS=24

# ── Email ───────────────────────────────────
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM=no-reply@nusacall.local

# ── AI (opsional) ───────────────────────────
LLM_ENABLED=false
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
```

Seluruh env divalidasi saat boot dengan Zod di `bootstrap/config.ts`; aplikasi **gagal start** bila ada yang tidak valid.

---

## 4. Setup pengembangan pertama kali

```bash
cp .env.example .env
# isi JWT_SECRET & SECRET_ENCRYPTION_KEYS:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

docker compose -f docker-compose.dev.yml up -d mysql redis minio minio-init
pnpm install
pnpm --filter backend migration:run
pnpm --filter backend seed

docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml logs -f tunnel   # ambil URL publik
```

Lalu di Meta App Dashboard:
1. Webhooks → Callback URL: `https://<tunnel>/webhooks/meta/<metaAppId>`, Verify Token: sesuai yang didaftarkan di aplikasi.
2. Subscribe field: **`calls`**, `messages`, `account_update`, `account_settings_update`, `message_template_status_update`.
3. Subscribe app ke WABA nomor uji.
4. Aktifkan calling di nomor uji melalui UI aplikasi (`/admin/phone-numbers/:id`) atau WhatsApp Manager.

Akses: web `http://localhost:3000`, API docs `http://localhost:3001/api/docs`, Adminer `:8080`, MinIO Console `:9001`, Mailpit `:8025`.

---

## 5. Skrip npm standar

```jsonc
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:int": "turbo run test:int",
    "test:e2e": "turbo run test:e2e",
    "verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm test:int",
    "migration:generate": "pnpm --filter backend migration:generate",
    "migration:run": "pnpm --filter backend migration:run",
    "migration:revert": "pnpm --filter backend migration:revert",
    "seed": "pnpm --filter backend seed"
  }
}
```

---

## 6. CI/CD (GitHub Actions)

Pipeline `ci.yml`:

1. `setup` — checkout, pnpm cache, install
2. `lint` — ESLint + Prettier check
3. `typecheck` — `tsc --noEmit` untuk seluruh workspace
4. `test-unit` — Vitest + coverage threshold
5. `test-integration` — service container MySQL & Redis, jalankan migration lalu `test:int`
6. `test-e2e` — build, jalankan compose uji, Playwright
7. `security` — `pnpm audit --audit-level=high`, `gitleaks`
8. `build-images` — build & push image (hanya di branch `main`/tag)

Gate merge: langkah 2–7 wajib hijau. Coverage turun > 2% dari base → gagal.

---

## 7. Observability

- `/metrics` diekspos untuk Prometheus. Metrik kustom minimum:
  `nusacall_webhook_duration_seconds`, `nusacall_webhook_total{field,status}`,
  `nusacall_calls_total{direction,end_reason}`, `nusacall_calls_active`,
  `nusacall_queue_wait_seconds`, `nusacall_meta_api_total{endpoint,code}`,
  `nusacall_media_archive_total{status}`, `nusacall_ws_connections`.
- Log JSON dikirim ke agregator (Loki/ELK) dengan label `service`, `role`, `env`.
- Alert wajib: webhook error rate > 1% (5 menit), lag antrian job > 60 detik, media gagal arsip, nomor `RESTRICTED`, answer rate harian < 70%, `ws_connections` turun drastis.

---

## 8. Backup & pemulihan

| Aset | Frekuensi | Retensi | Uji restore |
|---|---|---|---|
| MySQL (dump logis + binlog) | Harian penuh, binlog kontinu | 30 hari | Triwulanan |
| Object storage | Replikasi/versioning | Sesuai retensi organisasi | Triwulanan |
| Redis | Tidak di-backup (state sementara) | — | — |

Catatan: kehilangan Redis menyebabkan seluruh agent harus login ulang dan panggilan yang sedang ditawarkan hilang, tetapi tidak menghilangkan data historis.

---

## 9. Runbook

### 9.1 Webhook tidak diterima
1. Cek `webhook_events` — ada baris baru?
2. Bila kosong: verifikasi URL callback di Meta App, status tunnel, dan langganan field `calls`.
3. Bila ada tetapi `signature_valid = 0`: app secret salah atau body ter-buffer/terubah proxy → periksa konfigurasi Nginx `proxy_request_buffering off`.
4. Bila `status = FAILED`: baca `last_error`, perbaiki, jalankan `pnpm --filter backend job:replay-webhooks --ids=...`.

### 9.2 Panggilan masuk tidak sampai ke agent
Urutan pemeriksaan: nomor `calling_status = ENABLED` → di dalam `call_hours` → routing rule menghasilkan antrian → ada agent `AVAILABLE` dengan skill yang cocok → ACD leader aktif (`redis GET acd:leader`) → socket agent terhubung (`ws:user:<id>`) → cek `call_events` panggilan tersebut.

### 9.3 `accept` gagal
Penyebab tersering: SDP answer berbeda dari `pre_accept`. Periksa `call_events` — pastikan hash SDP `ACTION_PRE_ACCEPT` dan `ACTION_ACCEPT` identik. Bila berbeda, ada bug yang membuat ulang answer di frontend.

### 9.4 Rekaman tidak muncul
Cek `call_recordings.status` dan `attempts`. `FAILED` dengan 403 → URL kedaluwarsa dan pengambilan URL baru gagal → periksa token & `meta_media_id`. Bila `meta_expires_at` sudah lewat, media hilang permanen di sisi Meta.

### 9.5 Nomor dibekukan Meta
1. Baca `restrictions` di `wa_phone_numbers` dan notifikasi terkait.
2. Hentikan seluruh kampanye keluar untuk nomor tersebut.
3. Tinjau answer rate & feedback; sesuaikan `call_hours` atau sembunyikan tombol call sementara.
4. Tunggu `expiration`; jangan mencoba mengakali pembatasan.

### 9.6 Rotasi token Meta darurat
1. Buat token baru di Meta Business.
2. `PATCH /api/v1/phone-numbers/:id` dengan token baru (tersimpan terenkripsi).
3. `POST /phone-numbers/:id/test-connection` untuk verifikasi.
4. Token lama dicabut di Meta.

### 9.7 Deploy
Zero-downtime: rolling update `backend-api`; `backend-scheduler` dihentikan lebih dulu lalu dijalankan ulang setelah migration. Migration dijalankan sebagai job terpisah sebelum rollout. Rollback = deploy image sebelumnya + `migration:revert` bila migrasi tidak kompatibel mundur (hindari migrasi destruktif; pakai pola expand–migrate–contract).
