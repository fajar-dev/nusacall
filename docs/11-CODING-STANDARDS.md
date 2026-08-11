# 11 — Standar Penulisan Kode

---

## 1. TypeScript

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true
  }
}
```

Aturan:
- `any` dilarang. Gunakan `unknown` + penyempitan tipe. Pengecualian hanya di boundary library eksternal dengan komentar `// eslint-disable-next-line ... -- alasan`.
- Tipe eksplisit untuk seluruh nilai balik fungsi publik.
- Gunakan `type` untuk union/utility, `interface` untuk kontrak objek yang dapat diperluas.
- Dilarang enum TypeScript numerik; gunakan `as const` object atau union string.
- Semua boundary I/O (HTTP, WS, webhook, job, env) diparsing dengan Zod — jangan pernah melakukan type assertion pada data eksternal.

---

## 2. Penamaan

| Elemen | Konvensi | Contoh |
|---|---|---|
| File kelas/komponen | PascalCase | `PeerConnectionManager.ts`, `SoftphoneDock.vue` |
| File util/composable | camelCase | `formatDuration.ts`, `useSoftphone.ts` |
| Folder | kebab-case | `wa-accounts/`, `use-cases/` |
| Kelas, tipe, interface | PascalCase | `AcceptCall`, `CallState` |
| Variabel & fungsi | camelCase | `resolveQueue()` |
| Konstanta modul | SCREAMING_SNAKE | `MAX_ANSWER_SECONDS` |
| Tabel & kolom DB | snake_case | `call_recordings`, `meta_duration_seconds` |
| Kunci Redis | `domain:entity:id` | `sdp:answer:wacid.ABC`, `agent:01J8...` |
| Event domain | PascalCase + `Event` | `CallAnsweredEvent` |
| Nama job | `domain.action` | `webhook.process`, `media.download` |
| Pesan WS | `domain.action` | `call.offer`, `agent.set_status` |
| Kode error aplikasi | SCREAMING_SNAKE | `SDP_ANSWER_MISSING` |

Larangan penamaan: singkatan tidak jelas (`mgr`, `svc`, `tmp2`), nama generik (`data`, `info`, `handler2`), Hungarian notation.

---

## 3. Struktur use case (pola wajib)

```ts
export interface AcceptCallInput {
  callId: string;
  agentUserId: string;
  tenant: TenantContext;
}

export interface AcceptCallOutput {
  callId: string;
  state: CallState;
  recording: boolean;
  transcription: boolean;
}

export class AcceptCall {
  constructor(
    private readonly calls: CallRepository,
    private readonly meta: MetaCallingGateway,
    private readonly sdpCache: SdpCache,
    private readonly policy: RecordingPolicyService,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}

  async execute(input: AcceptCallInput): Promise<AcceptCallOutput> {
    const call = await this.calls.findById(input.callId);
    if (!call) throw new NotFoundError('CALL_NOT_FOUND');
    if (!call.isAssignedTo(input.agentUserId)) throw new ForbiddenError('CALL_NOT_ASSIGNED_TO_AGENT');

    const sdpAnswer = await this.sdpCache.getAnswer(call.wacid);
    if (!sdpAnswer) throw new ConflictError('SDP_ANSWER_MISSING');

    const options = await this.policy.resolveFor(call);

    await this.meta.acceptCall({
      phoneNumberId: call.metaPhoneNumberId,
      callId: call.wacid,
      sdpAnswer,
      recording: options.recording,
      transcription: options.transcription,
      bizOpaqueCallbackData: call.id,
    });

    call.markAccepted(this.clock.now(), options);
    await this.calls.save(call);
    await this.events.publishAll(call.pullEvents());

    return { callId: call.id, state: call.state, recording: options.recording.enabled, transcription: options.transcription.enabled };
  }
}
```

Aturan:
- Satu use case = satu file = satu kelas dengan satu metode publik `execute`.
- Konstruktor hanya menerima port (interface), tidak pernah implementasi konkret.
- `Clock` di-inject (dilarang `new Date()` langsung di domain/application) agar dapat diuji.
- Tidak ada akses `process.env` di luar `bootstrap/config.ts`.

---

## 4. Penanganan error

```ts
export abstract class AppError extends Error {
  abstract readonly httpStatus: number;
  constructor(readonly code: string, message: string, readonly details?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError      { readonly httpStatus = 404; }
export class ForbiddenError extends AppError     { readonly httpStatus = 403; }
export class ConflictError extends AppError      { readonly httpStatus = 409; }
export class BusinessRuleError extends AppError  { readonly httpStatus = 422; }
export class UpstreamMetaError extends AppError  { readonly httpStatus = 502; }
```

Aturan:
- **Dilarang** melempar string atau objek biasa.
- `catch (err: unknown)` lalu penyempitan tipe; jangan menelan error tanpa log.
- Pesan `message` untuk pengguna dalam Bahasa Indonesia; detail teknis di `details`.
- Error dari Meta selalu dibungkus `UpstreamMetaError` yang menyimpan `metaCode`, `metaSubcode`, `fbtraceId`.
- Retry hanya untuk kegagalan transien yang teridentifikasi (jaringan, 5xx, 429), tidak pernah untuk 4xx.

---

## 5. Logging

```ts
logger.info({
  event: 'call.accepted',
  callId: call.id,
  wacid: maskWacid(call.wacid),
  agentId: input.agentUserId,
  organizationId: input.tenant.organizationId,
  durationMs: timer.elapsed(),
}, 'Panggilan diterima agent');
```

Aturan:
- Objek pertama, pesan kedua (gaya pino).
- Setiap log menyertakan `correlationId` (otomatis via AsyncLocalStorage).
- Level: `error` (butuh tindakan), `warn` (anomali tertangani), `info` (peristiwa bisnis), `debug` (detail pengembangan, mati di produksi).
- **Dilarang** `console.log` di kode produksi (ditegakkan ESLint).
- Field sensitif diredaksi otomatis (lihat `08-SECURITY-COMPLIANCE.md` §7).

---

## 6. Git & commit

Format **Conventional Commits**, ringkas dan jelas, tanpa trailer co-author:

```
feat(calling): tambah use case pre-accept panggilan masuk

Menyimpan SDP answer di Redis agar accept memakai SDP identik.
Refs: FR-CALL-006, FR-CALL-007
```

Tipe yang dipakai: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`.
Scope = nama modul (`calling`, `routing`, `media`, `web`, `infra`).

Branch: `feat/<epic>-<ringkas>`, `fix/<issue>-<ringkas>`.
PR wajib memuat: ringkasan, ID requirement, cara menguji, dan checklist DoD.

---

## 7. Aturan ukuran & kompleksitas

| Aturan | Batas |
|---|---|
| Panjang file | ≤ 400 baris |
| Panjang fungsi | ≤ 50 baris |
| Parameter fungsi | ≤ 4 (lebih dari itu gunakan objek input) |
| Kedalaman nesting | ≤ 3 |
| Complexity siklomatik | ≤ 12 |

Pelanggaran memerlukan komentar justifikasi dan persetujuan reviewer.

---

## 8. Konfigurasi ESLint (inti)

```js
rules: {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
  'no-console': 'error',
  'no-restricted-imports': ['error', { patterns: [
    { group: ['**/modules/*/infrastructure/**'], message: 'Modul lain hanya boleh diakses lewat application/port.' },
    { group: ['typeorm'], importNames: ['*'], message: 'TypeORM hanya boleh diimpor di layer infrastructure.' },
  ]}],
  'boundaries/element-types': ['error', { default: 'disallow', rules: [
    { from: 'domain',         allow: ['shared'] },
    { from: 'application',    allow: ['domain', 'shared'] },
    { from: 'infrastructure', allow: ['domain', 'application', 'shared'] },
    { from: 'interface',      allow: ['application', 'shared'] },
  ]}],
}
```

Tambahan khusus frontend:
```js
'vue/multi-word-component-names': 'error',
'vue/component-api-style': ['error', ['script-setup']],
'no-restricted-globals': ['error', { name: 'localStorage', message: 'Gunakan composable usePersistedState.' }],
```

---

## 9. Konvensi Vue/Nuxt

- Wajib `<script setup lang="ts">`.
- Urutan blok: `<script setup>` → `<template>` → `<style scoped>`.
- Props & emit didefinisikan dengan tipe generik (`defineProps<Props>()`).
- Komponen tidak melakukan fetch data domain langsung — gunakan composable.
- Nama komponen multi-kata dengan prefiks domain: `CallOfferCard`, `QueueStatsTable`, `AdminPhoneNumberForm`.
- Style: utamakan token & komponen Mantine; CSS kustom minimal dan selalu `scoped`.

---

## 10. Komentar & dokumentasi kode

- Komentar menjelaskan **mengapa**, bukan **apa**.
- Setiap use case, adapter Meta, dan util SDP memiliki TSDoc singkat yang mereferensikan bagian dokumen terkait, mis. `/** Lihat 03-WHATSAPP-CALLING-SPEC.md §3.1c */`.
- `TODO` wajib berformat `// TODO(#123): ...`; tanpa nomor issue akan ditolak lint.

---

## 11. Checklist review PR

- [ ] Requirement yang dirujuk benar-benar terpenuhi
- [ ] Batas layer tidak dilanggar
- [ ] Query ter-scope tenant
- [ ] Panggilan Graph API tidak berada di dalam transaksi DB
- [ ] Tidak ada rahasia/SDP yang ter-log
- [ ] Error dipetakan ke `AppError` yang tepat
- [ ] Test menyertakan jalur gagal, bukan hanya jalur bahagia
- [ ] Migration reversible
- [ ] Teks UI melalui i18n
- [ ] Tidak ada dependency baru di luar daftar yang disetujui
