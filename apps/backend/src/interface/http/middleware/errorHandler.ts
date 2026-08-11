import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError, RateLimitError } from '../../../shared/errors/AppError';
import { getCorrelationId } from '../../../shared/logging/correlation';
import { logger } from '../../../shared/logging/logger';

export const errorHandler: ErrorHandler = (err, c) => {
  const correlationId = getCorrelationId() || c.req.header('x-correlation-id') || 'unknown';

  if (err instanceof AppError) {
    logger.warn({ err, correlationId, code: err.code }, err.message);

    if (err instanceof RateLimitError && err.retryAfterSeconds) {
      c.header('Retry-After', String(err.retryAfterSeconds));
    }

    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
          correlationId,
        },
      },
      err.httpStatus as ContentfulStatusCode,
    );
  }

  logger.error({ err, correlationId }, 'Unhandled application error');

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Kesalahan internal server',
        correlationId,
      },
    },
    500,
  );
};
