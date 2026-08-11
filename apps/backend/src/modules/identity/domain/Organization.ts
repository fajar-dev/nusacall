export interface OrganizationProps {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  defaultLocale: string;
  status: string;
  recordingPolicy: string;
  transcriptionPolicy: string;
  recordingPurpose: string | null;
  announcementLanguage: string;
  mediaRetentionDays: number;
  cprDailyLimit: number;
  cprWeeklyLimit: number;
  aiSummaryEnabled: boolean;
  settings: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Organization {
  constructor(private readonly props: OrganizationProps) {}

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get status(): string {
    return this.props.status;
  }

  toProps(): OrganizationProps {
    return { ...this.props };
  }
}
