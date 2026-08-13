import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PeerConnectionManager } from '../app/utils/webrtc/PeerConnectionManager';

// Mock RTCPeerConnection and MediaStream for Node testing environment
class MockMediaStreamTrack {
  public enabled = true;
  public kind = 'audio';
  public stop = vi.fn();
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()];
  getAudioTracks() {
    return this.tracks;
  }
  getTracks() {
    return this.tracks;
  }
}

class MockRTCPeerConnection {
  public iceConnectionState = 'new';
  public onicecandidate: any = null;
  public oniceconnectionstatechange: any = null;
  public ontrack: any = null;
  public localDescription: any = null;
  public remoteDescription: any = null;

  async createOffer() {
    return { type: 'offer', sdp: 'v=0\r\no=mock...' };
  }
  async setLocalDescription(desc: any) {
    this.localDescription = desc;
  }
  async setRemoteDescription(desc: any) {
    this.remoteDescription = desc;
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'v=0\r\no=mock_answer...' };
  }
  addTrack(track: any) {
    return {
      track,
      replaceTrack: vi.fn().mockResolvedValue(undefined),
    };
  }
  close = vi.fn();
}

describe('E7-T2: PeerConnectionManager (WebRTC & Rule N6 Mic Safety)', () => {
  beforeEach(() => {
    vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection);
  });

  it('RULE N6 DoD: microphone track MUST NOT be enabled before enableMic() is called', async () => {
    const manager = new PeerConnectionManager();
    await manager.initialize();

    const mockStream = new MockMediaStream() as any;
    await manager.prepareMicrophone(mockStream);

    // Mic must be disabled (enabled === false) prior to enableMic()
    expect(manager.isMicEnabled()).toBe(false);

    // Enable mic upon call.accepted
    manager.enableMic();
    expect(manager.isMicEnabled()).toBe(true);

    manager.disableMic();
    expect(manager.isMicEnabled()).toBe(false);
  });

  it('DoD: close() should be IDEMPOTENT and clean up resources cleanly', async () => {
    const manager = new PeerConnectionManager();
    await manager.initialize();

    const mockStream = new MockMediaStream() as any;
    await manager.prepareMicrophone(mockStream);

    // Call close twice
    manager.close();
    manager.close(); // Second call must not throw or cause errors

    expect(manager.getPeerConnection()).toBeNull();
  });
});
