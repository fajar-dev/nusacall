/**
 * E-Model MOS (Mean Opinion Score) calculation utility for WebRTC audio quality
 * Spec: 06-REALTIME-WEBRTC-SPEC.md §4.7
 */

export interface MosCalculationParams {
  rttMs: number;
  jitterMs: number;
  packetLossPct: number;
}

export function calculateMos(params: MosCalculationParams): number {
  const { rttMs, jitterMs, packetLossPct } = params;

  // Effective latency: rtt + 2 * jitter + buffer (say 10ms)
  const effectiveLatency = rttMs + jitterMs * 2 + 10;

  // Id (delay impairment)
  let id = 0;
  if (effectiveLatency > 160) {
    id = (effectiveLatency - 160) / 40;
  } else {
    id = effectiveLatency / 40;
  }

  // Ie (equipment impairment due to packet loss)
  const ie = packetLossPct * 2.5;

  // Calculate R-factor
  let r = 93.2 - id - ie;

  if (r < 0) r = 0;
  if (r > 100) r = 100;

  // Calculate MOS from R-factor
  if (r < 0) return 1.0;

  const mos = 1 + 0.035 * r + r * (r - 60) * (100 - r) * 0.000007;

  // Clamp MOS between 1.0 and 4.5
  return Math.max(1.0, Math.min(4.5, Math.round(mos * 100) / 100));
}
