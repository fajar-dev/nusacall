import type { WaPhoneNumberSyncRecord } from './PhoneSyncService';
import { BusinessRuleError, ForbiddenError } from '../../../shared/errors/AppError';

export class PhoneGuardService {
  public assertCanUseForCalling(phoneNumber: WaPhoneNumberSyncRecord): void {
    if (phoneNumber.sipStatus === 'ENABLED') {
      throw new BusinessRuleError(
        'SIP_ENABLED_NOT_ALLOWED',
        'Nomor dengan SIP aktif tidak dapat digunakan untuk NusaCall WebRTC'
      );
    }
  }

  public assertCanInitiateOutgoingCall(phoneNumber: WaPhoneNumberSyncRecord): void {
    this.assertCanUseForCalling(phoneNumber);

    if (phoneNumber.restrictions) {
      const restrictionsList = (phoneNumber.restrictions as Record<string, unknown>)
        ?.restrictions_list as Array<Record<string, unknown>> | undefined;

      if (Array.isArray(restrictionsList) && restrictionsList.length > 0) {
        const nowSec = Math.floor(Date.now() / 1000);
        const hasActiveRestriction = restrictionsList.some((r) => {
          const exp = typeof r.expiration === 'number' ? r.expiration : 0;
          return exp === 0 || exp > nowSec;
        });

        if (hasActiveRestriction) {
          throw new ForbiddenError(
            'PHONE_NUMBER_RESTRICTED',
            'Nomor telepon sedang dikenai pembatasan/pembekuan oleh Meta (Restriction Active)'
          );
        }
      }
    }
  }
}
