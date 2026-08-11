import { describe, it, expect } from 'vitest';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import { OtplibTotpService } from '../src/shared/infrastructure/OtplibTotpService';

describe('E1-T5: TOTP 2FA Service', () => {
  const totpService = new OtplibTotpService();
  const otplibTotp = new TOTP({
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
  });

  it('should generate TOTP setup details with secret, QR code URL, and 10 recovery codes', async () => {
    const setup = await totpService.setupTotp('admin@nusacall.com');

    expect(setup.secret).toBeDefined();
    expect(typeof setup.secret).toBe('string');
    expect(setup.qrCodeUrl).toContain('data:image/png;base64,');
    expect(setup.recoveryCodes).toHaveLength(10);
    expect(setup.recoveryCodes[0]).toHaveLength(10);
  });

  it('should verify valid TOTP token correctly and reject invalid token', async () => {
    const setup = await totpService.setupTotp('admin@nusacall.com');
    const validToken = await otplibTotp.generate({ secret: setup.secret });

    expect(await totpService.verifyTotp(validToken, setup.secret)).toBe(true);
    expect(await totpService.verifyTotp('000000', setup.secret)).toBe(false);
  });

  it('should generate 10 unique single-use recovery codes', () => {
    const codes = totpService.generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    const uniqueSet = new Set(codes);
    expect(uniqueSet.size).toBe(10);
  });
});
