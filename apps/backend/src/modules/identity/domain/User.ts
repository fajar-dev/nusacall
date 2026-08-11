export interface UserProps {
  id: string;
  organizationId: string | null;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  status: string;
  totpSecretEnc?: Buffer | null;
  totpEnabled?: boolean;
  lastLoginAt?: Date | null;
  failedLoginCount?: number;
  lockedUntil?: Date | null;
  locale?: string;
  avatarUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  constructor(private readonly props: UserProps) {}

  get id(): string {
    return this.props.id;
  }

  get organizationId(): string | null {
    return this.props.organizationId;
  }

  get email(): string {
    return this.props.email;
  }

  get role(): string {
    return this.props.role;
  }

  get status(): string {
    return this.props.status;
  }

  toProps(): UserProps {
    return { ...this.props };
  }
}
