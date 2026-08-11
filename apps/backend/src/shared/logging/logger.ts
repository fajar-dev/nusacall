import pino from 'pino';
import { getCorrelationId } from './correlation';

export const REDACT_PATHS = [
  'password',
  '*.password',
  'sdp',
  '*.sdp',
  'accessToken',
  '*.accessToken',
  'appSecret',
  '*.appSecret',
  'token',
  '*.token',
  'sdpAnswer',
  '*.sdpAnswer',
  'sdpOffer',
  '*.sdpOffer',
  'authorization',
  '*.authorization',
];

export function createLogger(destination?: pino.DestinationStream) {
  return pino(
    {
      level: process.env.LOG_LEVEL || 'info',
      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
      },
      mixin() {
        const correlationId = getCorrelationId();
        return correlationId ? { correlationId } : {};
      },
    },
    destination,
  );
}

export const logger = createLogger();
