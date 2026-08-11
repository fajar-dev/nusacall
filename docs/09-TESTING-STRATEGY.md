# 09 — Strategi Testing

---

## 1. Definition of Done (DoD) per task

Sebuah task dianggap selesai **hanya bila seluruh butir berikut terpenuhi**:

- [ ] Kode mengimplementasikan requirement yang direferensikan (ID `FR-*`/`NFR-*` dicantumkan di deskripsi PR)
- [ ] Unit test untuk seluruh logika domain & application yang ditambahkan
- [ ] Integration test untuk endpoint/handler/repository yang ditambahkan
- [ ] Test negatif: validasi gagal, tanpa izin, lintas tenant, state ilegal
- [ ] `pnpm verify` hijau (lint + typecheck + test + coverage threshold)
- [ ] Tidak ada `console.log`, `any` tanpa justifikasi, atau `TODO` tanpa nomor issue
- [ ] Dokumen terkait diperbarui bila kontrak berubah
- [ ] Migration memiliki `up` dan `down` yang teruji

---

## 2. Piramida & target

| Level | Cakupan | Alat | Porsi | Target durasi |
|---|---|---|---|---|
| Unit | Domain entity, state machine, value object, use case (dependensi di-mock), util SDP/MOS | Vitest | ~65% | < 20 detik |
| Integration | Repository (MySQL nyata), route HTTP (Hono `app.request`), handler WS, worker job, adapter Meta (MSW) | Vitest + Testcontainers + MSW | ~30% | < 3 menit |
| E2E | Alur pengguna kritis di UI | Playwright | ~5% | < 8 menit |

Threshold coverage (gagal build bila kurang):

```ts
// vitest.config.ts (backend)
coverage: {
  provider: 'v8',
  thresholds: {
    lines: 75, functions: 75, branches: 70, statements: 75,
    'src/modules/**/domain/**':      { lines: 95, branches: 90 },
    'src/modules/**/application/**': { lines: 90, branches: 85 },
  },
}
```

---

## 3. Struktur & penamaan

```
apps/backend/
├─ src/**/*.ts
├─ src/**/*.spec.ts            # unit test, bersebelahan dengan sumber
└─ tests/
   ├─ integration/
   │  ├─ setup/
   │  │  ├─ containers.ts       # Testcontainers MySQL + Redis
   │  │  ├─ testApp.ts          # bangun Hono app dengan container uji
   │  │  └─ seed.ts
   │  ├─ fixtures/
   │  │  ├─ metaWebhooks.ts     # payload webhook nyata (dianonimkan)
   │  │  └─ sdp.ts              # contoh SDP offer/answer
   │  ├─ mocks/metaServer.ts    # MSW handler Graph API
   │  └─ **/*.int.spec.ts
   └─ contract/
      └─ metaSchemas.spec.ts    # validasi skema Zod terhadap payload nyata
```

Penamaan test: `describe('<Unit>')` → `it('<perilaku yang diharapkan> [FR-CALL-007]')`.

---

## 4. Mocking Graph API (WAJIB)

Seluruh test **tidak boleh** memanggil Meta sungguhan. Gunakan MSW dengan handler yang mereplikasi kontrak di `03-WHATSAPP-CALLING-SPEC.md`.

```ts
// tests/integration/mocks/metaServer.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const metaHandlers = [
  http.post('https://graph.facebook.com/:version/:phoneNumberId/calls', async ({ request }) => {
    const body = await request.json() as any;

    if (body.action === 'connect') {
      if (body.to === '628000000000') {
        return HttpResponse.json(
          { error: { message: 'No permission', code: 138006, fbtrace_id: 'x' } },
          { status: 400 },
        );
      }
      return HttpResponse.json({ messaging_product: 'whatsapp', calls: [{ id: 'wacid.TEST123' }] });
    }

    if (['pre_accept', 'accept', 'reject', 'terminate'].includes(body.action)) {
      return HttpResponse.json({ messaging_product: 'whatsapp', success: true });
    }

    return HttpResponse.json({ error: { message: 'bad action', code: 100 } }, { status: 400 });
  }),

  http.get('https://graph.facebook.com/:version/:phoneNumberId/settings', () =>
    HttpResponse.json({
      calling: {
        status: 'ENABLED',
        call_icon_visibility: 'DEFAULT',
        callback_permission_status: 'ENABLED',
        call_hours: { status: 'DISABLED' },
        sip: { status: 'DISABLED' },
      },
    })),
];

export const metaServer = setupServer(...metaHandlers);
```

Skenario error yang WAJIB tersedia sebagai handler khusus: `138006` (tanpa izin), `131026` (client lama), `429`, `500`, timeout, dan `accept` dengan SDP berbeda dari `pre_accept`.

---

## 5. Test wajib per area

### 5.1 State machine panggilan

```ts
describe('CallStateMachine [FR-CALL-015]', () => {
  it.each([
    ['QUEUED', 'OFFERING', true],
    ['OFFERING', 'PRE_ACCEPTED', true],
    ['PRE_ACCEPTED', 'ACTIVE', true],
    ['ACTIVE', 'WRAP_UP', true],
    ['WRAP_UP', 'COMPLETED', true],
    ['QUEUED', 'ACTIVE', false],
    ['COMPLETED', 'ACTIVE', false],
    ['WRAP_UP', 'OFFERING', false],
  ])('transisi %s → %s = %s', (from, to, expected) => {
    expect(CallStateMachine.canTransition(from as CallState, to as CallState)).toBe(expected);
  });
});
```

### 5.2 Alur panggilan masuk (integration)

Skenario minimal yang wajib ada:

1. Webhook `connect` valid → `webhook_events` tersimpan, respons 200 < 300 ms, job ter-enqueue.
2. Webhook dengan signature salah → tidak diproses, `signature_valid = 0`, tetap 200.
3. Webhook duplikat (body identik) → hanya satu baris, satu job.
4. Job memproses → `Call` dibuat state `QUEUED`, kontak dibuat/ditemukan, antrian sesuai routing rule.
5. ACD menawarkan ke agent yang benar sesuai skill & strategi; agent tanpa skill tidak pernah ditawari.
6. `call.answer_sdp` diterima → `pre_accept` dipanggil dengan SDP yang tepat, SDP tersimpan di cache.
7. `call.answer` → `accept` dipanggil dengan **SDP identik**; assert argumen ke gateway.
8. Cache SDP kosong saat `accept` → error `SDP_ANSWER_MISSING` dan panggilan di-`reject`.
9. Timeout 30 detik tanpa jawaban → `reject`, ditawarkan ke kandidat berikutnya, `offer_attempts` bertambah.
10. Tidak ada agent sampai `max_wait_seconds` → `overflow_action` dijalankan.
11. Webhook `terminate` → state `WRAP_UP`, durasi tersimpan dari `meta_duration_seconds`.
12. Disposisi diisi → state `COMPLETED`, agent kembali `AVAILABLE`.

### 5.3 Isolasi tenant (wajib untuk SETIAP repository)

```ts
describe('TypeOrmCallRepository — isolasi tenant [FR-TEN-002]', () => {
  it('tidak mengembalikan panggilan milik organisasi lain', async () => {
    const orgA = await seedOrganization(); const orgB = await seedOrganization();
    const callB = await seedCall({ organizationId: orgB.id });

    const repo = new TypeOrmCallRepository(ds, { organizationId: orgA.id });
    expect(await repo.findById(callB.id)).toBeNull();
    expect((await repo.list({})).items).toHaveLength(0);
  });
});
```

### 5.4 Panggilan keluar & izin

- Menolak `POST /calls/outbound` bila ledger izin bukan `GRANTED_*` (`422 BUSINESS_RULE_VIOLATION`).
- Error `138006` dari Meta → ledger menjadi `UNKNOWN`, panggilan `FAILED`, pesan UI sesuai.
- Kuota CPR: permintaan ke-2 dalam 24 jam ditolak sebelum memanggil API (assert gateway **tidak** dipanggil).
- Nomor `RESTRICTED` → panggilan keluar diblokir.

### 5.5 Media & arsip

- `call_recording_available` → job unduh, verifikasi `sha256` (uji juga kasus hash tidak cocok → `FAILED`, tidak disimpan).
- URL kedaluwarsa (403) → mengambil URL baru lewat Media API lalu berhasil.
- Kegagalan berulang → retry sesuai backoff, setelah batas → status `FAILED` + notifikasi.
- Parsing transkrip: segmen, speaker, channel, `full_text` terisi; uji dengan dokumen berbahasa Indonesia.
- Job verifikasi harian menandai media yang mendekati 7 hari tanpa arsip.

### 5.6 Validasi settings Meta

Uji seluruh aturan di `03-...` §3.2: > 2 entri per hari ditolak, waktu tumpang tindih ditolak, `open_time ≥ close_time` ditolak, > 20 hari libur ditolak, tanggal libur lampau ditolak, `announcement_language` di luar daftar ditolak, `purpose` > 250 karakter ditolak, `purpose` kosong saat status `ENABLED` ditolak.

### 5.7 Util SDP

- `mungeSdp` menyisakan hanya Opus & telephone-event.
- `a=ptime:20` selalu ada setelah munging.
- Baris `a=setup`, `a=fingerprint`, `a=ice-ufrag`, `a=candidate` **tidak berubah** (uji dengan perbandingan tepat).
- Idempoten: `munge(munge(x)) === munge(x)`.

### 5.8 Frontend

Unit (Vitest + `@vue/test-utils`):
- Store `softphone`: seluruh transisi state machine termasuk jalur error.
- `PeerConnectionManager` dengan `RTCPeerConnection` palsu: memastikan mic tidak aktif sebelum `call.accepted`, `replaceTrack` tidak memicu renegotiation, `close()` idempoten.
- Komponen `SoftphoneDock` untuk setiap state (snapshot + interaksi keyboard).
- Paritas kunci i18n `id` vs `en`.

E2E (Playwright, backend uji + Meta di-mock):
1. Login agent → set `AVAILABLE` → simulasikan webhook masuk → tawaran muncul → jawab → panggilan aktif → tutup → isi disposisi → agent `AVAILABLE`.
2. Admin mengubah jam operasional → validasi tumpang tindih muncul → simpan berhasil → nilai tersinkron.
3. Supervisor mencari panggilan berdasarkan kata dalam transkrip → membuka detail → memutar rekaman.
4. Agent mencoba menelepon kontak tanpa izin → tombol nonaktif → kirim CPR → status berubah.

Untuk E2E, WebRTC dijalankan dengan flag Chromium `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`, dan sisi Meta digantikan **echo peer** lokal (implementasi `wrtc`/peer palsu di server uji) agar SDP dapat dinegosiasikan sungguhan.

---

## 6. Fixture payload webhook

`tests/integration/fixtures/metaWebhooks.ts` WAJIB memuat payload untuk: `connect` UIC, `connect` BIC, status `RINGING`/`ACCEPTED`/`REJECTED`, `terminate` COMPLETED, `terminate` FAILED dengan `errors`, `call_recording_available`, `call_transcription_available`, `account_settings_update`, `account_update` (violation & restriction). Semua disalin dari `03-WHATSAPP-CALLING-SPEC.md` dan dianonimkan.

Fixture ini juga dipakai `tests/contract/metaSchemas.spec.ts` untuk memastikan skema Zod parser tidak pernah menolak payload sah.

---

## 7. Test kinerja (ringan, di CI nightly)

- k6/autocannon: 500 webhook/detik selama 60 detik → p95 respons ≤ 300 ms, tanpa kehilangan event.
- Simulasi 200 koneksi WS + 50 panggilan bersamaan → memori stabil, tanpa kebocoran handler.

---

## 8. Perintah

```bash
pnpm test              # seluruh unit test
pnpm test:int          # integration (butuh Docker untuk Testcontainers)
pnpm test:e2e          # Playwright
pnpm test:cov          # coverage + threshold
pnpm verify            # lint + typecheck + test + cov  ← WAJIB sebelum commit
```

---

## 9. Aturan test yang tidak boleh dilanggar

1. Test **tidak boleh** bergantung pada urutan eksekusi.
2. Setiap integration test membersihkan datanya sendiri (transaksi rollback atau truncate terkontrol).
3. Waktu selalu di-mock (`vi.useFakeTimers`) untuk logika timeout/retensi — dilarang `setTimeout` nyata di test.
4. Tidak ada `sleep` arbitrer; gunakan `waitFor`/polling dengan batas jelas.
5. Assertion harus spesifik: bandingkan argumen pemanggilan gateway, bukan sekadar "terpanggil".
6. Setiap perbaikan bug WAJIB disertai test regresi yang gagal sebelum perbaikan.
