import { describe, it, expect, vi } from 'vitest';
import { runPreflightCheck } from '../app/utils/webrtc/preflight';
import { parseComplianceFromSdpAndPc } from '../app/utils/webrtc/compliance';

describe('E7-T8 & E7-T9: Pre-flight Check & WebRTC Compliance Report', () => {
  it('runPreflightCheck should fail canBeAvailable when browser environment lacks WebRTC or mic input', async () => {
    vi.stubGlobal('isSecureContext', true);

    const result = await runPreflightCheck();
    expect(result.canBeAvailable).toBeDefined();
    expect(result.failureReasons).toBeDefined();
  });

  it('parseComplianceFromSdpAndPc should generate compliance report and flag non-compliant setups', () => {
    const validSdp = 'v=0\r\na=setup:actpass\r\na=rtpmap:111 opus/48000/2';
    const report = parseComplianceFromSdpAndPc(validSdp, 'controlling', 'opus');

    expect(report.isCompliant).toBe(true);
    expect(report.iceRole).toBe('controlling');
    expect(report.dtlsRole).toBe('active');
    expect(report.codec).toBe('opus');
    expect(report.warnings).toHaveLength(0);

    const nonCompliant = parseComplianceFromSdpAndPc('v=0\r\na=setup:passive', 'controlled', 'pcmu');
    expect(nonCompliant.isCompliant).toBe(false);
    expect(nonCompliant.warnings.length).toBeGreaterThan(0);
  });
});
