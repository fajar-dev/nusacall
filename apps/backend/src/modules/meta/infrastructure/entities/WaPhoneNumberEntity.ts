import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('wa_phone_numbers')
export class WaPhoneNumberEntity {
  @PrimaryColumn({ type: 'char', length: 26 })
  id!: string;

  @Column({ name: 'organization_id', type: 'char', length: 26 })
  organizationId!: string;

  @Column({ name: 'waba_id', type: 'char', length: 26 })
  wabaId!: string;

  @Column({ name: 'phone_number_id', type: 'varchar', length: 64, unique: true })
  phoneNumberId!: string;

  @Column({ name: 'display_phone_number', type: 'varchar', length: 24 })
  displayPhoneNumber!: string;

  @Column({ name: 'verified_name', type: 'varchar', length: 160 })
  verifiedName!: string;

  @Column({ name: 'access_token_enc', type: 'varbinary', length: 4096 })
  accessTokenEnc!: Buffer;

  @Column({ name: 'token_expires_at', type: 'datetime', precision: 3, nullable: true })
  tokenExpiresAt!: Date | null;

  @Column({ name: 'calling_status', type: 'varchar', length: 16, default: 'ENABLED' })
  callingStatus!: string;

  @Column({ name: 'call_icon_visibility', type: 'varchar', length: 16, default: 'DEFAULT' })
  callIconVisibility!: string;

  @Column({ name: 'restrict_to_user_countries', type: 'json', nullable: true })
  restrictToUserCountries!: string[] | null;

  @Column({ name: 'callback_permission_status', type: 'varchar', length: 16, default: 'APPROVED' })
  callbackPermissionStatus!: string;

  @Column({ name: 'call_hours', type: 'json', nullable: true })
  callHours!: Record<string, unknown> | null;

  @Column({ name: 'sip_status', type: 'varchar', length: 16, default: 'DISABLED' })
  sipStatus!: string;

  @Column({ type: 'json', nullable: true })
  restrictions!: Record<string, unknown> | null;

  @Column({ name: 'restricted_until', type: 'datetime', precision: 3, nullable: true })
  restrictedUntil!: Date | null;

  @Column({ name: 'connection_status', type: 'varchar', length: 16, default: 'HEALTHY' })
  connectionStatus!: string;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'last_synced_at', type: 'datetime', precision: 3, nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ name: 'is_test_number', type: 'tinyint', default: 0 })
  isTestNumber!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
