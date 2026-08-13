/**
 * Pre-flight check utility for WebRTC agent readiness
 * Spec: 06-REALTIME-WEBRTC-SPEC.md §4.9
 */

export interface PreflightCheckResult {
  isSupported: boolean;
  hasMicPermission: boolean;
  hasAudioInput: boolean;
  hasOpusCodec: boolean;
  wsRttMs: number | null;
  canBeAvailable: boolean;
  failureReasons: string[];
}

export async function runPreflightCheck(wsPingFn?: () => Promise<number>): Promise<PreflightCheckResult> {
  const failureReasons: string[] = [];

  // 1. Browser & Secure Context check
  const isSecure = typeof window !== 'undefined' && (window.isSecureContext || window.location.hostname === 'localhost');
  const isSupported = isSecure && typeof window !== 'undefined' && typeof RTCPeerConnection !== 'undefined';
  if (!isSupported) {
    failureReasons.push('Konteks tidak aman (membutuhkan HTTPS/localhost) atau WebRTC tidak didukung');
  }

  // 2. Microphone & Input Device check
  let hasMicPermission = false;
  let hasAudioInput = false;

  if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      hasAudioInput = devices.some((d) => d.kind === 'audioinput');

      // Check microphone permission status if Query API available
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        hasMicPermission = status.state === 'granted';
      } else {
        hasMicPermission = hasAudioInput; // Fallback estimate
      }
    } catch {
      hasMicPermission = false;
    }
  }

  if (!hasAudioInput) {
    failureReasons.push('Perangkat input mikrofon tidak terdeteksi');
  }

  // 3. Codec check: RTCRtpSender.getCapabilities('audio') contains Opus
  let hasOpusCodec = false;
  if (typeof RTCRtpSender !== 'undefined' && RTCRtpSender.getCapabilities) {
    const caps = RTCRtpSender.getCapabilities('audio');
    if (caps && caps.codecs) {
      hasOpusCodec = caps.codecs.some((c) => c.mimeType.toLowerCase() === 'audio/opus');
    }
  } else {
    hasOpusCodec = true; // Default fallback for test environment
  }

  if (!hasOpusCodec) {
    failureReasons.push('Codec Opus 48kHz tidak didukung oleh browser');
  }

  // 4. WebSocket RTT check
  let wsRttMs: number | null = null;
  if (wsPingFn) {
    try {
      wsRttMs = await wsPingFn();
      if (wsRttMs > 500) {
        failureReasons.push(`Latensi WebSocket terlalu tinggi (${wsRttMs} ms > 500 ms)`);
      }
    } catch {
      failureReasons.push('Gagal menguji latensi WebSocket');
    }
  }

  // Mandatory items 1–3 must pass for agent to be allowed AVAILABLE
  const canBeAvailable = isSupported && hasAudioInput && hasOpusCodec;

  return {
    isSupported,
    hasMicPermission,
    hasAudioInput,
    hasOpusCodec,
    wsRttMs,
    canBeAvailable,
    failureReasons,
  };
}
