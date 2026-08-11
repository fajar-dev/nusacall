export interface SetupTotpResult {
  secret: string;
  qrCodeUrl: string;
  recoveryCodes: string[];
}

export interface TotpServicePort {
  setupTotp(userEmail: string): Promise<SetupTotpResult>;
  verifyTotp(token: string, secret: string): Promise<boolean>;
  generateRecoveryCodes(): string[];
}
