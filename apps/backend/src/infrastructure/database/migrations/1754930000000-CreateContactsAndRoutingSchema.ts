import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContactsAndRoutingSchema1754930000000 implements MigrationInterface {
  name = 'CreateContactsAndRoutingSchema1754930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE contacts (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        wa_id VARCHAR(32) NOT NULL,
        phone_number VARCHAR(32) NOT NULL,
        name VARCHAR(120) NULL,
        custom_attributes JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY idx_contacts_org_wa (organization_id, wa_id),
        INDEX idx_contacts_org_phone (organization_id, phone_number),
        CONSTRAINT fk_contacts_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE skills (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        name VARCHAR(64) NOT NULL,
        description VARCHAR(255) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY idx_skills_org_name (organization_id, name),
        CONSTRAINT fk_skills_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE queues (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        name VARCHAR(64) NOT NULL,
        description VARCHAR(255) NULL,
        strategy VARCHAR(32) NOT NULL DEFAULT 'ROUND_ROBIN',
        timeout_seconds INT NOT NULL DEFAULT 300,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY idx_queues_org_name (organization_id, name),
        CONSTRAINT fk_queues_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE queue_skills (
        queue_id CHAR(26) NOT NULL,
        skill_id CHAR(26) NOT NULL,
        PRIMARY KEY (queue_id, skill_id),
        CONSTRAINT fk_qs_queue FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE,
        CONSTRAINT fk_qs_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE agent_queues (
        user_id CHAR(26) NOT NULL,
        queue_id CHAR(26) NOT NULL,
        PRIMARY KEY (user_id, queue_id),
        CONSTRAINT fk_aq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_aq_queue FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE agent_skills (
        user_id CHAR(26) NOT NULL,
        skill_id CHAR(26) NOT NULL,
        proficiency_level INT NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, skill_id),
        CONSTRAINT fk_as_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_as_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE entry_point_payloads (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        phone_number_id CHAR(26) NOT NULL,
        payload VARCHAR(128) NOT NULL,
        target_queue_id CHAR(26) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY idx_epp_org_phone_payload (organization_id, phone_number_id, payload),
        CONSTRAINT fk_epp_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_epp_phone FOREIGN KEY (phone_number_id) REFERENCES wa_phone_numbers(id) ON DELETE CASCADE,
        CONSTRAINT fk_epp_queue FOREIGN KEY (target_queue_id) REFERENCES queues(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE routing_rules (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        priority INT NOT NULL DEFAULT 100,
        match_field VARCHAR(64) NOT NULL,
        match_operator VARCHAR(32) NOT NULL,
        match_value TEXT NOT NULL,
        target_queue_id CHAR(26) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_rr_org_priority (organization_id, priority),
        CONSTRAINT fk_rr_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_rr_queue FOREIGN KEY (target_queue_id) REFERENCES queues(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS routing_rules;`);
    await queryRunner.query(`DROP TABLE IF EXISTS entry_point_payloads;`);
    await queryRunner.query(`DROP TABLE IF EXISTS agent_skills;`);
    await queryRunner.query(`DROP TABLE IF EXISTS agent_queues;`);
    await queryRunner.query(`DROP TABLE IF EXISTS queue_skills;`);
    await queryRunner.query(`DROP TABLE IF EXISTS queues;`);
    await queryRunner.query(`DROP TABLE IF EXISTS skills;`);
    await queryRunner.query(`DROP TABLE IF EXISTS contacts;`);
  }
}
