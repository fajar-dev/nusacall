import { z } from 'zod';

export const MetaMetadataSchema = z.object({
  display_phone_number: z.string().optional(),
  phone_number_id: z.string(),
});

export const MetaContactSchema = z.object({
  profile: z.object({
    name: z.string(),
  }),
  wa_id: z.string(),
});

export const MetaCallSessionSchema = z.object({
  sdp_type: z.enum(['offer', 'answer']),
  sdp: z.string(),
});

export const MetaCallConnectEventSchema = z.object({
  id: z.string(),
  to: z.string(),
  from: z.string(),
  event: z.literal('connect'),
  timestamp: z.string(),
  direction: z.enum(['USER_INITIATED', 'BUSINESS_INITIATED']),
  deeplink_payload: z.string().optional(),
  cta_payload: z.string().optional(),
  biz_opaque_callback_data: z.string().optional(),
  session: MetaCallSessionSchema,
});

export const MetaCallStatusItemSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  status: z.enum(['RINGING', 'ACCEPTED', 'REJECTED']),
  timestamp: z.string(),
  recipient_id: z.string().optional(),
  biz_opaque_callback_data: z.string().optional(),
});

export const MetaCallTerminateEventSchema = z.object({
  id: z.string(),
  to: z.string().optional(),
  from: z.string().optional(),
  event: z.literal('terminate'),
  direction: z.enum(['USER_INITIATED', 'BUSINESS_INITIATED']).optional(),
  deeplink_payload: z.string().optional(),
  cta_payload: z.string().optional(),
  biz_opaque_callback_data: z.string().optional(),
  timestamp: z.string(),
  status: z.enum(['COMPLETED', 'FAILED']),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  duration: z.number().optional(),
  errors: z
    .array(
      z.object({
        code: z.number(),
        message: z.string(),
        href: z.string().optional(),
        error_data: z.object({ details: z.string().optional() }).optional(),
      })
    )
    .optional(),
});

export const MetaCallRecordingAvailableEventSchema = z.object({
  id: z.string(),
  from: z.string().optional(),
  timestamp: z.string(),
  event: z.literal('call_recording_available'),
  call_recording: z.object({
    type: z.string(),
    audio: z.object({
      id: z.string(),
      sha256: z.string(),
      mime_type: z.string(),
      url: z.string(),
    }),
  }),
});

export const MetaCallTranscriptionAvailableEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  event: z.literal('call_transcription_available'),
  call_transcript: z.object({
    document: z.object({
      id: z.string(),
      sha256: z.string(),
      mime_type: z.string(),
      url: z.string(),
    }),
  }),
});

export const MetaCallsChangeValueSchema = z.object({
  messaging_product: z.string().optional(),
  metadata: MetaMetadataSchema.optional(),
  contacts: z.array(MetaContactSchema).optional(),
  calls: z
    .array(
      z.union([
        MetaCallConnectEventSchema,
        MetaCallTerminateEventSchema,
        MetaCallRecordingAvailableEventSchema,
        MetaCallTranscriptionAvailableEventSchema,
      ])
    )
    .optional(),
  statuses: z.array(MetaCallStatusItemSchema).optional(),
});

export const MetaAccountUpdateValueSchema = z.object({
  phone_number: z.string(),
  event: z.enum(['ACCOUNT_VIOLATION', 'ACCOUNT_RESTRICTION']),
  violation_info: z.object({ violation_type: z.string() }).optional(),
  restriction_info: z
    .array(
      z.object({
        restriction_type: z.string(),
        expiration: z.number().optional(),
      })
    )
    .optional(),
});

export const MetaChangeSchema = z.object({
  field: z.string(),
  value: z.record(z.string(), z.unknown()),
});

export const MetaEntrySchema = z.object({
  id: z.string(),
  changes: z.array(MetaChangeSchema),
});

export const MetaWebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(MetaEntrySchema),
});

export type MetaWebhookPayload = z.infer<typeof MetaWebhookPayloadSchema>;
export type MetaCallsChangeValue = z.infer<typeof MetaCallsChangeValueSchema>;
