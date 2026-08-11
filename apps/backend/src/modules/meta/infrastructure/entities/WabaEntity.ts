import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('whatsapp_business_accounts')
export class WabaEntity {
  @PrimaryColumn({ type: 'char', length: 26 })
  id!: string;

  @Column({ name: 'organization_id', type: 'char', length: 26 })
  organizationId!: string;

  @Column({ name: 'meta_app_id', type: 'char', length: 26 })
  metaAppId!: string;

  @Column({ name: 'waba_id', type: 'varchar', length: 64, unique: true })
  wabaId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'last_synced_at', type: 'datetime', precision: 3, nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
