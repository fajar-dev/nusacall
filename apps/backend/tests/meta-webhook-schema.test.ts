import { describe, it, expect } from 'vitest';
import {
  MetaWebhookPayloadSchema,
  MetaCallsChangeValueSchema,
  MetaAccountUpdateValueSchema,
} from '../src/modules/meta/infrastructure/schemas/meta-webhook.schema';

describe('E2-T5: Meta Webhook Zod Payload Schemas & Contract Tests', () => {
  it('should validate incoming call (connect UIC offer) webhook fixture', () => {
    const fixture = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_100',
          changes: [
            {
              field: 'calls',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '62812345678', phone_number_id: 'PN_100' },
                contacts: [{ profile: { name: 'Budi' }, wa_id: '6281361905133' }],
                calls: [
                  {
                    id: 'wacid.ABGG12345',
                    to: '62812345678',
                    from: '6281361905133',
                    event: 'connect',
                    timestamp: '1671644824',
                    direction: 'USER_INITIATED',
                    deeplink_payload: 'SUPPORT_GANGGUAN',
                    cta_payload: 'SUPPORT_GANGGUAN|TICKET-88123',
                    session: { sdp_type: 'offer', sdp: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\n' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const parsed = MetaWebhookPayloadSchema.parse(fixture);
    expect(parsed.object).toBe('whatsapp_business_account');
    expect(parsed.entry[0]?.changes[0]?.field).toBe('calls');

    const callsValue = MetaCallsChangeValueSchema.parse(parsed.entry[0]?.changes[0]?.value);
    expect(callsValue.calls?.[0]?.event).toBe('connect');
  });

  it('should validate call status item (RINGING / ACCEPTED) webhook fixture', () => {
    const fixture = {
      statuses: [
        {
          id: 'wacid.ABGG12345',
          type: 'call',
          status: 'RINGING',
          timestamp: '1671644824',
          recipient_id: '6281361905133',
          biz_opaque_callback_data: 'call_01J8ABC',
        },
      ],
    };

    const parsed = MetaCallsChangeValueSchema.parse(fixture);
    expect(parsed.statuses?.[0]?.status).toBe('RINGING');
    expect(parsed.statuses?.[0]?.biz_opaque_callback_data).toBe('call_01J8ABC');
  });

  it('should validate terminate call event fixture', () => {
    const fixture = {
      calls: [
        {
          id: 'wacid.ABGG12345',
          to: '62812345678',
          from: '6281361905133',
          event: 'terminate',
          direction: 'USER_INITIATED',
          biz_opaque_callback_data: 'call_01J8ABC',
          timestamp: '1671644824',
          status: 'COMPLETED',
          start_time: '1671644824',
          end_time: '1671644944',
          duration: 120,
        },
      ],
    };

    const parsed = MetaCallsChangeValueSchema.parse(fixture);
    const termEvent = parsed.calls?.[0];
    expect(termEvent?.event).toBe('terminate');
    if (termEvent?.event === 'terminate') {
      expect(termEvent.status).toBe('COMPLETED');
      expect(termEvent.duration).toBe(120);
    }
  });

  it('should validate call_recording_available event fixture', () => {
    const fixture = {
      calls: [
        {
          id: 'wacid.ABGG12345',
          from: '6281361905133',
          timestamp: '1728932177',
          event: 'call_recording_available',
          call_recording: {
            type: 'audio',
            audio: {
              id: '1002764438271669',
              sha256: 'Y9vv...',
              mime_type: 'audio/ogg; codecs=opus',
              url: 'https://lookaside.fbsbx.com/sample',
            },
          },
        },
      ],
    };

    const parsed = MetaCallsChangeValueSchema.parse(fixture);
    const recEvent = parsed.calls?.[0];
    expect(recEvent?.event).toBe('call_recording_available');
  });

  it('should validate account restriction update fixture', () => {
    const fixture = {
      phone_number: '62812345678',
      event: 'ACCOUNT_RESTRICTION',
      violation_info: { violation_type: 'LOW_CALLING_QUALITY' },
      restriction_info: [
        {
          restriction_type: 'RESTRICTED_BIZ_INITIATED_AND_USER_INITIATED_CALLING',
          expiration: 1641848057,
        },
      ],
    };

    const parsed = MetaAccountUpdateValueSchema.parse(fixture);
    expect(parsed.event).toBe('ACCOUNT_RESTRICTION');
    expect(parsed.restriction_info?.[0]?.restriction_type).toBe(
      'RESTRICTED_BIZ_INITIATED_AND_USER_INITIATED_CALLING'
    );
  });

  it('should throw ZodError when parsing illegal payload', () => {
    const illegalFixture = {
      object: 12345, // invalid type
      entry: 'not_an_array',
    };

    expect(() => MetaWebhookPayloadSchema.parse(illegalFixture)).toThrow();
  });
});
