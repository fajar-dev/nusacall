import { describe, it, expect, vi } from 'vitest';
import { CallingSettingsService } from '../src/modules/meta/application/CallingSettingsService';
import type { GraphApiClientPort } from '../src/modules/meta/domain/ports/GraphApiClientPort';
import { ValidationError } from '../src/shared/errors/AppError';

describe('E2-T6: Calling Settings GET/PUT & 8 Negative Validation Tests', () => {
  const mockGraphClient: GraphApiClientPort = {
    initiateCall: vi.fn(),
    preAcceptCall: vi.fn(),
    acceptCall: vi.fn(),
    rejectCall: vi.fn(),
    terminateCall: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({ status: 'ENABLED' }),
    updateSettings: vi.fn().mockResolvedValue({ success: true }),
    sendInteractiveVoiceCall: vi.fn(),
    sendTemplateMessage: vi.fn(),
    getMediaUrl: vi.fn(),
    downloadMedia: vi.fn(),
  };

  const service = new CallingSettingsService(mockGraphClient);
  const referenceDate = '2026-08-11';

  const validPayload = {
    calling: {
      status: 'ENABLED',
      call_icon_visibility: 'DEFAULT',
      call_hours: {
        status: 'ENABLED',
        timezone_id: 'Asia/Jakarta',
        weekly_operating_hours: [
          { day_of_week: 'MONDAY', open_time: '0800', close_time: '1200' },
          { day_of_week: 'MONDAY', open_time: '1300', close_time: '1700' },
        ],
        holiday_schedule: [
          { date: '2026-12-25', start_time: '0000', end_time: '2359' },
        ],
      },
    },
  };

  it('should validate valid calling settings payload successfully', () => {
    const validated = service.validateCallingSettings(validPayload, referenceDate);
    expect(validated.calling.status).toBe('ENABLED');
    expect(validated.calling.call_hours.weekly_operating_hours).toHaveLength(2);
  });

  it('Negative Test 1: Invalid status should throw ValidationError', () => {
    const payload = {
      ...validPayload,
      calling: { ...validPayload.calling, status: 'INVALID_STATUS' },
    };
    expect(() => service.validateCallingSettings(payload, referenceDate)).toThrow(ValidationError);
  });

  it('Negative Test 2: Invalid call_icon_visibility should throw ValidationError', () => {
    const payload = {
      ...validPayload,
      calling: { ...validPayload.calling, call_icon_visibility: 'HIDDEN' },
    };
    expect(() => service.validateCallingSettings(payload, referenceDate)).toThrow(ValidationError);
  });

  it('Negative Test 3: Exceeding 2 operating entries per day should throw ValidationError', () => {
    const payload = {
      calling: {
        ...validPayload.calling,
        call_hours: {
          ...validPayload.calling.call_hours,
          weekly_operating_hours: [
            { day_of_week: 'MONDAY', open_time: '0800', close_time: '1000' },
            { day_of_week: 'MONDAY', open_time: '1100', close_time: '1300' },
            { day_of_week: 'MONDAY', open_time: '1400', close_time: '1600' }, // 3rd entry!
          ],
        },
      },
    };
    expect(() => service.validateCallingSettings(payload, referenceDate)).toThrow(ValidationError);
  });

  it('Negative Test 4: Overlapping operating hours for same day should throw ValidationError', () => {
    const payload = {
      calling: {
        ...validPayload.calling,
        call_hours: {
          ...validPayload.calling.call_hours,
          weekly_operating_hours: [
            { day_of_week: 'MONDAY', open_time: '0800', close_time: '1200' },
            { day_of_week: 'MONDAY', open_time: '1100', close_time: '1500' }, // Overlaps 1100-1200!
          ],
        },
      },
    };
    expect(() => service.validateCallingSettings(payload, referenceDate)).toThrow(ValidationError);
  });

  it('Negative Test 5: open_time >= close_time should throw ValidationError', () => {
    const payload = {
      calling: {
        ...validPayload.calling,
        call_hours: {
          ...validPayload.calling.call_hours,
          weekly_operating_hours: [
            { day_of_week: 'MONDAY', open_time: '1700', close_time: '0800' }, // open >= close!
          ],
        },
      },
    };
    expect(() => service.validateCallingSettings(payload, referenceDate)).toThrow(ValidationError);
  });

  it('Negative Test 6: Exceeding 20 holiday schedule entries should throw ValidationError', () => {
    const holidays = Array.from({ length: 21 }, (_, i) => ({
      date: `2026-12-${String(i + 1).padStart(2, '0')}`,
      start_time: '0000',
      end_time: '2359',
    }));

    const payload = {
      calling: {
        ...validPayload.calling,
        call_hours: {
          ...validPayload.calling.call_hours,
          holiday_schedule: holidays, // 21 entries!
        },
      },
    };
    expect(() => service.validateCallingSettings(payload, referenceDate)).toThrow(ValidationError);
  });

  it('Negative Test 7: Past holiday date should throw ValidationError', () => {
    const payload = {
      calling: {
        ...validPayload.calling,
        call_hours: {
          ...validPayload.calling.call_hours,
          holiday_schedule: [{ date: '2020-01-01', start_time: '0000', end_time: '2359' }], // Past!
        },
      },
    };
    expect(() => service.validateCallingSettings(payload, referenceDate)).toThrow(ValidationError);
  });

  it('Negative Test 8: Invalid HHMM time format should throw ValidationError', () => {
    const payload = {
      calling: {
        ...validPayload.calling,
        call_hours: {
          ...validPayload.calling.call_hours,
          weekly_operating_hours: [
            { day_of_week: 'MONDAY', open_time: '2500', close_time: '1700' }, // 2500 is invalid time!
          ],
        },
      },
    };
    expect(() => service.validateCallingSettings(payload, referenceDate)).toThrow(ValidationError);
  });
});
