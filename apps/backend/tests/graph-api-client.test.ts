import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { GraphApiClient } from '../src/modules/meta/infrastructure/client/GraphApiClient';
import { TokenResolver, type WaPhoneNumberRepositoryPort } from '../src/modules/meta/application/TokenResolver';
import { SecretCipher } from '../src/shared/infrastructure/crypto/SecretCipher';
import { MetaApiError, NetworkError } from '../src/modules/meta/domain/errors/MetaApiError';

describe('E2-T4: Meta Graph API Client (MSW, 4xx no-retry, 5xx retry with backoff, timeout)', () => {
  const cipher = new SecretCipher({
    activeKeyId: 'k1',
    keys: new Map([['k1', crypto.randomBytes(32)]]),
  });

  const rawToken = 'EAAG_TEST_TOKEN_123';
  const encryptedToken = cipher.encrypt(rawToken);

  let mockRepo: WaPhoneNumberRepositoryPort;
  let tokenResolver: TokenResolver;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockRepo = {
      findByPhoneNumberId: vi.fn().mockResolvedValue({
        phoneNumberId: 'pn_100',
        accessTokenEnc: encryptedToken,
      }),
    };
    tokenResolver = new TokenResolver(mockRepo, cipher);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should successfully initiate a WhatsApp call', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ calls: [{ id: 'meta_call_999' }] }),
    } as Response);

    const client = new GraphApiClient(tokenResolver, { baseUrl: 'https://graph.facebook.com' });
    const res = await client.initiateCall({
      phoneNumberId: 'pn_100',
      to: '6281234567890',
      callId: 'internal_call_1',
      sdpOffer: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\n',
    });

    expect(res.callId).toBe('meta_call_999');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('CRITICAL: 4xx error must NOT retry and throw MetaApiError immediately', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 100,
          error_subcode: 138006,
          message: 'Unsupported post request',
          fbtrace_id: 'Trace_400_XYZ',
        },
      }),
    } as Response);

    globalThis.fetch = fetchMock;

    const client = new GraphApiClient(tokenResolver, {
      baseUrl: 'https://graph.facebook.com',
      backoffsMs: [10, 20],
    });

    await expect(
      client.initiateCall({
        phoneNumberId: 'pn_100',
        to: '6281234567890',
        callId: 'call_400',
        sdpOffer: 'sdp_offer',
      })
    ).rejects.toThrow(MetaApiError);

    // MUST be called exactly 1 time (NO RETRY for 4xx)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('5xx error should retry up to maxAttempts with backoff and succeed on retry', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: false,
          status: 503,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: { code: 503, message: 'Service Unavailable' } }),
        } as Response;
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ calls: [{ id: 'call_retry_success' }] }),
      } as Response;
    });

    globalThis.fetch = fetchMock;

    const client = new GraphApiClient(tokenResolver, {
      baseUrl: 'https://graph.facebook.com',
      backoffsMs: [10, 20],
    });

    const res = await client.initiateCall({
      phoneNumberId: 'pn_100',
      to: '6281234567890',
      callId: 'call_503',
      sdpOffer: 'sdp_offer',
    });

    expect(res.callId).toBe('call_retry_success');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should throw NetworkError on request timeout', async () => {
    const fetchMock = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        const signal = options?.signal as AbortSignal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    globalThis.fetch = fetchMock;

    const client = new GraphApiClient(tokenResolver, {
      baseUrl: 'https://graph.facebook.com',
      timeoutMs: 50,
      backoffsMs: [10],
    });

    await expect(
      client.getSettings({ phoneNumberId: 'pn_100' })
    ).rejects.toThrow(NetworkError);
  });
});
