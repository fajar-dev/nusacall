/**
 * WebRTC Protocol & Media Compliance Verification
 * Spec: 06-REALTIME-WEBRTC-SPEC.md §4.4 & 03-WHATSAPP-CALLING-SPEC.md §8
 */

export interface WebRtcComplianceReport {
  iceRole: string; // Expected: 'controlling'
  dtlsRole: string; // Expected: 'active'
  codec: string; // Expected: 'opus'
  isCompliant: boolean;
  warnings: string[];
}

export function parseComplianceFromSdpAndPc(localSdp: string, iceRole?: string, codec?: string): WebRtcComplianceReport {
  const warnings: string[] = [];

  // Determine DTLS role from local SDP: a=setup:actpass or a=setup:active -> active
  let dtlsRole = 'active';
  if (localSdp.includes('a=setup:passive')) {
    dtlsRole = 'passive';
    warnings.push('DTLS role is passive instead of active');
  }

  const effectiveIceRole = iceRole || 'controlling';
  if (effectiveIceRole !== 'controlling') {
    warnings.push(`ICE role is ${effectiveIceRole} instead of controlling`);
  }

  const effectiveCodec = codec || 'opus';
  if (effectiveCodec.toLowerCase() !== 'opus') {
    warnings.push(`Negotiated codec is ${effectiveCodec} instead of opus`);
  }

  return {
    iceRole: effectiveIceRole,
    dtlsRole,
    codec: effectiveCodec,
    isCompliant: warnings.length === 0,
    warnings,
  };
}
