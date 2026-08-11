import { AppError } from '../../../../shared/errors/AppError';

export interface MetaErrorPayload {
  code: number;
  subcode?: number;
  message: string;
  details?: string;
  fbtrace_id?: string;
}

export class MetaApiError extends AppError {
  readonly httpStatus = 400;
  public readonly metaCode: number;
  public readonly metaSubcode?: number;
  public readonly fbtraceId?: string;
  public readonly metaDetails?: string;

  constructor(payload: MetaErrorPayload) {
    const detailsObj: Record<string, unknown> = { code: payload.code };
    if (payload.subcode !== undefined) detailsObj.subcode = payload.subcode;
    if (payload.fbtrace_id !== undefined) detailsObj.fbtrace_id = payload.fbtrace_id;
    if (payload.details !== undefined) detailsObj.details = payload.details;

    super('META_API_ERROR', `Meta API Error (${payload.code}): ${payload.message}`, detailsObj);

    this.metaCode = payload.code;
    if (payload.subcode !== undefined) this.metaSubcode = payload.subcode;
    if (payload.fbtrace_id !== undefined) this.fbtraceId = payload.fbtrace_id;
    if (payload.details !== undefined) this.metaDetails = payload.details;
  }
}

export class NetworkError extends AppError {
  readonly httpStatus = 504;
  constructor(code = 'NETWORK_ERROR', message = 'Kegagalan jaringan atau timeout ke Meta Graph API', details?: unknown) {
    super(code, message, details);
  }
}
