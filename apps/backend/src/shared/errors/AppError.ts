export abstract class AppError extends Error {
  abstract readonly httpStatus: number;
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly httpStatus = 400;
  constructor(code = 'VALIDATION_ERROR', message = 'Validasi input gagal', details?: unknown) {
    super(code, message, details);
  }
}

export class UnauthenticatedError extends AppError {
  readonly httpStatus = 401;
  constructor(code = 'UNAUTHENTICATED', message = 'Tidak terautentikasi', details?: unknown) {
    super(code, message, details);
  }
}

export class ForbiddenError extends AppError {
  readonly httpStatus = 403;
  constructor(code = 'FORBIDDEN', message = 'Tidak berwenang', details?: unknown) {
    super(code, message, details);
  }
}

export class NotFoundError extends AppError {
  readonly httpStatus = 404;
  constructor(code = 'NOT_FOUND', message = 'Sumber daya tidak ditemukan', details?: unknown) {
    super(code, message, details);
  }
}

export class ConflictError extends AppError {
  readonly httpStatus = 409;
  constructor(code = 'CONFLICT', message = 'Terjadi konflik state atau data duplikat', details?: unknown) {
    super(code, message, details);
  }
}

export class IllegalStateError extends AppError {
  readonly httpStatus = 409;
  constructor(code = 'ILLEGAL_STATE_TRANSITION', message = 'Transisi state tidak sah', details?: unknown) {
    super(code, message, details);
  }
}

export class BusinessRuleError extends AppError {
  readonly httpStatus = 422;
  constructor(code = 'BUSINESS_RULE_VIOLATION', message = 'Aturan bisnis dilanggar', details?: unknown) {
    super(code, message, details);
  }
}

export class RateLimitError extends AppError {
  readonly httpStatus = 429;
  constructor(
    code = 'RATE_LIMITED',
    message = 'Terlalu banyak permintaan, coba lagi nanti',
    details?: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(code, message, details);
  }
}

export class UpstreamMetaError extends AppError {
  readonly httpStatus = 502;
  constructor(
    code = 'UPSTREAM_META_ERROR',
    message = 'Kegagalan layanan Meta Cloud API',
    details?: unknown,
    readonly metaCode?: number,
    readonly metaSubcode?: number,
    readonly fbtraceId?: string,
  ) {
    super(code, message, details);
  }
}

export class InternalError extends AppError {
  readonly httpStatus = 500;
  constructor(code = 'INTERNAL_ERROR', message = 'Kesalahan internal server', details?: unknown) {
    super(code, message, details);
  }
}
