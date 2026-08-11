import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('organizations')
export class OrganizationEntity {
  @PrimaryColumn({ type: 'char', length: 26 })
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 64, default: 'Asia/Jakarta' })
  timezone!: string;

  @Column({ name: 'default_locale', type: 'varchar', length: 8, default: 'id' })
  defaultLocale!: string;

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'recording_policy', type: 'varchar', length: 16, default: 'ALWAYS' })
  recordingPolicy!: string;

  @Column({ name: 'transcription_policy', type: 'varchar', length: 16, default: 'ALWAYS' })
  transcriptionPolicy!: string;

  @Column({ name: 'recording_purpose', type: 'varchar', length: 250, nullable: true })
  recordingPurpose!: string | null;

  @Column({ name: 'announcement_language', type: 'varchar', length: 8, default: 'id' })
  announcementLanguage!: string;

  @Column({ name: 'media_retention_days', type: 'int', default: 365 })
  mediaRetentionDays!: number;

  @Column({ name: 'cpr_daily_limit', type: 'int', default: 1 })
  cprDailyLimit!: number;

  @Column({ name: 'cpr_weekly_limit', type: 'int', default: 2 })
  cprWeeklyLimit!: number;

  @Column({ name: 'ai_summary_enabled', type: 'tinyint', default: 0 })
  aiSummaryEnabled!: number;

  @Column({ type: 'json', nullable: true })
  settings!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
