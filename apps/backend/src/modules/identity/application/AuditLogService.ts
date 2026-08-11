import type { AuditLogRepository, CreateAuditLogParams, AuditLogData } from '../domain/ports/AuditLogRepository';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'authorization',
  'sdp',
  'recoverycodes',
  'totpsecret',
]);

export class AuditLogService {
  constructor(private readonly repo: AuditLogRepository) {}

  async log(params: CreateAuditLogParams): Promise<AuditLogData> {
    const sanitizedDetails = params.details ? this.sanitizeDetails(params.details) : null;
    return this.repo.save({
      ...params,
      details: sanitizedDetails,
    });
  }

  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
