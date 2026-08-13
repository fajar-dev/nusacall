export interface SdpCachePort {
  saveAnswerSdp(wacid: string, sdp: string, ttlSeconds?: number): Promise<void>;
  getAnswerSdp(wacid: string): Promise<string | null>;
  deleteAnswerSdp(wacid: string): Promise<void>;
}
