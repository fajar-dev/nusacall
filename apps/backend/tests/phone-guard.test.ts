import { describe, it, expect } from 'vitest';
import { PhoneGuardService } from '../src/modules/meta/application/PhoneGuardService';
import type { WaPhoneNumberSyncRecord } from '../src/modules/meta/application/PhoneSyncService';
import { BusinessRuleError, ForbiddenError } from '../src/shared/errors/AppError';

describe('E2-T8: Phone Guard Service (SIP Status & Meta Restriction Check)', () => {
  const guard = new PhoneGuardService();

  const normalPhone: WaPhoneNumberSyncRecord = {
    id: 'pn_1',
    organizationId: 'org_1',
    phoneNumberId: 'pn_100',
    connectionStatus: 'HEALTHY',
    lastError: null,
    lastSyncedAt: new Date(),
    callingStatus: 'ENABLED',
    callIconVisibility: 'DEFAULT',
    restrictToUserCountries: null,
    callbackPermissionStatus: 'APPROVED',
    callHours: null,
    sipStatus: 'DISABLED',
    restrictions: null,
  };

  it('should allow normal phone number with sipStatus=DISABLED and no restriction', () => {
    expect(() => guard.assertCanUseForCalling(normalPhone)).not.toThrow();
    expect(() => guard.assertCanInitiateOutgoingCall(normalPhone)).not.toThrow();
  });

  it('should throw BusinessRuleError when sipStatus is ENABLED', () => {
    const sipEnabledPhone: WaPhoneNumberSyncRecord = {
      ...normalPhone,
      sipStatus: 'ENABLED',
    };

    expect(() => guard.assertCanUseForCalling(sipEnabledPhone)).toThrow(BusinessRuleError);
    expect(() => guard.assertCanInitiateOutgoingCall(sipEnabledPhone)).toThrow(BusinessRuleError);
  });

  it('should throw ForbiddenError when phone number has active Meta restriction', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 86400; // 1 day in future
    const restrictedPhone: WaPhoneNumberSyncRecord = {
      ...normalPhone,
      restrictions: {
        restrictions_list: [
          {
            type: 'RESTRICTED_BIZ_INITIATED_AND_USER_INITIATED_CALLING',
            reason: 'LOW_CALLING_QUALITY',
            expiration: futureExp,
          },
        ],
      },
    };

    expect(() => guard.assertCanInitiateOutgoingCall(restrictedPhone)).toThrow(ForbiddenError);
  });

  it('should allow outgoing call if restriction expiration is in the past', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const expiredRestrictionPhone: WaPhoneNumberSyncRecord = {
      ...normalPhone,
      restrictions: {
        restrictions_list: [
          {
            type: 'RESTRICTED_BIZ_INITIATED_AND_USER_INITIATED_CALLING',
            reason: 'LOW_CALLING_QUALITY',
            expiration: pastExp,
          },
        ],
      },
    };

    expect(() => guard.assertCanInitiateOutgoingCall(expiredRestrictionPhone)).not.toThrow();
  });
});
