import { Entity } from '../../../../shared/domain/Entity';
import { ValidationError } from '../../../../shared/errors/AppError';

export interface CallEventProps {
  organizationId: string;
  callId: string;
  sequence: number;
  type: string;
  actorType: 'META' | 'SYSTEM' | 'AGENT' | 'SUPERVISOR';
  actorId?: string | undefined;
  payload?: Record<string, unknown> | undefined;
  occurredAt: Date;
}

export class CallEvent extends Entity<string> {
  private constructor(
    id: string,
    private readonly props: CallEventProps
  ) {
    super(id);
  }

  public static create(id: string, props: CallEventProps): CallEvent {
    if (!id) throw new ValidationError('VALIDATION_ERROR', 'id event wajib diisi');
    if (!props.organizationId) throw new ValidationError('VALIDATION_ERROR', 'organizationId wajib diisi');
    if (!props.callId) throw new ValidationError('VALIDATION_ERROR', 'callId wajib diisi');
    if (props.sequence <= 0) throw new ValidationError('VALIDATION_ERROR', 'sequence harus > 0');
    if (!props.type) throw new ValidationError('VALIDATION_ERROR', 'type event wajib diisi');
    if (!['META', 'SYSTEM', 'AGENT', 'SUPERVISOR'].includes(props.actorType)) {
      throw new ValidationError('VALIDATION_ERROR', 'actorType tidak valid');
    }

    return new CallEvent(id, { ...props });
  }

  public get organizationId(): string { return this.props.organizationId; }
  public get callId(): string { return this.props.callId; }
  public get sequence(): number { return this.props.sequence; }
  public get type(): string { return this.props.type; }
  public get actorType(): string { return this.props.actorType; }
  public get actorId(): string | undefined { return this.props.actorId; }
  public get payload(): Record<string, unknown> | undefined { return this.props.payload; }
  public get occurredAt(): Date { return this.props.occurredAt; }
}
