import { describe, it, expect } from 'vitest';
import idLocale from '../app/i18n/locales/id.json';
import enLocale from '../app/i18n/locales/en.json';

describe('E0-T10: Web App Config & i18n', () => {
  it('should have valid Indonesian and English translation keys', () => {
    expect(idLocale.common.appName).toBe('NusaCall');
    expect(idLocale.common.welcome).toBe('Selamat datang di NusaCall');
    expect(enLocale.common.appName).toBe('NusaCall');
    expect(enLocale.common.welcome).toBe('Welcome to NusaCall');
  });
});
