import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMetaAndWabaSchema1754910000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`meta_apps\` (
        \`id\` CHAR(26) NOT NULL,
        \`organization_id\` CHAR(26) NOT NULL,
        \`name\` VARCHAR(120) NOT NULL,
        \`meta_app_id\` VARCHAR(64) NOT NULL,
        \`app_secret_enc\` VARBINARY(1024) NOT NULL,
        \`webhook_verify_token_enc\` VARBINARY(1024) NOT NULL,
        \`graph_api_version\` VARCHAR(12) NOT NULL DEFAULT 'v23.0',
        \`status\` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uk_meta_apps_meta_app_id\` (\`meta_app_id\`),
        INDEX \`idx_meta_apps_org_id\` (\`organization_id\`),
        CONSTRAINT \`fk_meta_apps_organization\` FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE \`whatsapp_business_accounts\` (
        \`id\` CHAR(26) NOT NULL,
        \`organization_id\` CHAR(26) NOT NULL,
        \`meta_app_id\` CHAR(26) NOT NULL,
        \`waba_id\` VARCHAR(64) NOT NULL,
        \`name\` VARCHAR(120) NOT NULL,
        \`status\` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
        \`last_synced_at\` DATETIME(3) NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uk_waba_waba_id\` (\`waba_id\`),
        INDEX \`idx_waba_org_id\` (\`organization_id\`),
        INDEX \`idx_waba_meta_app_id\` (\`meta_app_id\`),
        CONSTRAINT \`fk_waba_organization\` FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_waba_meta_app\` FOREIGN KEY (\`meta_app_id\`) REFERENCES \`meta_apps\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE \`wa_phone_numbers\` (
        \`id\` CHAR(26) NOT NULL,
        \`organization_id\` CHAR(26) NOT NULL,
        \`waba_id\` CHAR(26) NOT NULL,
        \`phone_number_id\` VARCHAR(64) NOT NULL,
        \`display_phone_number\` VARCHAR(24) NOT NULL,
        \`verified_name\` VARCHAR(160) NOT NULL,
        \`access_token_enc\` VARBINARY(4096) NOT NULL,
        \`token_expires_at\` DATETIME(3) NULL,
        \`calling_status\` VARCHAR(16) NOT NULL DEFAULT 'ENABLED',
        \`call_icon_visibility\` VARCHAR(16) NOT NULL DEFAULT 'DEFAULT',
        \`restrict_to_user_countries\` JSON NULL,
        \`callback_permission_status\` VARCHAR(16) NOT NULL DEFAULT 'APPROVED',
        \`call_hours\` JSON NULL,
        \`sip_status\` VARCHAR(16) NOT NULL DEFAULT 'DISABLED',
        \`restrictions\` JSON NULL,
        \`restricted_until\` DATETIME(3) NULL,
        \`connection_status\` VARCHAR(16) NOT NULL DEFAULT 'HEALTHY',
        \`last_error\` TEXT NULL,
        \`last_synced_at\` DATETIME(3) NULL,
        \`is_test_number\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uk_pn_phone_number_id\` (\`phone_number_id\`),
        INDEX \`idx_pn_org_id\` (\`organization_id\`),
        INDEX \`idx_pn_waba_id\` (\`waba_id\`),
        CONSTRAINT \`fk_pn_organization\` FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_pn_waba\` FOREIGN KEY (\`waba_id\`) REFERENCES \`whatsapp_business_accounts\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`wa_phone_numbers\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`whatsapp_business_accounts\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`meta_apps\`;`);
  }
}
