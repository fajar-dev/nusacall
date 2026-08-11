import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'char', length: 26 })
  id!: string;

  @Column({ name: 'organization_id', type: 'char', length: 26, nullable: true })
  organizationId!: string | null;

  @Column({ type: 'varchar', length: 190 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 160 })
  fullName!: string;

  @Column({ type: 'varchar', length: 32 })
  role!: string;

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'totp_secret_enc', type: 'varbinary', length: 512, nullable: true })
  totpSecretEnc!: Buffer | null;

  @Column({ name: 'totp_enabled', type: 'tinyint', default: 0 })
  totpEnabled!: number;

  @Column({ name: 'last_login_at', type: 'datetime', precision: 3, nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'failed_login_count', type: 'int', default: 0 })
  failedLoginCount!: number;

  @Column({ name: 'locked_until', type: 'datetime', precision: 3, nullable: true })
  lockedUntil!: Date | null;

  @Column({ type: 'varchar', length: 8, default: 'id' })
  locale!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
