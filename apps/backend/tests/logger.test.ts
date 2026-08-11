import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { createLogger } from '../src/shared/logging/logger';
import { runWithCorrelationId } from '../src/shared/logging/correlation';

describe('shared/logging/logger.ts', () => {
  it('should redact sensitive fields (password, sdp, accessToken)', () => {
    let output = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    const testLogger = createLogger(stream);

    testLogger.info({
      user: 'alice',
      password: 'mysecretpassword123',
      sdp: 'v=0\r\no=- 12345 67890 IN IP4 127.0.0.1...',
      accessToken: 'eaag123456789secrettoken',
    });

    const logEntry = JSON.parse(output.trim());

    expect(logEntry.user).toBe('alice');
    expect(logEntry.password).toBe('[REDACTED]');
    expect(logEntry.sdp).toBe('[REDACTED]');
    expect(logEntry.accessToken).toBe('[REDACTED]');
  });

  it('should include correlationId from AsyncLocalStorage', () => {
    let output = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    const testLogger = createLogger(stream);

    runWithCorrelationId('test-corr-id-999', () => {
      testLogger.info('hello with correlation id');
    });

    const logEntry = JSON.parse(output.trim());
    expect(logEntry.correlationId).toBe('test-corr-id-999');
  });
});
