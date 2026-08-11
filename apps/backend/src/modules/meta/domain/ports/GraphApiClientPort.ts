export interface InitiateCallParams {
  phoneNumberId: string;
  to: string;
  callId: string;
  sdpOffer: string;
}

export interface PreAcceptCallParams {
  phoneNumberId: string;
  callId: string;
  sdpAnswer: string;
}

export interface AcceptCallParams {
  phoneNumberId: string;
  callId: string;
  sdpAnswer: string;
}

export interface RejectCallParams {
  phoneNumberId: string;
  callId: string;
}

export interface TerminateCallParams {
  phoneNumberId: string;
  callId: string;
}

export interface GetSettingsParams {
  phoneNumberId: string;
}

export interface UpdateSettingsParams {
  phoneNumberId: string;
  settings: Record<string, unknown>;
}

export interface SendInteractiveVoiceCallParams {
  phoneNumberId: string;
  to: string;
  bodyText: string;
  buttonText: string;
}

export interface SendTemplateMessageParams {
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode: string;
  components?: unknown[];
}

export interface GetMediaUrlParams {
  mediaId: string;
  phoneNumberId: string;
}

export interface DownloadMediaParams {
  mediaUrl: string;
  phoneNumberId: string;
}

export interface GraphApiClientPort {
  initiateCall(params: InitiateCallParams): Promise<{ callId: string; status: string }>;
  preAcceptCall(params: PreAcceptCallParams): Promise<{ success: boolean }>;
  acceptCall(params: AcceptCallParams): Promise<{ success: boolean }>;
  rejectCall(params: RejectCallParams): Promise<{ success: boolean }>;
  terminateCall(params: TerminateCallParams): Promise<{ success: boolean }>;

  getSettings(params: GetSettingsParams): Promise<Record<string, unknown>>;
  updateSettings(params: UpdateSettingsParams): Promise<{ success: boolean }>;

  sendInteractiveVoiceCall(params: SendInteractiveVoiceCallParams): Promise<{ messageId: string }>;
  sendTemplateMessage(params: SendTemplateMessageParams): Promise<{ messageId: string }>;

  getMediaUrl(params: GetMediaUrlParams): Promise<{ url: string; mimeType?: string }>;
  downloadMedia(params: DownloadMediaParams): Promise<Buffer>;
}
