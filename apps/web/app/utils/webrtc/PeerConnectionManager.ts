/**
 * PeerConnectionManager for WebRTC signaling & media handling
 * Spec: 06-REALTIME-WEBRTC-SPEC.md §4 & 09-TESTING-STRATEGY.md §5.8
 */

export interface PeerConnectionManagerConfig {
  iceServers?: RTCIceServer[];
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onIceStateChange?: (state: RTCIceConnectionState) => void;
  onTrack?: (track: MediaStreamTrack, stream: MediaStream) => void;
  onError?: (error: Error) => void;
}

export class PeerConnectionManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private micTrack: MediaStreamTrack | null = null;
  private audioSender: RTCRtpSender | null = null;
  private isClosed = false;

  constructor(private readonly config: PeerConnectionManagerConfig = {}) {}

  public async initialize(): Promise<void> {
    if (this.pc) return;

    const rtcConfig: RTCConfiguration = {
      iceServers: this.config.iceServers || [],
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 0,
    };

    this.pc = new RTCPeerConnection(rtcConfig);

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.config.onIceCandidate) {
        this.config.onIceCandidate(event.candidate);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc && this.config.onIceStateChange) {
        this.config.onIceStateChange(this.pc.iceConnectionState);
      }
    };

    this.pc.ontrack = (event) => {
      if (event.track && event.streams[0] && this.config.onTrack) {
        this.config.onTrack(event.track, event.streams[0]);
      }
    };
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) await this.initialize();
    const offer = await this.pc!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await this.pc!.setLocalDescription(offer);
    return offer;
  }

  public async setRemoteOffer(sdp: string): Promise<void> {
    if (!this.pc) await this.initialize();
    await this.pc!.setRemoteDescription({ type: 'offer', sdp });
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('RTCPeerConnection belum diinisialisasi');
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  public async setRemoteAnswer(sdp: string): Promise<void> {
    if (!this.pc) throw new Error('RTCPeerConnection belum diinisialisasi');
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  /**
   * Rule N6: Microphone track MUST NOT be enabled before call.accepted
   */
  public async prepareMicrophone(stream: MediaStream): Promise<void> {
    this.localStream = stream;
    const tracks = stream.getAudioTracks();
    if (tracks.length > 0) {
      this.micTrack = tracks[0]!;
      // RULE N6: Ensure disabled by default until enableMic() is called upon call.accepted
      this.micTrack.enabled = false;

      if (this.pc) {
        this.audioSender = this.pc.addTrack(this.micTrack, this.localStream);
      }
    }
  }

  public enableMic(): void {
    if (this.micTrack) {
      this.micTrack.enabled = true;
    }
  }

  public disableMic(): void {
    if (this.micTrack) {
      this.micTrack.enabled = false;
    }
  }

  public isMicEnabled(): boolean {
    return this.micTrack ? this.micTrack.enabled : false;
  }

  public async replaceInputTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (this.audioSender) {
      newTrack.enabled = this.micTrack ? this.micTrack.enabled : false;
      await this.audioSender.replaceTrack(newTrack);
      if (this.micTrack) {
        this.micTrack.stop();
      }
      this.micTrack = newTrack;
    }
  }

  public getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  public close(): void {
    if (this.isClosed) return; // Idempotent close
    this.isClosed = true;

    if (this.micTrack) {
      this.micTrack.stop();
      this.micTrack = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}
