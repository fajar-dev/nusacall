import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('meta_apps')
export class MetaAppEntity {
  @PrimaryColumn({ type: 'char', length: 26 })
  id!: string;

  @Column({ name: 'organization_id', type: 'char', length: 26 })
  organizationId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'meta_app_id', type: 'varchar', length: 64, unique: true })
  metaAppId!: string;

  @Column({ name: 'app_secret_enc', type: 'varbinary', length: 1024 })
  appSecretEnc!: Buffer;

  @Column({ name: 'webhook_verify_token_enc', type: 'varbinary', length: 1024 })
  webhookVerifyTokenEnc!: Buffer;

  @Column({ name: 'graph_api_version', type: 'varchar', length: 12, default: 'v23.0' })
  graphApiVersion!: string;

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
