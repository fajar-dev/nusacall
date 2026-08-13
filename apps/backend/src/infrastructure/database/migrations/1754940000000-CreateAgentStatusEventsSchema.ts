import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentStatusEventsSchema1754940000000 implements MigrationInterface {
  name = 'CreateAgentStatusEventsSchema1754940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE agent_status_events (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        user_id CHAR(26) NOT NULL,
        status VARCHAR(32) NOT NULL,
        reason VARCHAR(255) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_ase_org_user (organization_id, user_id, created_at),
        CONSTRAINT fk_ase_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_ase_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS agent_status_events;`);
  }
}
