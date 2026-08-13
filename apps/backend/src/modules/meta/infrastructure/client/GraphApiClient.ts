import type {
  GraphApiClientPort,
  InitiateCallParams,
  PreAcceptCallParams,
  AcceptCallParams,
  RejectCallParams,
  TerminateCallParams,
  GetSettingsParams,
  UpdateSettingsParams,
  SendInteractiveVoiceCallParams,
  SendTemplateMessageParams,
  GetMediaUrlParams,
  DownloadMediaParams,
} from '../../domain/ports/GraphApiClientPort';
import type { TokenResolver } from '../../application/TokenResolver';
import { MetaApiError, NetworkError, type MetaErrorPayload } from '../../domain/errors/MetaApiError';

export interface GraphApiClientConfig {
  baseUrl?: string;
  apiVersion?: string;
  timeoutMs?: number;
  backoffsMs?: number[];
}

interface MetaErrorResponseBody {
  error?: {
    code?: number;
    error_subcode?: number;
    message?: string;
    error_user_title?: string;
    error_user_msg?: string;
    fbtrace_id?: string;
  };
}

export class GraphApiClient implements GraphApiClientPort {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly backoffsMs: number[];

  constructor(
    private readonly tokenResolver: TokenResolver,
    config?: GraphApiClientConfig
  ) {
    const apiVersion = config?.apiVersion || process.env.META_GRAPH_API_VERSION || 'v23.0';
    const rawBaseUrl = config?.baseUrl || process.env.META_GRAPH_API_BASE_URL || 'https://graph.facebook.com';
    this.baseUrl = `${rawBaseUrl.replace(/\/$/, '')}/${apiVersion}`;
    this.timeoutMs = config?.timeoutMs ?? 10000;
    this.backoffsMs = config?.backoffsMs ?? [300, 900];
  }

  private async request<T>(
    endpoint: string,
    phoneNumberId: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.tokenResolver.getAccessToken(phoneNumberId);
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}/${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    let attempt = 0;
    const maxAttempts = 1 + this.backoffsMs.length;

    while (attempt < maxAttempts) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          if (response.headers.get('content-type')?.includes('application/json')) {
            return (await response.json()) as T;
          }
          return (await response.arrayBuffer()) as unknown as T;
        }

        let errorData: MetaErrorResponseBody = {};
        try {
          errorData = (await response.json()) as MetaErrorResponseBody;
        } catch {
          // Response body is non-JSON
        }

        const metaErr = errorData.error || {};
        const is4xx = response.status >= 400 && response.status < 500;

        const payload: MetaErrorPayload = {
          code: metaErr.code || response.status,
          message: metaErr.message || `Meta Graph API error ${response.status}`,
        };
        if (metaErr.error_subcode !== undefined) payload.subcode = metaErr.error_subcode;
        const detailsStr = metaErr.error_user_title || metaErr.error_user_msg;
        if (detailsStr) {
          payload.details = detailsStr;
        }
        if (metaErr.fbtrace_id !== undefined) payload.fbtrace_id = metaErr.fbtrace_id;

        if (is4xx) {
          // Rule: NO RETRY on 4xx errors
          throw new MetaApiError(payload);
        }

        // 5xx status code -> candidates for retry
        if (attempt >= maxAttempts) {
          throw new MetaApiError(payload);
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof MetaApiError) {
          throw err;
        }

        if (attempt >= maxAttempts) {
          if (err instanceof Error && err.name === 'AbortError') {
            throw new NetworkError('META_API_TIMEOUT', `Meta Graph API request timed out after ${this.timeoutMs}ms`);
          }
          const msg = err instanceof Error ? err.message : 'Koneksi ke Meta Graph API gagal';
          throw new NetworkError('META_API_NETWORK_ERROR', msg);
        }
      }

      // Wait backoff duration before next retry attempt
      const backoff = this.backoffsMs[attempt - 1] ?? 300;
      await new Promise((res) => setTimeout(res, backoff));
    }

    throw new NetworkError('META_API_NETWORK_ERROR', 'Permintaan ke Meta Graph API gagal');
  }

  async initiateCall(params: InitiateCallParams): Promise<{ callId: string; status: string }> {
    const res = await this.request<{ calls?: Array<{ id: string }> }>(
      `${params.phoneNumberId}/calls`,
      params.phoneNumberId,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: params.to,
          biz_opaque_callback_data: params.callId,
          action: 'connect',
          sdp: params.sdpOffer,
        }),
      }
    );
    return { callId: res.calls?.[0]?.id || params.callId, status: 'INITIATED' };
  }

  async preAcceptCall(params: PreAcceptCallParams): Promise<{ success: boolean }> {
    await this.request(
      `${params.phoneNumberId}/calls`,
      params.phoneNumberId,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          call_id: params.callId,
          action: 'pre_accept',
          sdp: params.sdpAnswer,
          ...(params.bizOpaqueCallbackData ? { biz_opaque_callback_data: params.bizOpaqueCallbackData } : {}),
        }),
      }
    );
    return { success: true };
  }

  async acceptCall(params: AcceptCallParams): Promise<{ success: boolean }> {
    await this.request(
      `${params.phoneNumberId}/calls`,
      params.phoneNumberId,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          call_id: params.callId,
          action: 'accept',
          sdp: params.sdpAnswer,
          ...(params.bizOpaqueCallbackData ? { biz_opaque_callback_data: params.bizOpaqueCallbackData } : {}),
        }),
      }
    );
    return { success: true };
  }

  async rejectCall(params: RejectCallParams): Promise<{ success: boolean }> {
    await this.request(
      `${params.phoneNumberId}/calls`,
      params.phoneNumberId,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          call_id: params.callId,
          action: 'reject',
        }),
      }
    );
    return { success: true };
  }

  async terminateCall(params: TerminateCallParams): Promise<{ success: boolean }> {
    await this.request(
      `${params.phoneNumberId}/calls`,
      params.phoneNumberId,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          call_id: params.callId,
          action: 'terminate',
        }),
      }
    );
    return { success: true };
  }

  async getSettings(params: GetSettingsParams): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `${params.phoneNumberId}/whatsapp_calling_settings`,
      params.phoneNumberId,
      { method: 'GET' }
    );
  }

  async updateSettings(params: UpdateSettingsParams): Promise<{ success: boolean }> {
    await this.request(
      `${params.phoneNumberId}/whatsapp_calling_settings`,
      params.phoneNumberId,
      {
        method: 'POST',
        body: JSON.stringify(params.settings),
      }
    );
    return { success: true };
  }

  async sendInteractiveVoiceCall(params: SendInteractiveVoiceCallParams): Promise<{ messageId: string }> {
    const res = await this.request<{ messages?: Array<{ id: string }> }>(
      `${params.phoneNumberId}/messages`,
      params.phoneNumberId,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.to,
          type: 'interactive',
          interactive: {
            type: 'voice_call',
            body: { text: params.bodyText },
            action: { name: 'voice_call', parameters: { button_text: params.buttonText } },
          },
        }),
      }
    );
    return { messageId: res.messages?.[0]?.id || '' };
  }

  async sendTemplateMessage(params: SendTemplateMessageParams): Promise<{ messageId: string }> {
    const res = await this.request<{ messages?: Array<{ id: string }> }>(
      `${params.phoneNumberId}/messages`,
      params.phoneNumberId,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.to,
          type: 'template',
          template: {
            name: params.templateName,
            language: { code: params.languageCode },
            components: params.components || [],
          },
        }),
      }
    );
    return { messageId: res.messages?.[0]?.id || '' };
  }

  async getMediaUrl(params: GetMediaUrlParams): Promise<{ url: string; mimeType?: string }> {
    const res = await this.request<{ url: string; mime_type?: string }>(
      params.mediaId,
      params.phoneNumberId,
      { method: 'GET' }
    );
    const result: { url: string; mimeType?: string } = { url: res.url };
    if (res.mime_type !== undefined) {
      result.mimeType = res.mime_type;
    }
    return result;
  }

  async downloadMedia(params: DownloadMediaParams): Promise<Buffer> {
    const ab = await this.request<ArrayBuffer>(params.mediaUrl, params.phoneNumberId, {
      method: 'GET',
    });
    return Buffer.from(ab);
  }
}
