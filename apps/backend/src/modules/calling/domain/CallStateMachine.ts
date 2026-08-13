import { IllegalStateError } from '../../../shared/errors/AppError';

export type CallState =
  | 'INITIATED'
  | 'QUEUED'
  | 'RINGING'
  | 'PRE_ACCEPTED'
  | 'ACCEPTED'
  | 'WRAP_UP'
  | 'ENDED'
  | 'FAILED'
  | 'REJECTED'
  | 'ABANDONED'
  | 'OVERFLOW'
  | 'STALE';

const LEGAL_TRANSITIONS: Record<CallState, CallState[]> = {
  INITIATED: ['QUEUED', 'RINGING', 'FAILED', 'ABANDONED', 'STALE'],
  QUEUED: ['RINGING', 'PRE_ACCEPTED', 'ACCEPTED', 'REJECTED', 'ABANDONED', 'OVERFLOW', 'STALE', 'FAILED'],
  RINGING: ['PRE_ACCEPTED', 'ACCEPTED', 'REJECTED', 'ABANDONED', 'STALE', 'FAILED'],
  PRE_ACCEPTED: ['ACCEPTED', 'ENDED', 'REJECTED', 'FAILED'],
  ACCEPTED: ['WRAP_UP', 'ENDED', 'FAILED'],
  WRAP_UP: ['ENDED', 'FAILED'],
  ENDED: [],
  FAILED: [],
  REJECTED: [],
  ABANDONED: [],
  OVERFLOW: [],
  STALE: [],
};

export class CallStateMachine {
  public static canTransition(from: CallState, to: CallState): boolean {
    if (from === to) return true;
    const allowed = LEGAL_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  public static transition(currentState: CallState, nextState: CallState): CallState {
    if (currentState === nextState) {
      return currentState;
    }
    if (!this.canTransition(currentState, nextState)) {
      throw new IllegalStateError(
        'ILLEGAL_STATE_TRANSITION',
        `Transisi state dari ${currentState} ke ${nextState} tidak diizinkan`
      );
    }
    return nextState;
  }

  public static isTerminal(state: CallState): boolean {
    return LEGAL_TRANSITIONS[state].length === 0;
  }
}
