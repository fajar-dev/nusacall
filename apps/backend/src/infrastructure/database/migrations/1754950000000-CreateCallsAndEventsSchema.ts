import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCallsAndEventsSchema1754950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS calls (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        wa_phone_number_id CHAR(26) NOT NULL,
        contact_id CHAR(26) NULL,
        wacid VARCHAR(128) NULL,
        direction VARCHAR(24) NOT NULL,
        state VARCHAR(24) NOT NULL,
        end_reason VARCHAR(32) NULL,
        from_number VARCHAR(24) NOT NULL,
        to_number VARCHAR(24) NOT NULL,
        queue_id CHAR(26) NULL,
        assigned_agent_id CHAR(26) NULL,
        offer_attempts INT NOT NULL DEFAULT 0,
        cta_payload VARCHAR(512) NULL,
        deeplink_payload VARCHAR(512) NULL,
        entry_point VARCHAR(32) NULL,
        recording_enabled TINYINT(1) NOT NULL DEFAULT 0,
        transcription_enabled TINYINT(1) NOT NULL DEFAULT 0,
        queued_at DATETIME(3) NULL,
        first_offered_at DATETIME(3) NULL,
        pre_accepted_at DATETIME(3) NULL,
        answered_at DATETIME(3) NULL,
        ended_at DATETIME(3) NULL,
        wrap_up_ended_at DATETIME(3) NULL,
        meta_start_time DATETIME(3) NULL,
        meta_end_time DATETIME(3) NULL,
        meta_duration_seconds INT NULL,
        wait_seconds INT NULL,
        talk_seconds INT NULL,
        wrap_up_seconds INT NULL,
        error_code INT NULL,
        error_message VARCHAR(500) NULL,
        billable_pulses INT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_calls_wacid (wacid),
        INDEX idx_calls_org_created (organization_id, created_at),
        INDEX idx_calls_org_state (organization_id, state),
        INDEX idx_calls_org_queue_created (organization_id, queue_id, created_at),
        INDEX idx_calls_org_agent_created (organization_id, assigned_agent_id, created_at),
        INDEX idx_calls_contact_created (contact_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS call_events (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        call_id CHAR(26) NOT NULL,
        sequence INT NOT NULL,
        type VARCHAR(48) NOT NULL,
        actor_type VARCHAR(16) NOT NULL,
        actor_id CHAR(26) NULL,
        payload JSON NULL,
        occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_call_events_seq (call_id, sequence),
        INDEX idx_call_events_org_call (organization_id, call_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS call_recordings (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        call_id CHAR(26) NOT NULL,
        meta_media_id VARCHAR(64) NULL,
        sha256 VARCHAR(64) NULL,
        mime_type VARCHAR(64) NULL,
        storage_key VARCHAR(500) NULL,
        size_bytes BIGINT NULL,
        duration_seconds INT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
        attempts INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        meta_expires_at DATETIME(3) NULL,
        archived_at DATETIME(3) NULL,
        purge_after DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_call_recordings_call (call_id),
        INDEX idx_call_recordings_org (organization_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS call_transcripts (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        call_id CHAR(26) NOT NULL,
        meta_media_id VARCHAR(64) NULL,
        sha256 VARCHAR(64) NULL,
        storage_key VARCHAR(500) NULL,
        language VARCHAR(8) NULL,
        confidence DECIMAL(4,3) NULL,
        duration_seconds DECIMAL(8,2) NULL,
        full_text MEDIUMTEXT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
        attempts INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        meta_expires_at DATETIME(3) NULL,
        archived_at DATETIME(3) NULL,
        purge_after DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_call_transcripts_call (call_id),
        INDEX idx_call_transcripts_org (organization_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS transcript_segments (
        id CHAR(26) NOT NULL,
        organization_id CHAR(26) NOT NULL,
        call_transcript_id CHAR(26) NOT NULL,
        segment_index INT NOT NULL,
        speaker VARCHAR(16) NOT NULL,
        channel TINYINT NULL,
        start_ms INT NOT NULL,
        end_ms INT NOT NULL,
        text TEXT NOT NULL,
        confidence DECIMAL(4,3) NULL,
        words JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_transcript_segments_idx (call_transcript_id, segment_index),
        INDEX idx_transcript_segments_org (organization_id, call_transcript_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS transcript_segments');
    await queryRunner.query('DROP TABLE IF EXISTS call_transcripts');
    await queryRunner.query('DROP TABLE IF EXISTS call_recordings');
    await queryRunner.query('DROP TABLE IF EXISTS call_events');
    await queryRunner.query('DROP TABLE IF EXISTS calls');
  }
}
