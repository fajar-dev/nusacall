import { defineStore } from 'pinia';
import { ref } from 'vue';

export type SoftphoneState =
  | 'IDLE'
  | 'PREPARING'
  | 'RINGING_IN'
  | 'PREPARING_OUT'
  | 'DIALING'
  | 'RINGING_OUT'
  | 'CONNECTING'
  | 'ON_CALL'
  | 'WRAP_UP'
  | 'ERROR';

export interface ActiveCallContext {
  callId: string;
  wacid?: string;
  fromNumber: string;
  toNumber: string;
  direction: 'INBOUND' | 'OUTBOUND';
  contactName?: string;
  sdpOffer?: string;
  requireDisposition?: boolean;
}

export const useSoftphoneStore = defineStore('softphone', () => {
  const currentState = ref<SoftphoneState>('IDLE');
  const activeCall = ref<ActiveCallContext | null>(null);
  const errorMessage = ref<string | null>(null);
  const isMuted = ref(false);
  const isOnHold = ref(false);

  function transitionTo(nextState: SoftphoneState) {
    currentState.value = nextState;
  }

  function handleOffer(callContext: ActiveCallContext) {
    if (currentState.value !== 'IDLE') return;
    activeCall.value = callContext;
    transitionTo('PREPARING');
    // Transition to RINGING_IN after preparation
    transitionTo('RINGING_IN');
  }

  function answerCall() {
    if (currentState.value !== 'RINGING_IN') return;
    transitionTo('CONNECTING');
  }

  function onCallAccepted() {
    if (currentState.value === 'CONNECTING' || currentState.value === 'RINGING_OUT') {
      transitionTo('ON_CALL');
    }
  }

  function rejectCall() {
    if (currentState.value === 'RINGING_IN') {
      activeCall.value = null;
      transitionTo('IDLE');
    }
  }

  function startOutbound(to: string) {
    if (currentState.value !== 'IDLE') return;
    activeCall.value = {
      callId: '',
      fromNumber: 'ME',
      toNumber: to,
      direction: 'OUTBOUND',
    };
    transitionTo('PREPARING_OUT');
    transitionTo('DIALING');
  }

  function onRemoteRinging() {
    if (currentState.value === 'DIALING') {
      transitionTo('RINGING_OUT');
    }
  }

  function hangupCall() {
    if (currentState.value === 'ON_CALL' || currentState.value === 'CONNECTING') {
      if (activeCall.value?.requireDisposition) {
        transitionTo('WRAP_UP');
      } else {
        activeCall.value = null;
        transitionTo('IDLE');
      }
    }
  }

  function onCallEnded(requireDisposition = false) {
    if (requireDisposition) {
      transitionTo('WRAP_UP');
    } else {
      activeCall.value = null;
      transitionTo('IDLE');
    }
  }

  function finishWrapUp() {
    if (currentState.value === 'WRAP_UP') {
      activeCall.value = null;
      transitionTo('IDLE');
    }
  }

  function setError(message: string) {
    errorMessage.value = message;
    transitionTo('ERROR');
  }

  function acknowledgeError() {
    errorMessage.value = null;
    activeCall.value = null;
    transitionTo('IDLE');
  }

  function toggleMute() {
    isMuted.value = !isMuted.value;
  }

  function toggleHold() {
    isOnHold.value = !isOnHold.value;
  }

  return {
    currentState,
    activeCall,
    errorMessage,
    isMuted,
    isOnHold,
    handleOffer,
    answerCall,
    onCallAccepted,
    rejectCall,
    startOutbound,
    onRemoteRinging,
    hangupCall,
    onCallEnded,
    finishWrapUp,
    setError,
    acknowledgeError,
    toggleMute,
    toggleHold,
  };
});
