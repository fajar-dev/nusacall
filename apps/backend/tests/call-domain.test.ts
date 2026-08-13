import { describe, it, expect } from 'vitest';
import { CallStateMachine, type CallState } from '../src/modules/calling/domain/CallStateMachine';
import { Call } from '../src/modules/calling/domain/entities/Call';
import { IllegalStateError, ValidationError } from '../src/shared/errors/AppError';

describe('E6-T2: Call Domain Entity, CallEvent, and CallStateMachine', () => {
  describe('CallStateMachine Legal & Illegal Transitions Table', () => {
    it('should correctly validate legal transitions', () => {
      expect(CallStateMachine.canTransition('INITIATED', 'QUEUED')).toBe(true);
      expect(CallStateMachine.canTransition('QUEUED', 'RINGING')).toBe(true);
      expect(CallStateMachine.canTransition('QUEUED', 'PRE_ACCEPTED')).toBe(true);
      expect(CallStateMachine.canTransition('RINGING', 'PRE_ACCEPTED')).toBe(true);
      expect(CallStateMachine.canTransition('PRE_ACCEPTED', 'ACCEPTED')).toBe(true);
      expect(CallStateMachine.canTransition('ACCEPTED', 'WRAP_UP')).toBe(true);
      expect(CallStateMachine.canTransition('ACCEPTED', 'ENDED')).toBe(true);
      expect(CallStateMachine.canTransition('WRAP_UP', 'ENDED')).toBe(true);
    });

    it('should throw IllegalStateError for illegal transitions', () => {
      expect(() => CallStateMachine.transition('ENDED', 'ACCEPTED')).toThrow(IllegalStateError);
      expect(() => CallStateMachine.transition('FAILED', 'QUEUED')).toThrow(IllegalStateError);
      expect(() => CallStateMachine.transition('REJECTED', 'PRE_ACCEPTED')).toThrow(IllegalStateError);
      expect(() => CallStateMachine.transition('ABANDONED', 'RINGING')).toThrow(IllegalStateError);
      expect(() => CallStateMachine.transition('WRAP_UP', 'PRE_ACCEPTED')).toThrow(IllegalStateError);
    });

    it('should identify terminal states correctly', () => {
      const terminalStates: CallState[] = ['ENDED', 'FAILED', 'REJECTED', 'ABANDONED', 'OVERFLOW', 'STALE'];
      for (const st of terminalStates) {
        expect(CallStateMachine.isTerminal(st)).toBe(true);
      }
      expect(CallStateMachine.isTerminal('QUEUED')).toBe(false);
      expect(CallStateMachine.isTerminal('ACCEPTED')).toBe(false);
    });

    it('should allow self-transitions without state change', () => {
      expect(CallStateMachine.transition('QUEUED', 'QUEUED')).toBe('QUEUED');
      expect(CallStateMachine.transition('ACCEPTED', 'ACCEPTED')).toBe('ACCEPTED');
    });
  });

  describe('Call Entity & CallEvent Append-only Sequence', () => {
    it('should create a valid Call entity and append events with auto-incrementing sequence', () => {
      const call = Call.create('call_01J8', {
        organizationId: 'org_01',
        waPhoneNumberId: 'pn_01',
        direction: 'INBOUND',
        state: 'QUEUED',
        fromNumber: '628123456789',
        toNumber: '628987654321',
      });

      expect(call.id).toBe('call_01J8');
      expect(call.state).toBe('QUEUED');
      expect(call.events.length).toBe(0);

      const ev1 = call.appendEvent('evt_1', 'WEBHOOK_CONNECT', 'META', undefined, { sdp: 'v=0...' });
      expect(ev1.sequence).toBe(1);
      expect(ev1.type).toBe('WEBHOOK_CONNECT');
      expect(ev1.actorType).toBe('META');

      call.transitionTo('RINGING');
      expect(call.state).toBe('RINGING');

      const ev2 = call.appendEvent('evt_2', 'AGENT_OFFERED', 'SYSTEM', 'usr_01');
      expect(ev2.sequence).toBe(2);
      expect(call.events.length).toBe(2);
    });

    it('should throw ValidationError when creating Call with invalid parameters', () => {
      expect(() =>
        Call.create('', {
          organizationId: 'org_01',
          waPhoneNumberId: 'pn_01',
          direction: 'INBOUND',
          state: 'QUEUED',
          fromNumber: '628123456789',
          toNumber: '628987654321',
        })
      ).toThrow(ValidationError);

      expect(() =>
        Call.create('call_01', {
          organizationId: '',
          waPhoneNumberId: 'pn_01',
          direction: 'INBOUND',
          state: 'QUEUED',
          fromNumber: '628123456789',
          toNumber: '628987654321',
        })
      ).toThrow(ValidationError);
    });
  });
});
