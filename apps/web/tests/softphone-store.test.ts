import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSoftphoneStore } from '../app/stores/softphone';

describe('E7-T6: Softphone Pinia Store State Machine', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should transition through inbound call flow: IDLE -> PREPARING -> RINGING_IN -> CONNECTING -> ON_CALL -> WRAP_UP -> IDLE', () => {
    const store = useSoftphoneStore();
    expect(store.currentState).toBe('IDLE');

    // 1. Inbound offer
    store.handleOffer({
      callId: 'call_01',
      fromNumber: '628123456789',
      toNumber: '628987654321',
      direction: 'INBOUND',
      requireDisposition: true,
    });
    expect(store.currentState).toBe('RINGING_IN');
    expect(store.activeCall?.callId).toBe('call_01');

    // 2. Agent answers
    store.answerCall();
    expect(store.currentState).toBe('CONNECTING');

    // 3. call.accepted received
    store.onCallAccepted();
    expect(store.currentState).toBe('ON_CALL');

    // 4. Hangup call with wrap-up required
    store.hangupCall();
    expect(store.currentState).toBe('WRAP_UP');

    // 5. Finish wrap-up
    store.finishWrapUp();
    expect(store.currentState).toBe('IDLE');
    expect(store.activeCall).toBeNull();
  });

  it('should transition through outbound call flow: IDLE -> PREPARING_OUT -> DIALING -> RINGING_OUT -> ON_CALL -> IDLE', () => {
    const store = useSoftphoneStore();

    store.startOutbound('628123456789');
    expect(store.currentState).toBe('DIALING');

    store.onRemoteRinging();
    expect(store.currentState).toBe('RINGING_OUT');

    store.onCallAccepted();
    expect(store.currentState).toBe('ON_CALL');

    store.onCallEnded(false);
    expect(store.currentState).toBe('IDLE');
  });

  it('should handle reject call in RINGING_IN state', () => {
    const store = useSoftphoneStore();
    store.handleOffer({
      callId: 'call_02',
      fromNumber: '628123456789',
      toNumber: '628987654321',
      direction: 'INBOUND',
    });
    expect(store.currentState).toBe('RINGING_IN');

    store.rejectCall();
    expect(store.currentState).toBe('IDLE');
    expect(store.activeCall).toBeNull();
  });

  it('should transition to ERROR state on failure and recover on acknowledgeError', () => {
    const store = useSoftphoneStore();
    store.handleOffer({
      callId: 'call_03',
      fromNumber: '628123456789',
      toNumber: '628987654321',
      direction: 'INBOUND',
    });

    store.setError('MIC_PERMISSION_DENIED');
    expect(store.currentState).toBe('ERROR');
    expect(store.errorMessage).toBe('MIC_PERMISSION_DENIED');

    store.acknowledgeError();
    expect(store.currentState).toBe('IDLE');
    expect(store.errorMessage).toBeNull();
  });
});
