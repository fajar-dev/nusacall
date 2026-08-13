import { calculateMos } from './mos';

export interface CallAudioStats {
  rttMs: number;
  jitterMs: number;
  packetLossPct: number;
  audioLevelIn: number;
  audioLevelOut: number;
  mos: number;
}

export class StatsCollector {
  private timer: ReturnType<typeof setInterval> | null = null;
  private prevPacketsLost = 0;
  private prevPacketsReceived = 0;

  constructor(
    private readonly getStatsFn: () => Promise<RTCStatsReport | null>,
    private readonly onStatsCollected: (stats: CallAudioStats) => void
  ) {}

  public start(intervalMs = 5000): void {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      try {
        const report = await this.getStatsFn();
        if (!report) return;

        const parsed = this.parseReport(report);
        this.onStatsCollected(parsed);
      } catch {
        // Ignore stats collection error on teardown
      }
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public parseReport(report: RTCStatsReport): CallAudioStats {
    let rttMs = 0;
    let jitterMs = 0;
    let packetLossPct = 0;
    let audioLevelIn = 0;
    let audioLevelOut = 0;

    report.forEach((stat) => {
      if (stat.type === 'remote-inbound-rtp' && typeof stat.roundTripTime === 'number') {
        rttMs = Math.round(stat.roundTripTime * 1000);
      }

      if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
        if (typeof stat.jitter === 'number') {
          jitterMs = Math.round(stat.jitter * 1000);
        }

        const packetsLost = stat.packetsLost || 0;
        const packetsReceived = stat.packetsReceived || 0;

        const deltaLost = packetsLost - this.prevPacketsLost;
        const deltaReceived = packetsReceived - this.prevPacketsReceived;
        const totalDelta = deltaLost + deltaReceived;

        if (totalDelta > 0 && deltaLost >= 0) {
          packetLossPct = Math.round((deltaLost / totalDelta) * 100);
        }

        this.prevPacketsLost = packetsLost;
        this.prevPacketsReceived = packetsReceived;

        if (typeof stat.audioLevel === 'number') {
          audioLevelIn = Math.round(stat.audioLevel * 100);
        }
      }

      if (stat.type === 'media-source' && stat.kind === 'audio' && typeof stat.audioLevel === 'number') {
        audioLevelOut = Math.round(stat.audioLevel * 100);
      }
    });

    const mos = calculateMos({ rttMs, jitterMs, packetLossPct });

    return {
      rttMs,
      jitterMs,
      packetLossPct,
      audioLevelIn,
      audioLevelOut,
      mos,
    };
  }
}
