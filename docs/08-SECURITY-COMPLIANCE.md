# 08 — Keamanan & Kepatuhan

---

## 1. Model ancaman ringkas

| Aset | Ancaman | Mitigasi utama |
|---|---|---|
| Access token Meta per nomor | Pencurian → penyalahgunaan panggilan/pesan atas nama bisnis | Enkripsi AES-256-GCM at-rest, tidak pernah dikirim ke klien, akses hanya lewat `TokenResolver`, audit setiap pemakaian |
| App secret | Pemalsuan webhook | Enkripsi at-rest, verifikasi HMAC wajib, penolakan payload tanpa signature valid |
| Rekaman & transkrip | Kebocoran data percakapan pelanggan | Object storage privat, presigned URL berumur pendek, akses berbasis peran, audit unduhan, retensi terbatas |
| Data lintas tenant | Kebocoran antar organisasi | Scoping wajib di repository + test negatif |
| Sesi agent | Pembajakan sesi | Cookie httpOnly + SameSite, rotasi refresh token, deteksi reuse |
| Endpoint webhook | DoS / flooding | Rate limit, verifikasi cepat, penyimpanan mentah + pemrosesan asinkron |
| Media WebRTC | Penyadapan | DTLS-SRTP wajib (bawaan WebRTC), tidak ada media yang melewati server |

---

## 2. Autentikasi

- Hash password: **Argon2id**, `memoryCost=19456 KiB`, `timeCost=2`, `parallelism=1`.
- Access token: JWT (HS256 dengan secret ≥ 32 byte, atau EdDSA bila kunci asimetris dipakai), TTL 15 menit, klaim: `sub`, `org`, `role`, `perm` (hash daftar permission), `jti`, `iat`, `exp`.
- Refresh token: string acak 256-bit, disimpan **hanya hash-nya** (SHA-256), TTL 7 hari, rotasi setiap pemakaian, `family_id` untuk deteksi reuse. Reuse terdeteksi → seluruh family dicabut + notifikasi keamanan.
- Cookie: `httpOnly`, `secure`, `SameSite=Lax`, `Path=/`. Frontend tidak pernah membaca token.
- WS token: JWT terpisah, TTL 60 detik, sekali pakai (`jti` dicatat di Redis).
- 2FA TOTP: wajib untuk `PLATFORM_OWNER`, opsional lainnya; secret terenkripsi; 10 recovery code sekali pakai (disimpan sebagai hash).

---

## 3. Otorisasi (RBAC + permission granular)

Peran memetakan ke kumpulan permission. Pengecekan selalu pada level permission, bukan peran.

| Permission | PO | OA | SV | AG | VIEWER |
|---|---|---|---|---|---|
| `organization:manage` | ✓ | — | — | — | — |
| `organization:read` | ✓ | ✓ | ✓ | — | ✓ |
| `metaapp:manage` | ✓ | ✓ | — | — | — |
| `phonenumber:read` | ✓ | ✓ | ✓ | — | ✓ |
| `phonenumber:manage` | ✓ | ✓ | — | — | — |
| `user:manage` | ✓ | ✓ | — | — | — |
| `queue:manage` | ✓ | ✓ | — | — | — |
| `queue:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `agent:supervise` | ✓ | ✓ | ✓ | — | — |
| `call:accept` / `call:reject` / `call:terminate` | — | — | ✓ | ✓ | — |
| `call:initiate` | — | — | ✓ | ✓ | — |
| `call:read:own` | — | — | ✓ | ✓ | — |
| `call:read:all` | ✓ | ✓ | ✓ | — | ✓ |
| `recording:listen` | ✓ | ✓ | ✓ | — | — |
| `recording:download` | ✓ | ✓ | ✓ | — | — |
| `transcript:read` | ✓ | ✓ | ✓ | — | ✓ |
| `contact:manage` | ✓ | ✓ | ✓ | ✓ | — |
| `permission:request` | — | — | ✓ | ✓ | — |
| `report:read` | ✓ | ✓ | ✓ | — | ✓ |
| `audit:read` | ✓ | ✓ | — | — | — |

Aturan tambahan:
- `AGENT` hanya boleh membaca panggilan yang `assigned_agent_id`-nya dirinya (`call:read:own`), ditegakkan di query, bukan di UI.
- Rekaman panggilan yang ditangani agent sendiri **tidak** otomatis dapat diunduh olehnya (default `recording:download` tidak diberikan ke agent).
- Impersonation tenant oleh `PLATFORM_OWNER` memerlukan alasan tertulis dan menghasilkan audit log dengan `action = TENANT_IMPERSONATION_START/END`.

Middleware:

```ts
export const requirePermission = (perm: Permission) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const auth = c.get('auth');
    if (!auth) throw new UnauthenticatedError();
    if (!auth.permissions.includes(perm)) throw new ForbiddenError('MISSING_PERMISSION', { perm });
    await next();
  });
```

---

## 4. Enkripsi rahasia

```ts
// infrastructure/crypto/SecretCipher.ts
// Format tersimpan: v1:<keyId>:<iv(12B)>:<tag(16B)>:<ciphertext>  (semua base64url)
export class SecretCipher {
  encrypt(plain: string): Buffer;   // AES-256-GCM
  decrypt(blob: Buffer): string;    // memilih kunci berdasarkan keyId
}
```

- Kunci berasal dari env `SECRET_ENCRYPTION_KEYS` berformat `keyId:base64key` dipisah koma; `SECRET_ENCRYPTION_ACTIVE_KEY_ID` menentukan kunci untuk enkripsi baru.
- Rotasi kunci: tambahkan kunci baru, ubah active key, jalankan job `secrets:reencrypt`.
- Nilai terdekripsi **tidak boleh** disimpan di variabel modul, cache tanpa TTL, atau di-log. Cache diperbolehkan di memori dengan TTL ≤ 5 menit.
- `TokenResolver.getAccessToken(phoneNumberId)` adalah satu-satunya jalur pengambilan token; setiap pemanggilan menambah metrik `meta_token_access_total`.

---

## 5. Verifikasi webhook

```ts
export function verifyMetaSignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = header.slice(7);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}
```

Aturan:
- Body **mentah** wajib dibaca sebelum parsing JSON (gunakan `c.req.arrayBuffer()`); jangan memakai body hasil parse untuk HMAC.
- Signature tidak valid → simpan ke `webhook_events` dengan `signature_valid = 0`, status `SKIPPED`, balas `200` (agar Meta tidak retry), dan naikkan metrik + alert bila melebihi ambang.
- `verify_token` untuk `GET` dibandingkan dengan `timingSafeEqual`.

---

## 6. Perlindungan aplikasi

| Kontrol | Implementasi |
|---|---|
| Header keamanan | `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP ketat (frontend) |
| CORS | Allowlist origin dari env; kredensial diizinkan hanya untuk origin frontend |
| CSRF | Cookie `SameSite=Lax` + header kustom `X-Requested-With` wajib pada mutasi |
| Validasi input | Zod di seluruh boundary (HTTP, WS, webhook, job payload) |
| SQL injection | Hanya query builder/parameterized; `query()` mentah dilarang tanpa ADR |
| Upload | Hanya CSV impor kontak: maks 10 MB, validasi MIME + parsing streaming, tanpa eksekusi |
| SSRF | Tidak ada endpoint yang menerima URL dari pengguna; unduhan media hanya dari domain `lookaside.fbsbx.com`/`graph.facebook.com` (allowlist) |
| Dependency | `pnpm audit` + Dependabot/Renovate di CI, blokir severity high |
| Rahasia di repo | `gitleaks` di pre-commit dan CI |

---

## 7. Logging & redaksi

Field yang WAJIB diredaksi otomatis oleh serializer pino:
`password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `appSecret`, `verifyToken`, `authorization`, `cookie`, `sdp`, `totpSecret`, `recoveryCode`.

SDP tidak pernah masuk log atau `call_events`; yang disimpan adalah `sha256(sdp)` dan panjangnya. Nomor telepon di-log dalam bentuk termasker (`6281****5133`) kecuali pada level `debug` di lingkungan non-produksi.

---

## 8. Privasi & kepatuhan operasional

### 8.1 Rekaman

- Rekaman **hanya** boleh melalui fitur native Meta yang memutar pengumuman resmi kepada kedua pihak. **Dilarang keras** merekam audio di sisi browser (mis. `MediaRecorder` pada stream) — ini melewati mekanisme persetujuan.
- `purpose` yang disimpan harus mencerminkan tujuan sebenarnya dan ditinjau admin organisasi.
- Peserta yang tidak setuju dapat menutup panggilan sebelum/selama pengumuman; aplikasi mencatat kejadian ini sebagai `end_reason = REJECTED_BY_USER` tanpa perlakuan khusus.

### 8.2 Retensi & penghapusan

- Retensi arsip diatur `organizations.media_retention_days`; job harian menghapus objek storage + baris terkait dan mencatat penghapusan di audit log.
- Permintaan penghapusan data pelanggan: endpoint `DELETE /api/v1/contacts/:id/data` (peran `ORG_ADMIN`) menghapus rekaman, transkrip, ringkasan, catatan, dan menganonimkan `calls` (nomor diganti hash, `contact_id` dikosongkan) sambil mempertahankan agregat statistik.
- Ekspor data pelanggan: `GET /api/v1/contacts/:id/data-export` menghasilkan arsip ZIP via job.

### 8.3 Larangan PSTN

Terms Meta melarang PSTN pada leg mana pun dari alur panggilan WhatsApp. Konsekuensi teknis yang WAJIB dipatuhi:
- Tidak ada integrasi SIP trunk, gateway PSTN, atau forwarding ke nomor telepon konvensional.
- Fitur "transfer ke nomor luar" **tidak boleh** diimplementasikan.
- Dokumentasikan larangan ini di README repo agar tidak ditambahkan tanpa sengaja di kemudian hari.

### 8.4 Kualitas & reputasi nomor

Aplikasi WAJIB menjaga agar nomor tidak kena penegakan Meta:
- Alert saat answer rate harian < 70% atau > 5 panggilan tak terjawab berturut-turut pada satu nomor.
- Blokir otomatis panggilan keluar ke kontak dengan `consecutive_unanswered ≥ 3` sampai ditinjau supervisor.
- Dashboard menampilkan status pembatasan Meta beserta waktu kedaluwarsa.
- Batas CPR ditegakkan lebih konservatif daripada batas Meta.

---

## 9. Keamanan operasional

| Aspek | Aturan |
|---|---|
| Lingkungan | Rahasia produksi hanya lewat secret manager/env terenkripsi, tidak di repo |
| Akses DB | User aplikasi tanpa hak DDL di produksi; migration dijalankan user terpisah |
| Backup | Backup harian MySQL + object storage, uji restore triwulanan |
| Least privilege | Kredensial S3 hanya untuk bucket aplikasi, tanpa `s3:DeleteBucket` |
| Monitoring keamanan | Alert untuk lonjakan 401/403, signature webhook gagal, dan percobaan lintas tenant |
| Incident response | Runbook di `10-DEVOPS-DOCKER.md` §9, termasuk prosedur rotasi token Meta darurat |

---

## 10. Checklist keamanan sebelum rilis

- [ ] Seluruh rahasia terenkripsi di DB dan tidak muncul di log mana pun
- [ ] Verifikasi HMAC webhook lulus test positif & negatif
- [ ] Test lintas tenant negatif hijau untuk setiap repository
- [ ] Rate limit aktif pada seluruh grup endpoint
- [ ] CSP & header keamanan terpasang
- [ ] Tidak ada `MediaRecorder` di kode frontend
- [ ] Tidak ada referensi SIP/PSTN di kode
- [ ] `pnpm audit` tanpa temuan high/critical
- [ ] `gitleaks` bersih
- [ ] Audit log mencakup: login, perubahan konfigurasi, akses rekaman, impersonation, ekspor data
