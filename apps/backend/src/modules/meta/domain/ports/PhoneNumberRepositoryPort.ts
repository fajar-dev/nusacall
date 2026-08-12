export interface PhoneNumberRecord {
  id: string;
  organizationId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  status: string;
}

export interface PhoneNumberRepositoryPort {
  findByPhoneNumberId(phoneNumberId: string): Promise<PhoneNumberRecord | null>;
  updateStatus(phoneNumberId: string, status: string): Promise<void>;
}
