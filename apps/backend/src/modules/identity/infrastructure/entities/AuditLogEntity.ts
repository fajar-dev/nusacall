import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId!: string | null;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'json', nullable: true })
  details!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
