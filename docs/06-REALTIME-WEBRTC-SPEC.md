# 06 — Spesifikasi Realtime & WebRTC

Dokumen ini mengatur jalur kritis produk: signaling antara backend ↔ browser agent, dan implementasi WebRTC di browser sebagai endpoint media terhadap Meta RTC.

---

## 1. Transport WebSocket

- Endpoint: `wss://<host>/ws?token=<shortLivedWsToken>`
- Token WS: JWT khusus TTL 60 detik, diperoleh dari `POST /api/v1/auth/ws-token`. Tidak memakai access token biasa agar tidak bocor di query string log.
- Subprotocol: tidak dipakai. Format pesan: JSON UTF-8.
- Heartbeat: server mengirim `ping` tiap 20 detik; klien membalas `pong`. Tanpa pong 2× berturut-turut → koneksi ditutup.
- Reconnect klien: exponential backoff 1s, 2s, 4s, 8s, maks 30s, dengan jitter. Setelah tersambung ulang → kirim `client.resync`.

### 1.1 Amplop pesan

```ts
interface WsEnvelope<T = unknown> {
  id: string;          // ULID, unik per pesan
  type: string;        // lihat katalog §2
  ts: number;          // epoch ms pengirim
  replyTo?: string;    // id pesan yang dibalas
  payload: T;
}
```

Definisi tipe seluruh pesan ada di `packages/ws-protocol` dan dipakai bersama backend & frontend. **Dilarang** mengirim pesan yang tidak terdaftar di sana.

### 1.2 Aturan keandalan

- Pesan server → klien bersifat **at-least-once**; klien harus idempoten (gunakan `id` untuk deduplikasi, simpan 200 id terakhir).
- Pesan yang membutuhkan konfirmasi (`call.offer`, `call.request_offer`) memiliki timeout server 5 detik; bila tak ada balasan, dianggap gagal dan panggilan dialihkan ke agent lain.
- Server tidak menyimpan antrean pesan untuk klien yang terputus, kecuali `call.offer` yang masih hidup (dikirim ulang sekali saat resync).

---

## 2. Katalog pesan

### 2.1 Klien → Server

| Type | Payload | Keterangan |
|---|---|---|
| `client.hello` | `{ appVersion, userAgent, capabilities }` | Pesan pertama setelah connect |
| `client.resync` | `{ lastEventId? }` | Minta snapshot state penuh |
| `agent.set_status` | `{ status, reason? }` | Ubah status agent |
| `call.answer_sdp` | `{ callId, sdp }` | SDP **answer** untuk panggilan masuk |
| `call.offer_sdp` | `{ callId, sdp }` | SDP **offer** untuk panggilan keluar |
| `call.answer` | `{ callId }` | Agent menekan tombol Jawab |
| `call.reject` | `{ callId, reason? }` | Agent menolak |
| `call.hangup` | `{ callId }` | Agent mengakhiri |
| `call.ice_state` | `{ callId, iceConnectionState, iceRole, dtlsRole }` | Telemetri |
| `call.stats` | `{ callId, rttMs, jitterMs, packetLossPct, audioLevelIn, audioLevelOut, mos }` | Setiap 5 detik |
| `call.media_error` | `{ callId, code, message }` | Kegagalan lokal (mic ditolak, gagal setRemoteDescription, dsb.) |
| `ping`/`pong` | `{}` | |

### 2.2 Server → Klien

| Type | Payload | Keterangan |
|---|---|---|
| `session.ready` | `{ user, agentState, activeCall?, serverTime }` | Balasan `client.hello`/`client.resync` |
| `agent.state_changed` | `{ status, reason?, since }` | Termasuk perubahan yang dipaksa supervisor |
| `call.offer` | `{ callId, wacid, direction, sdp, sdpType:'offer', contact, queue, ringTimeoutSeconds, deadlineAt, payloadContext }` | Tawaran panggilan masuk |
| `call.request_offer` | `{ callId, waPhoneNumberId, to, contact }` | Backend meminta browser membuat SDP offer (panggilan keluar) |
| `call.remote_answer` | `{ callId, sdp }` | SDP answer dari Meta untuk panggilan keluar |
| `call.pre_accepted` | `{ callId }` | `pre_accept` berhasil |
| `call.accepted` | `{ callId, recording:boolean, transcription:boolean }` | `accept` berhasil → **browser baru boleh mengalirkan audio** |
| `call.ringing` | `{ callId }` | Status RINGING dari Meta (outbound) |
| `call.rejected` | `{ callId, by:'USER'\|'AGENT'\|'SYSTEM' }` | |
| `call.ended` | `{ callId, endReason, durationSeconds, wrapUpSeconds, requireDisposition }` | |
| `call.retracted` | `{ callId, reason }` | Tawaran ditarik (timeout / diambil alih) |
| `call.error` | `{ callId, code, message }` | |
| `queue.stats` | `{ queues: [{ queueId, waiting, longestWaitSeconds, availableAgents }] }` | Untuk supervisor & agent, tiap 2 detik bila berubah |
| `agents.snapshot` | `{ agents: [...] }` | Untuk supervisor |
| `notification.new` | `{ id, severity, title, body, data }` | |
| `system.shutdown` | `{ inSeconds }` | Instruksi reconnect |

### 2.3 Otorisasi kanal

- Agent hanya menerima pesan panggilan miliknya.
- `queue.stats` & `agents.snapshot` hanya untuk `SUPERVISOR`, `ORG_ADMIN`, `PLATFORM_OWNER`.
- Server memvalidasi kepemilikan `callId` pada setiap pesan klien; pelanggaran → tutup koneksi + audit log.

---

## 3. Alur signaling lengkap

### 3.1 Panggilan masuk (UIC)

```
Server                                   Browser
  │  call.offer { callId, sdp(offer) }      │
  ├────────────────────────────────────────►│  1. pc = new RTCPeerConnection(config)
  │                                          │  2. getUserMedia(audio) → track (enabled = false)
  │                                          │  3. pc.addTrack(micTrack)
  │                                          │  4. pc.setRemoteDescription(offer)
  │                                          │  5. answer = pc.createAnswer()
  │                                          │  6. answer = mungeSdp(answer)
  │                                          │  7. pc.setLocalDescription(answer)
  │                                          │  8. tunggu ICE gathering complete (≤ 3 detik)
  │◄─── call.answer_sdp { callId, sdp } ─────┤
  │  POST /calls pre_accept                  │
  │  simpan sdp:answer:{wacid} di Redis      │
  ├──── call.pre_accepted ──────────────────►│  UI: berdering
  │◄─── call.answer { callId } ──────────────┤  agent menekan Jawab
  │  POST /calls accept (sdp dari Redis)     │
  ├──── call.accepted ──────────────────────►│  micTrack.enabled = true  ← BARU DI SINI
  │                                          │  mulai StatsCollector
```

**Aturan mutlak:**
- Browser TIDAK boleh mengaktifkan track mikrofon sebelum menerima `call.accepted`.
- Browser TIDAK boleh membuat ulang answer setelah dikirim. Bila `setLocalDescription` gagal → kirim `call.media_error`, backend melakukan `reject`.
- `sdp` yang dikirim ke server adalah SDP **setelah** ICE gathering selesai (vanilla ICE / non-trickle), karena Meta tidak menyediakan kanal trickle ICE.

### 3.2 Panggilan keluar (BIC)

```
Server                                   Browser
  │  call.request_offer { callId, to }       │
  ├────────────────────────────────────────►│  1. pc baru, getUserMedia, addTrack (enabled = false)
  │                                          │  2. offer = pc.createOffer()
  │                                          │  3. munge → setLocalDescription → tunggu ICE complete
  │◄─── call.offer_sdp { callId, sdp } ──────┤
  │  POST /calls connect (to, sdp offer)     │
  │  simpan wacid                            │
  │  (webhook connect: sdp answer)           │
  ├──── call.remote_answer { sdp } ─────────►│  pc.setRemoteDescription(answer)
  ├──── call.ringing ───────────────────────►│  UI: berdering
  │  (webhook status ACCEPTED)               │
  ├──── call.accepted ──────────────────────►│  micTrack.enabled = true
```

### 3.3 Pengakhiran

- Agent menekan tutup → `call.hangup` → backend `POST terminate` → `call.ended`.
- User menutup → webhook terminate → `call.ended`.
- Browser menutup `RTCPeerConnection` dan menghentikan track **hanya** setelah `call.ended` atau setelah 5 detik `iceConnectionState === 'failed'/'disconnected'` tanpa pemulihan.

---

## 4. Implementasi WebRTC di browser

### 4.1 Konfigurasi `RTCPeerConnection`

```ts
const config: RTCConfiguration = {
  iceServers: [],                    // lihat catatan di bawah
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: 0,
};
```

**Catatan STUN/TURN:** Meta bertindak sebagai ICE-lite dan mengiklankan kandidat server-reflexive miliknya. Untuk agent di belakang NAT simetris, kandidat host saja bisa tidak cukup. Konfigurasi STUN/TURN diambil dari backend (`GET /api/v1/rtc/ice-servers`) agar bisa diubah tanpa deploy ulang frontend. Default pengembangan: kosong (host candidates). **Lihat `OQ-007` — wajib diuji pada jaringan produksi sebelum rilis.**

### 4.2 Constraint media

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    deviceId: selectedInputDeviceId ? { exact: selectedInputDeviceId } : undefined,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
  },
  video: false,
});
```

### 4.3 SDP munging (hanya yang diizinkan)

```ts
export function mungeSdp(sdp: string): string {
  let out = sdp;
  // 1) Sisakan hanya Opus dan telephone-event pada m=audio
  out = keepOnlyCodecs(out, ['opus/48000', 'telephone-event/8000']);
  // 2) Paksa ptime 20 ms
  out = enforceAttribute(out, 'audio', 'ptime', '20');
  out = enforceAttribute(out, 'audio', 'maxptime', '20');
  // 3) Pastikan fmtp opus: useinbandfec=1; usedtx=0; stereo=0
  out = setOpusFmtp(out, { useinbandfec: 1, usedtx: 0, stereo: 0, maxaveragebitrate: 32000 });
  return out;
}
```

**Dilarang:** mengubah baris `a=setup`, `a=ice-*`, `a=fingerprint`, `a=candidate`, `a=mid`, `c=`, `o=`. Perubahan di luar tiga langkah di atas memerlukan ADR.

### 4.4 Verifikasi kepatuhan (wajib dijalankan setiap panggilan)

Setelah koneksi terbentuk, `PeerConnectionManager` WAJIB memverifikasi dan mengirim `call.ice_state`:

```ts
const transport = pc.getSenders()[0]?.transport;          // RTCDtlsTransport
const iceTransport = transport?.iceTransport;
const iceRole = iceTransport?.role;                        // harapkan 'controlling'
const dtlsRole = getDtlsRoleFromLocalSdp(pc.localDescription!.sdp); // harapkan 'active' (= client)
const codec = await getNegotiatedCodec(pc);                // harapkan 'opus'
```

Bila `iceRole !== 'controlling'` atau codec bukan Opus → tetap lanjutkan panggilan, tetapi kirim `call.media_error` dengan severity `WARN` agar tercatat. Ini adalah sinyal awal masalah kompatibilitas (lihat §8 `03-WHATSAPP-CALLING-SPEC.md`).

### 4.5 Larangan

- **Jangan** memanggil `pc.restartIce()` selama panggilan aktif (Meta melarang pergantian kandidat di tengah panggilan).
- **Jangan** melakukan renegotiation (`createOffer` kedua) pada panggilan yang sedang berjalan.
- **Jangan** menambah/menghapus track saat panggilan aktif; gunakan `track.enabled` untuk mute dan `replaceTrack` hanya untuk ganti perangkat input.

### 4.6 Ganti perangkat saat panggilan berlangsung

```ts
const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id } } });
const newTrack = newStream.getAudioTracks()[0];
newTrack.enabled = currentSender.track!.enabled;
await currentSender.replaceTrack(newTrack);              // tidak memicu renegotiation
oldTrack.stop();
```

### 4.7 Pengumpulan statistik

Setiap 5 detik:

```ts
const stats = await pc.getStats();
// inbound-rtp: jitter, packetsLost, packetsReceived
// remote-inbound-rtp: roundTripTime
// media-source / track: audioLevel
```
MOS estimasi memakai model E-model sederhana:
```
R = 93.2 - Id(latency) - Ie(loss)
MOS = 1 + 0.035R + R(R-60)(100-R) * 7e-6
```
Implementasi ditempatkan di `lib/webrtc/mos.ts` dengan unit test terhadap nilai referensi.

### 4.8 Penanganan kegagalan

| Kondisi | Aksi browser | Aksi backend |
|---|---|---|
| `getUserMedia` ditolak | Kirim `call.media_error` `MIC_PERMISSION_DENIED`, tampilkan panduan, paksa status agent `BUSY` | `reject` panggilan, tawarkan ke agent lain |
| Tidak ada perangkat input | idem `NO_INPUT_DEVICE` | idem |
| `setRemoteDescription` gagal | `call.media_error` `SDP_APPLY_FAILED` | `reject` |
| `iceConnectionState = failed` saat aktif | Tampilkan peringatan, tunggu 5 detik | Bila tidak pulih: `terminate` + tandai `end_reason = FAILED` |
| Tab ditutup | — | Deteksi socket close saat `ACTIVE` → `terminate` + `WRAP_UP` otomatis |
| Backend tidak terjangkau saat panggilan aktif | **Panggilan tetap berjalan** (media P2P), UI masuk mode degradasi: hanya tombol tutup lokal | Setelah reconnect, `client.resync` memulihkan state |

### 4.9 Pre-flight check (sebelum agent bisa `AVAILABLE`)

Dijalankan di halaman agent saat pertama kali status diubah ke `AVAILABLE`:

1. Browser didukung (Chromium ≥ 120 / Firefox ≥ 121) dan konteks aman (HTTPS).
2. Izin mikrofon diberikan, minimal satu perangkat input terdeteksi.
3. `RTCRtpSender.getCapabilities('audio')` memuat Opus 48000.
4. Tes koneksi WebSocket & RTT ke backend < 500 ms.
5. Uji loopback singkat (opsional): rekam 2 detik & tampilkan level meter.

Gagal pada butir 1–3 → agent tidak boleh berstatus `AVAILABLE`.

---

## 5. Struktur kode frontend WebRTC

```
lib/webrtc/
├─ PeerConnectionManager.ts   # satu instance per panggilan; siklus hidup ketat
├─ DeviceManager.ts           # enumerasi & pemilihan perangkat, persist di localStorage
├─ StatsCollector.ts          # polling getStats + MOS + throttling
├─ sdp.ts                     # mungeSdp + parser util (murni, mudah diuji)
├─ mos.ts
├─ ringtone.ts                # WebAudio, tanpa file eksternal
└─ types.ts
```

`PeerConnectionManager` API:

```ts
class PeerConnectionManager {
  static async createForInbound(offerSdp: string, opts: Opts): Promise<{ pcm: PeerConnectionManager; answerSdp: string }>;
  static async createForOutbound(opts: Opts): Promise<{ pcm: PeerConnectionManager; offerSdp: string }>;
  applyRemoteAnswer(sdp: string): Promise<void>;
  enableMic(): void;      // dipanggil hanya setelah call.accepted
  setMuted(muted: boolean): void;
  replaceInputDevice(deviceId: string): Promise<void>;
  getComplianceReport(): ComplianceReport;
  close(): void;          // idempoten
}
```

Aturan: kelas ini **tidak** mengetahui WebSocket maupun store. Ia hanya menerima SDP dan mengembalikan SDP + event. Semua orkestrasi ada di `stores/softphone.ts`. Ini membuatnya dapat diuji dengan `RTCPeerConnection` palsu.

---

## 6. Mesin state softphone (frontend)

```
IDLE
 ├─(call.offer)──────────────► PREPARING ─(answer sdp terkirim)─► RINGING_IN
 ├─(user tekan Telepon)──────► PREPARING_OUT ─(offer terkirim)──► DIALING ─(call.ringing)─► RINGING_OUT
RINGING_IN ─(user Jawab)────► CONNECTING ─(call.accepted)─────► ON_CALL
RINGING_IN ─(user Tolak/timeout)─► IDLE
RINGING_OUT ─(call.accepted)─► ON_CALL
ON_CALL ─(call.ended / hangup)─► WRAP_UP ─(disposisi/timeout)─► IDLE
Setiap state ─(call.error)───► ERROR ─(acknowledge)──────────► IDLE
```

State disimpan di Pinia store `softphone` dan **tidak boleh** diduplikasi di komponen. Komponen hanya membaca.

---

## 7. Gateway WebSocket di backend

```
interface/ws/
├─ gateway.ts        # upgrade, autentikasi token, registrasi socket
├─ registry.ts       # peta userId ↔ socket (lokal) + Redis untuk lintas instance
├─ dispatcher.ts     # routing type → handler, validasi Zod
├─ publisher.ts      # sendToUser / sendToRole / broadcastOrg (via Redis pub/sub)
└─ handlers/
   ├─ agentStatus.handler.ts
   ├─ callSignaling.handler.ts
   └─ telemetry.handler.ts
```

Aturan:
- Setiap handler memvalidasi payload dengan skema Zod dari `packages/ws-protocol`.
- Handler tidak berisi logika bisnis — memanggil use case yang sama dengan REST.
- Setiap pesan masuk dicatat dengan `correlationId` = `envelope.id`.
- Backpressure: bila buffer socket > 1 MB, tutup koneksi (klien akan reconnect).
- Saat instance dimatikan: kirim `system.shutdown`, tunggu 3 detik, tutup semua socket, bersihkan registry Redis.
