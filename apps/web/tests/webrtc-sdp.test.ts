import { describe, it, expect } from 'vitest';
import { mungeSdp, keepOnlyCodecs, enforceAttribute, setOpusFmtp } from '../app/utils/webrtc/sdp';

const SAMPLE_SDP = [
  'v=0',
  'o=- 1425364758 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=msid-semantic: WMS',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 0 8 106 105 13 110 126',
  'c=IN IP4 0.0.0.0',
  'a=rtcp:9 IN IP4 0.0.0.0',
  'a=ice-ufrag:abcd1234efgh',
  'a=ice-pwd:secretpwd12345678901234567890',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF',
  'a=setup:actpass',
  'a=mid:0',
  'a=sendrecv',
  'a=rtcp-mux',
  'a=rtpmap:111 opus/48000/2',
  'a=fmtp:111 minptime=10;useinbandfec=1',
  'a=rtpmap:103 ISAC/16000',
  'a=rtpmap:104 ISAC/32000',
  'a=rtpmap:0 PCMU/8000',
  'a=rtpmap:8 PCMA/8000',
  'a=rtpmap:126 telephone-event/8000',
  'a=candidate:1 1 UDP 2122260223 192.168.1.100 54321 typ host',
  'a=candidate:2 1 UDP 1694498815 203.0.113.1 54321 typ srflx raddr 192.168.1.100 rport 54321',
].join('\r\n');

describe('E7-T1: WebRTC SDP Utility (mungeSdp & helpers)', () => {
  it('should keep only Opus and telephone-event in m=audio line and rtpmap lines', () => {
    const kept = keepOnlyCodecs(SAMPLE_SDP, ['opus/48000', 'telephone-event/8000']);
    expect(kept).toContain('m=audio 9 UDP/TLS/RTP/SAVPF 111 126');
    expect(kept).toContain('a=rtpmap:111 opus/48000/2');
    expect(kept).toContain('a=rtpmap:126 telephone-event/8000');
    expect(kept).not.toContain('a=rtpmap:0 PCMU/8000');
    expect(kept).not.toContain('a=rtpmap:103 ISAC/16000');
  });

  it('should enforce ptime:20 and maxptime:20', () => {
    const enforced = enforceAttribute(SAMPLE_SDP, 'audio', 'ptime', '20');
    expect(enforced).toContain('a=ptime:20');
  });

  it('should set Opus fmtp parameters correctly', () => {
    const fmtpSet = setOpusFmtp(SAMPLE_SDP, { useinbandfec: 1, usedtx: 0, stereo: 0, maxaveragebitrate: 32000 });
    expect(fmtpSet).toContain('a=fmtp:111 useinbandfec=1;usedtx=0;stereo=0;maxaveragebitrate=32000');
  });

  it('DoD §5.7: mungeSdp should leave a=setup, a=fingerprint, a=ice-ufrag, a=candidate lines UNCHANGED', () => {
    const munged = mungeSdp(SAMPLE_SDP);

    expect(munged).toContain('a=setup:actpass');
    expect(munged).toContain('a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF');
    expect(munged).toContain('a=ice-ufrag:abcd1234efgh');
    expect(munged).toContain('a=candidate:1 1 UDP 2122260223 192.168.1.100 54321 typ host');
    expect(munged).toContain('a=candidate:2 1 UDP 1694498815 203.0.113.1 54321 typ srflx raddr 192.168.1.100 rport 54321');
    expect(munged).toContain('a=ptime:20');
    expect(munged).toContain('a=maxptime:20');
  });

  it('DoD §5.7: mungeSdp should be IDEMPOTENT (mungeSdp(mungeSdp(x)) === mungeSdp(x))', () => {
    const mungedOnce = mungeSdp(SAMPLE_SDP);
    const mungedTwice = mungeSdp(mungedOnce);
    expect(mungedTwice).toBe(mungedOnce);
  });
});
