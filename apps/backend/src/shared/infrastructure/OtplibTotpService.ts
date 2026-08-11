import {
  TOTP,
  generateSecret,
  generateURI,
  NobleCryptoPlugin,
  ScureBase32Plugin,
} from 'otplib';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import type { TotpServicePort, SetupTotpResult } from '../domain/ports/TotpServicePort';

export class OtplibTotpService implements TotpServicePort {
  private readonly totp: TOTP;

  constructor() {
    this.totp = new TOTP({
      crypto: new NobleCryptoPlugin(),
      base32: new ScureBase32Plugin(),
    });
  }

  async setupTotp(userEmail: string): Promise<SetupTotpResult> {
    const secret = generateSecret();
    const otpauth = generateURI({
      label: userEmail,
      issuer: 'NusaCall',
      secret,
    });
    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    const recoveryCodes = this.generateRecoveryCodes();

    return {
      secret,
      qrCodeUrl,
      recoveryCodes,
    };
  }

  async verifyTotp(token: string, secret: string): Promise<boolean> {
    try {
      const result = await this.totp.verify(token, { secret });
      return result.valid;
    } catch {
      return false;
    }
  }

  generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(5).toString('hex').toUpperCase());
    }
    return codes;
  }
}
