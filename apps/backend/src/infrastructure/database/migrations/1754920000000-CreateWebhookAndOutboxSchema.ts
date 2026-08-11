import { type MigrationInterface, type QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateWebhookAndOutboxSchema1754920000000 implements MigrationInterface {
  name = 'CreateWebhookAndOutboxSchema1754920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Table: webhook_events
    await queryRunner.createTable(
      new Table({
        name: 'webhook_events',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '26',
            isPrimary: true,
          },
          {
            name: 'meta_app_id',
            type: 'char',
            length: '26',
            isNullable: false,
          },
          {
            name: 'organization_id',
            type: 'char',
            length: '26',
            isNullable: true,
          },
          {
            name: 'dedupe_key',
            type: 'char',
            length: '64',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'field',
            type: 'varchar',
            length: '48',
            isNullable: false,
          },
          {
            name: 'waba_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'phone_number_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'payload',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'signature_valid',
            type: 'tinyint',
            default: 1,
            isNullable: false,
          },
          {
            name: 'received_at',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)',
            isNullable: false,
          },
          {
            name: 'processed_at',
            type: 'datetime',
            precision: 3,
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '24',
            default: "'PENDING'",
            isNullable: false,
          },
          {
            name: 'attempts',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'last_error',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
      true
    );

    await queryRunner.createIndices('webhook_events', [
      new TableIndex({
        name: 'idx_webhook_events_status_received',
        columnNames: ['status', 'received_at'],
      }),
      new TableIndex({
        name: 'idx_webhook_events_pn_received',
        columnNames: ['phone_number_id', 'received_at'],
      }),
    ]);

    // 2. Table: domain_events (Outbox)
    await queryRunner.createTable(
      new Table({
        name: 'domain_events',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '26',
            isPrimary: true,
          },
          {
            name: 'organization_id',
            type: 'char',
            length: '26',
            isNullable: true,
          },
          {
            name: 'aggregate_type',
            type: 'varchar',
            length: '48',
            isNullable: false,
          },
          {
            name: 'aggregate_id',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'occurred_at',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)',
            isNullable: false,
          },
          {
            name: 'published_at',
            type: 'datetime',
            precision: 3,
            isNullable: true,
          },
          {
            name: 'attempts',
            type: 'int',
            default: 0,
            isNullable: false,
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'domain_events',
      new TableIndex({
        name: 'idx_domain_events_published_occurred',
        columnNames: ['published_at', 'occurred_at'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('domain_events');
    await queryRunner.dropTable('webhook_events');
  }
}
