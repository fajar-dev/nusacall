import { z } from 'zod';
import type { TenantContext } from '../../../shared/domain/TenantContext';
import type { GraphApiClientPort } from '../domain/ports/GraphApiClientPort';
import { ValidationError, ForbiddenError } from '../../../shared/errors/AppError';

export const DayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

const HhmmTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3])[0-5]\d$/, 'Format jam harus HHMM (0000 - 2359)');

export const WeeklyOperatingHourItemSchema = z.object({
  day_of_week: DayOfWeekSchema,
  open_time: HhmmTimeSchema,
  close_time: HhmmTimeSchema,
});

export const HolidayScheduleItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  start_time: HhmmTimeSchema,
  end_time: HhmmTimeSchema,
});

export const CallingSettingsInputSchema = z.object({
  calling: z.object({
    status: z.enum(['ENABLED', 'DISABLED']),
    call_icon_visibility: z.enum(['DEFAULT', 'DISABLE_ALL']),
    call_icons: z.object({
      restrict_to_user_countries: z.array(z.string()).optional(),
    }).optional(),
    call_hours: z.object({
      status: z.enum(['ENABLED', 'DISABLED']),
      timezone_id: z.string().min(1, 'timezone_id tidak boleh kosong'),
      weekly_operating_hours: z.array(WeeklyOperatingHourItemSchema).min(1, 'weekly_operating_hours wajib ada minimal 1 entri'),
      holiday_schedule: z.array(HolidayScheduleItemSchema).max(20, 'holiday_schedule maksimal 20 entri').optional(),
    }),
    callback_permission_status: z.enum(['ENABLED', 'DISABLED']).optional(),
    sip: z.object({
      status: z.enum(['ENABLED', 'DISABLED']),
    }).optional(),
  }),
});

export type CallingSettingsInput = z.infer<typeof CallingSettingsInputSchema>;

export class CallingSettingsService {
  constructor(private readonly graphApiClient: GraphApiClientPort) {}

  public validateCallingSettings(input: unknown, referenceDateStr?: string): CallingSettingsInput {
    const parseResult = CallingSettingsInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError('INVALID_CALLING_SETTINGS', 'Validasi skema Calling Settings gagal', parseResult.error.format());
    }

    const data = parseResult.data;
    const hours = data.calling.call_hours;

    // Validate weekly operating hours
    const dayCounts = new Map<string, Array<{ open: number; close: number }>>();

    for (const item of hours.weekly_operating_hours) {
      const open = parseInt(item.open_time, 10);
      const close = parseInt(item.close_time, 10);

      if (open >= close) {
        throw new ValidationError('INVALID_OPERATING_HOURS', `open_time (${item.open_time}) harus < close_time (${item.close_time}) pada hari ${item.day_of_week}`);
      }

      const existing = dayCounts.get(item.day_of_week) || [];
      if (existing.length >= 2) {
        throw new ValidationError('EXCEEDED_MAX_ENTRIES_PER_DAY', `Maksimal 2 entri jam operasional per hari (${item.day_of_week})`);
      }

      for (const slot of existing) {
        if (open < slot.close && close > slot.open) {
          throw new ValidationError('OVERLAPPING_OPERATING_HOURS', `Jam operasional tumpang tindih pada hari ${item.day_of_week}`);
        }
      }

      existing.push({ open, close });
      dayCounts.set(item.day_of_week, existing);
    }

    // Validate holiday schedule
    if (hours.holiday_schedule && hours.holiday_schedule.length > 0) {
      const todayStr = referenceDateStr || new Date().toISOString().slice(0, 10);

      for (const hol of hours.holiday_schedule) {
        if (hol.date < todayStr) {
          throw new ValidationError('PAST_HOLIDAY_DATE', `Tanggal libur ${hol.date} tidak boleh di masa lampau (hari ini: ${todayStr})`);
        }
      }
    }

    return data;
  }

  async getSettings(tenant: TenantContext, phoneNumberId: string): Promise<Record<string, unknown>> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan');
    }
    return this.graphApiClient.getSettings({ phoneNumberId });
  }

  async updateSettings(
    tenant: TenantContext,
    phoneNumberId: string,
    rawSettings: unknown
  ): Promise<{ success: boolean }> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan');
    }

    const validated = this.validateCallingSettings(rawSettings);
    return this.graphApiClient.updateSettings({
      phoneNumberId,
      settings: validated as unknown as Record<string, unknown>,
    });
  }
}
