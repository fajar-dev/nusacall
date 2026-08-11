import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenancyAndIdentity1754900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id CHAR(26) NOT NULL,
        name VARCHAR(160) NOT NULL,
        slug VARCHAR(80) NOT NULL,
        timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
        default_locale VARCHAR(8) NOT NULL DEFAULT 'id',
        status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
        recording_policy VARCHAR(16) NOT NULL DEFAULT 'ALWAYS',
        transcription_policy VARCHAR(16) NOT NULL DEFAULT 'ALWAYS',
        recording_purpose VARCHAR(250) NULL,
        announcement_language VARCHAR(8) NOT NULL DEFAULT 'id',
        media_retention_days INT NOT NULL DEFAULT 365,
        cpr_daily_limit INT NOT NULL DEFAULT 1,
        cpr_weekly_limit INT NOT NULL DEFAULT 2,
        ai_summary_enabled TINYINT(1) NOT NULL DEFAULT 0,
        settings JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_organizations_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NULL,
        email VARCHAR(190) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(160) NOT NULL,
        role VARCHAR(32) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
        totp_secret_enc VARBINARY(512) NULL,
        totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
        last_login_at DATETIME(3) NULL,
        failed_login_count INT NOT NULL DEFAULT 0,
        locked_until DATETIME(3) NULL,
        locale VARCHAR(8) NOT NULL DEFAULT 'id',
        avatar_url VARCHAR(500) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_users_org_email (organization_id, email),
        KEY idx_users_role (role),
        KEY idx_users_status (status),
        CONSTRAINT fk_users_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id CHAR(26) NOT NULL,
        user_id CHAR(26) NOT NULL,
        token_hash VARCHAR(128) NOT NULL,
        family_id CHAR(26) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        revoked_at DATETIME(3) NULL,
        replaced_by VARCHAR(128) NULL,
        user_agent VARCHAR(255) NULL,
        ip VARCHAR(45) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_refresh_tokens_token_hash (token_hash),
        KEY idx_refresh_tokens_user_family (user_id, family_id),
        CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NULL,
        user_id CHAR(26) NULL,
        action VARCHAR(80) NOT NULL,
        target_type VARCHAR(80) NULL,
        target_id VARCHAR(64) NULL,
        changes JSON NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_audit_logs_org_created (organization_id, created_at),
        KEY idx_audit_logs_user_created (user_id, created_at),
        CONSTRAINT fk_audit_logs_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE SET NULL,
        CONSTRAINT fk_audit_logs_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
    await queryRunner.query(`DROP TABLE IF EXISTS organizations;`);
  }
}
