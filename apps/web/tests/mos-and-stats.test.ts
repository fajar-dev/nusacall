import { describe, it, expect } from 'vitest';
import { calculateMos } from '../app/utils/webrtc/mos';
import { StatsCollector } from '../app/utils/webrtc/StatsCollector';

describe('E7-T4: MOS Calculation & StatsCollector', () => {
  it('DoD: calculateMos should yield expected MOS values for reference network conditions', () => {
    // Perfect conditions: low RTT (20ms), 0 jitter, 0% loss -> expect high MOS (~4.3 - 4.4)
    const perfectMos = calculateMos({ rttMs: 20, jitterMs: 0, packetLossPct: 0 });
    expect(perfectMos).toBeGreaterThanOrEqual(4.0);
    expect(perfectMos).toBeLessThanOrEqual(4.5);

    // Good conditions: RTT 50ms, jitter 5ms, 1% loss -> MOS ~4.1 - 4.3
    const goodMos = calculateMos({ rttMs: 50, jitterMs: 5, packetLossPct: 1 });
    expect(goodMos).toBeGreaterThan(3.8);

    // Degraded conditions: RTT 250ms, jitter 30ms, 5% loss -> MOS ~3.0 - 3.6
    const degradedMos = calculateMos({ rttMs: 250, jitterMs: 30, packetLossPct: 5 });
    expect(degradedMos).toBeLessThan(perfectMos);

    // Terrible conditions: RTT 500ms, jitter 100ms, 20% loss -> low MOS (~1.0 - 2.0)
    const terribleMos = calculateMos({ rttMs: 500, jitterMs: 100, packetLossPct: 20 });
    expect(terribleMos).toBeLessThanOrEqual(2.5);
    expect(terribleMos).toBeGreaterThanOrEqual(1.0);
  });

  it('StatsCollector should parse RTCStatsReport correctly', () => {
    const mockReport = new Map<string, any>([
      [
        'stat1',
        {
          type: 'remote-inbound-rtp',
          roundTripTime: 0.045, // 45ms
        },
      ],
      [
        'stat2',
        {
          type: 'inbound-rtp',
          kind: 'audio',
          jitter: 0.008, // 8ms
          packetsLost: 2,
          packetsReceived: 98,
          audioLevel: 0.75,
        },
      ],
      [
        'stat3',
        {
          type: 'media-source',
          kind: 'audio',
          audioLevel: 0.6,
        },
      ],
    ]) as unknown as RTCStatsReport;

    const collector = new StatsCollector(
      async () => mockReport,
      () => {}
    );

    const stats = collector.parseReport(mockReport);
    expect(stats.rttMs).toBe(45);
    expect(stats.jitterMs).toBe(8);
    expect(stats.packetLossPct).toBe(2);
    expect(stats.audioLevelIn).toBe(75);
    expect(stats.audioLevelOut).toBe(60);
    expect(stats.mos).toBeGreaterThan(3.5);
  });
});
