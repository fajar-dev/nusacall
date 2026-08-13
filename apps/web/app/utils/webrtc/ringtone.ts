/**
 * Pure WebAudio Ringtone & Ringback Tone Generator (No external MP3/audio files)
 * Spec: RULES.md §13 & 06-REALTIME-WEBRTC-SPEC.md
 */

export class WebAudioRingtone {
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  private getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Play standard telephone ringtone (440Hz + 480Hz dual tone, 2s on / 4s off cycle)
   */
  public startIncomingRingtone(): void {
    if (this.isPlaying || typeof window === 'undefined') return;
    this.isPlaying = true;

    const playBurst = () => {
      if (!this.isPlaying) return;
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.value = 440;
        osc2.frequency.value = 480;

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.8);
        osc2.stop(now + 1.8);
      } catch {
        // Fallback for restricted WebAudio autoplay policy
      }
    };

    playBurst();
    this.timer = setInterval(playBurst, 4000);
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.suspend();
      } catch {
        // Ignore suspend failure
      }
    }
  }

  public isActive(): boolean {
    return this.isPlaying;
  }
}
