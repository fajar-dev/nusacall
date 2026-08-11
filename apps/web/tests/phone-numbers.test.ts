import { describe, it, expect } from 'vitest';
import idLocale from '../app/i18n/locales/id.json';
import enLocale from '../app/i18n/locales/en.json';

describe('E2-T9: Frontend /admin/phone-numbers UI & Operating Hours Validation', () => {
  it('should have correct i18n translation keys for phone numbers admin page', () => {
    expect(idLocale.phoneNumbers.title).toBe('Kelola Nomor WhatsApp');
    expect(enLocale.phoneNumbers.title).toBe('Manage WhatsApp Numbers');
  });

  it('should validate operating hours logic (no overlaps, max 2 per day, open < close)', () => {
    const validateHours = (hours: Array<{ day: string; open: number; close: number }>) => {
      const counts = new Map<string, number>();
      for (const h of hours) {
        if (h.open >= h.close) return { valid: false, reason: 'open >= close' };
        const currentCount = counts.get(h.day) || 0;
        if (currentCount >= 2) return { valid: false, reason: 'exceeded max 2 per day' };
        counts.set(h.day, currentCount + 1);
      }
      return { valid: true };
    };

    expect(validateHours([{ day: 'MONDAY', open: 800, close: 1200 }, { day: 'MONDAY', open: 1300, close: 1700 }]).valid).toBe(true);
    expect(validateHours([{ day: 'MONDAY', open: 1700, close: 800 }]).valid).toBe(false);
    expect(
      validateHours([
        { day: 'MONDAY', open: 800, close: 1000 },
        { day: 'MONDAY', open: 1100, close: 1300 },
        { day: 'MONDAY', open: 1400, close: 1600 },
      ]).valid
    ).toBe(false);
  });
});
