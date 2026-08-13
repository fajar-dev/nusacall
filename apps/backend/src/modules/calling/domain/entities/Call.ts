import { Entity } from '../../../../shared/domain/Entity';
import { ValidationError } from '../../../../shared/errors/AppError';
import { CallStateMachine, type CallState } from '../CallStateMachine';
import { CallEvent } from './CallEvent';

export interface CallProps {
  organizationId: string;
  waPhoneNumberId: string;
  contactId?: string | undefined;
  wacid?: string | undefined;
  direction: 'INBOUND' | 'OUTBOUND';
  state: CallState;
  endReason?: string | undefined;
  fromNumber: string;
  toNumber: string;
  queueId?: string | undefined;
  assignedAgentId?: string | undefined;
  offerAttempts?: number | undefined;
  ctaPayload?: string | undefined;
  deeplinkPayload?: string | undefined;
  entryPoint?: string | undefined;
  recordingEnabled?: boolean | undefined;
  transcriptionEnabled?: boolean | undefined;

  queuedAt?: Date | undefined;
  firstOfferedAt?: Date | undefined;
  preAcceptedAt?: Date | undefined;
  answeredAt?: Date | undefined;
  endedAt?: Date | undefined;
  wrapUpEndedAt?: Date | undefined;
  metaStartTime?: Date | undefined;
  metaEndTime?: Date | undefined;
  metaDurationSeconds?: number | undefined;
  waitSeconds?: number | undefined;
  talkSeconds?: number | undefined;
  wrapUpSeconds?: number | undefined;
  errorCode?: number | undefined;
  errorMessage?: string | undefined;
  billablePulses?: number | undefined;

  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export class Call extends Entity<string> {
  private props: CallProps;
  private _events: CallEvent[] = [];
  private _currentSequence = 1;

  private constructor(id: string, props: CallProps) {
    super(id);
    this.props = {
      ...props,
      offerAttempts: props.offerAttempts ?? 0,
      recordingEnabled: props.recordingEnabled ?? false,
      transcriptionEnabled: props.transcriptionEnabled ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };
  }

  public static create(id: string, props: CallProps): Call {
    if (!id) throw new ValidationError('VALIDATION_ERROR', 'Call id wajib diisi');
    if (!props.organizationId) throw new ValidationError('VALIDATION_ERROR', 'organizationId wajib diisi');
    if (!props.waPhoneNumberId) throw new ValidationError('VALIDATION_ERROR', 'waPhoneNumberId wajib diisi');
    if (!['INBOUND', 'OUTBOUND'].includes(props.direction)) {
      throw new ValidationError('VALIDATION_ERROR', 'direction harus INBOUND atau OUTBOUND');
    }
    if (!props.fromNumber) throw new ValidationError('VALIDATION_ERROR', 'fromNumber wajib diisi');
    if (!props.toNumber) throw new ValidationError('VALIDATION_ERROR', 'toNumber wajib diisi');

    return new Call(id, props);
  }

  public transitionTo(nextState: CallState): void {
    const newState = CallStateMachine.transition(this.props.state, nextState);
    this.props.state = newState;
    this.props.updatedAt = new Date();
  }

  public appendEvent(
    eventId: string,
    type: string,
    actorType: 'META' | 'SYSTEM' | 'AGENT' | 'SUPERVISOR',
    actorId?: string,
    payload?: Record<string, unknown>,
    occurredAt: Date = new Date()
  ): CallEvent {
    const event = CallEvent.create(eventId, {
      organizationId: this.props.organizationId,
      callId: this.id,
      sequence: this._currentSequence++,
      type,
      actorType,
      ...(actorId ? { actorId } : {}),
      ...(payload ? { payload } : {}),
      occurredAt,
    });
    this._events.push(event);
    return event;
  }

  // Getters & Setters
  public get organizationId(): string { return this.props.organizationId; }
  public get waPhoneNumberId(): string { return this.props.waPhoneNumberId; }
  public get contactId(): string | undefined { return this.props.contactId; }
  public get wacid(): string | undefined { return this.props.wacid; }
  public get direction(): 'INBOUND' | 'OUTBOUND' { return this.props.direction; }
  public get state(): CallState { return this.props.state; }
  public get endReason(): string | undefined { return this.props.endReason; }
  public get fromNumber(): string { return this.props.fromNumber; }
  public get toNumber(): string { return this.props.toNumber; }
  public get queueId(): string | undefined { return this.props.queueId; }
  public get assignedAgentId(): string | undefined { return this.props.assignedAgentId; }
  public get offerAttempts(): number { return this.props.offerAttempts ?? 0; }
  public get ctaPayload(): string | undefined { return this.props.ctaPayload; }
  public get deeplinkPayload(): string | undefined { return this.props.deeplinkPayload; }
  public get entryPoint(): string | undefined { return this.props.entryPoint; }
  public get recordingEnabled(): boolean { return this.props.recordingEnabled ?? false; }
  public get transcriptionEnabled(): boolean { return this.props.transcriptionEnabled ?? false; }

  public get queuedAt(): Date | undefined { return this.props.queuedAt; }
  public get firstOfferedAt(): Date | undefined { return this.props.firstOfferedAt; }
  public get preAcceptedAt(): Date | undefined { return this.props.preAcceptedAt; }
  public get answeredAt(): Date | undefined { return this.props.answeredAt; }
  public get endedAt(): Date | undefined { return this.props.endedAt; }
  public get wrapUpEndedAt(): Date | undefined { return this.props.wrapUpEndedAt; }
  public get events(): readonly CallEvent[] { return this._events; }

  public setWacid(wacid: string): void { this.props.wacid = wacid; }
  public setContactId(contactId: string): void { this.props.contactId = contactId; }
  public setQueueId(queueId: string): void { this.props.queueId = queueId; }
  public setAssignedAgentId(agentId: string): void { this.props.assignedAgentId = agentId; }
  public setEndReason(reason: string): void { this.props.endReason = reason; }
  public incrementOfferAttempts(): void { this.props.offerAttempts = (this.props.offerAttempts ?? 0) + 1; }

  public setFirstOfferedAt(date: Date): void { this.props.firstOfferedAt = date; }
  public setAnsweredAt(date: Date): void { this.props.answeredAt = date; }
  public setEndedAt(date: Date): void { this.props.endedAt = date; }
  public setMetaTiming(startTime?: Date, endTime?: Date, durationSeconds?: number): void {
    if (startTime) this.props.metaStartTime = startTime;
    if (endTime) this.props.metaEndTime = endTime;
    if (durationSeconds !== undefined) {
      this.props.metaDurationSeconds = durationSeconds;
      this.props.talkSeconds = durationSeconds;
    }
  }
  public setBillablePulses(pulses: number): void { this.props.billablePulses = pulses; }
  public setError(code: number, message: string): void {
    this.props.errorCode = code;
    this.props.errorMessage = message;
  }
}
