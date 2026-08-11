# 04 — Data Model

Database: **MySQL 8.0**, charset `utf8mb4`, collation `utf8mb4_0900_ai_ci`, engine InnoDB.
ORM: **TypeORM 0.3.x**, `synchronize: false` (WAJIB), seluruh perubahan lewat migration.

---

## 1. Konvensi

| Aspek | Aturan |
|---|---|
| Nama tabel | `snake_case`, jamak (`calls`, `agent_profiles`) |
| Nama kolom | `snake_case` |
| Primary key | `id` CHAR(26) berisi **ULID** (terurut waktu, ramah index) |
| Foreign key | `<entitas>_id` |
| Timestamp | `created_at`, `updated_at` (`DATETIME(3)`), `deleted_at` untuk soft delete bila diperlukan |
| Enum | Kolom `VARCHAR` + constraint di level aplikasi (bukan MySQL ENUM) agar mudah dievolusi |
| Uang/durasi | Integer (detik / satuan terkecil) |
| JSON | Tipe `JSON` MySQL |
| Boolean | `TINYINT(1)` |
| Zona waktu | Semua timestamp disimpan **UTC** |

---

## 2. ERD (ringkas)

```
organizations ──┬── users ──── agent_profiles ──── agent_skills ──── skills
                │                   │
                │                   └── agent_status_events
                ├── meta_apps ── whatsapp_business_accounts ── wa_phone_numbers
                │                                                    │
                ├── queues ── queue_skills                           │
                │      └── routing_rules ◄────────────────────────────┘
                ├── contacts ──┬── call_permissions
                │              ├── call_permission_requests
                │              └── callbacks
                ├── calls ──┬── call_events
                │           ├── call_recordings
                │           ├── call_transcripts ── transcript_segments
                │           ├── call_dispositions ── dispositions
                │           ├── call_quality_samples
                │           └── call_summaries
                ├── entry_point_payloads
                ├── message_templates
                ├── webhook_events
                ├── domain_events (outbox)
                ├── notifications
                ├── daily_call_stats
                └── audit_logs
```

---

## 3. Isolasi multi-tenant (WAJIB)

1. Setiap tabel domain memiliki `organization_id CHAR(26) NOT NULL` dengan index.
2. Repository **tidak boleh** memakai `dataSource.getRepository(X)` langsung di use case. Semua akses lewat repository modul yang menerima `TenantContext`.
3. Disediakan helper wajib:

```ts
// shared/infrastructure/TenantScopedRepository.ts
export abstract class TenantScopedRepository<T extends { organizationId: string }> {
  constructor(protected readonly ds: DataSource, protected readonly ctx: TenantContext) {}

  protected scoped(alias: string): SelectQueryBuilder<T> {
    return this.ds.getRepository(this.entity)
      .createQueryBuilder(alias)
      .where(`${alias}.organization_id = :orgId`, { orgId: this.ctx.organizationId });
  }

  protected assertOwnership(entity: { organizationId: string }): void {
    if (entity.organizationId !== this.ctx.organizationId) throw new ForbiddenError('CROSS_TENANT_ACCESS');
  }
}
```

4. Test wajib: setiap repository memiliki test "tidak mengembalikan data organisasi lain" (lihat `09-TESTING-STRATEGY.md` §5.3).

---

## 4. Definisi tabel

### 4.1 `organizations`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | CHAR(26) PK | |
| name | VARCHAR(160) | |
| slug | VARCHAR(80) UNIQUE | |
| timezone | VARCHAR(64) | default `Asia/Jakarta` |
| default_locale | VARCHAR(8) | `id` \| `en` |
| status | VARCHAR(24) | `ACTIVE` \| `SUSPENDED` |
| recording_policy | VARCHAR(16) | `OFF` \| `OPTIONAL` \| `ALWAYS` |
| transcription_policy | VARCHAR(16) | idem |
| recording_purpose | VARCHAR(250) | teks `purpose` default |
| announcement_language | VARCHAR(8) | harus dari daftar §5.2 `03-...` |
| media_retention_days | INT | default 365 |
| cpr_daily_limit | INT | default 1 |
| cpr_weekly_limit | INT | default 2 |
| ai_summary_enabled | TINYINT(1) | default 0 |
| settings | JSON | pengaturan tambahan |
| created_at / updated_at | DATETIME(3) | |

### 4.2 `users`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | CHAR(26) PK | |
| organization_id | CHAR(26) FK | nullable hanya untuk `PLATFORM_OWNER` |
| email | VARCHAR(190) | unique bersama organization_id |
| password_hash | VARCHAR(255) | Argon2id |
| full_name | VARCHAR(160) | |
| role | VARCHAR(32) | `PLATFORM_OWNER`\|`ORG_ADMIN`\|`SUPERVISOR`\|`AGENT`\|`VIEWER` |
| status | VARCHAR(24) | `ACTIVE`\|`DISABLED`\|`INVITED` |
| totp_secret_enc | VARBINARY(512) NULL | terenkripsi |
| totp_enabled | TINYINT(1) | |
| last_login_at | DATETIME(3) NULL | |
| failed_login_count | INT | |
| locked_until | DATETIME(3) NULL | |
| locale | VARCHAR(8) | |
| avatar_url | VARCHAR(500) NULL | |

Index: `UNIQUE(organization_id, email)`, `INDEX(role)`, `INDEX(status)`.

### 4.3 `refresh_tokens`

`id`, `user_id`, `token_hash VARCHAR(128)`, `family_id CHAR(26)`, `expires_at`, `revoked_at NULL`, `replaced_by NULL`, `user_agent`, `ip`. Index `UNIQUE(token_hash)`, `INDEX(user_id, family_id)`.

### 4.4 `meta_apps`

| Kolom | Tipe |
|---|---|
| id | CHAR(26) PK |
| organization_id | CHAR(26) FK |
| name | VARCHAR(120) |
| meta_app_id | VARCHAR(64) UNIQUE |
| app_secret_enc | VARBINARY(1024) |
| webhook_verify_token_enc | VARBINARY(1024) |
| graph_api_version | VARCHAR(12) default `v23.0` |
| status | VARCHAR(24) |

### 4.5 `whatsapp_business_accounts`

`id`, `organization_id`, `meta_app_id (FK)`, `waba_id VARCHAR(64) UNIQUE`, `name`, `status`, `last_synced_at`.

### 4.6 `wa_phone_numbers`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | CHAR(26) PK | |
| organization_id | CHAR(26) | |
| waba_id | CHAR(26) FK | |
| phone_number_id | VARCHAR(64) UNIQUE | PNID Meta |
| display_phone_number | VARCHAR(24) | E.164 tanpa `+` |
| verified_name | VARCHAR(160) | |
| access_token_enc | VARBINARY(4096) | terenkripsi |
| token_expires_at | DATETIME(3) NULL | |
| calling_status | VARCHAR(16) | `ENABLED`\|`DISABLED`\|`UNKNOWN` |
| call_icon_visibility | VARCHAR(16) | `DEFAULT`\|`DISABLE_ALL` |
| restrict_to_user_countries | JSON | array kode negara |
| callback_permission_status | VARCHAR(16) | |
| call_hours | JSON | struktur sesuai Meta |
| sip_status | VARCHAR(16) | wajib `DISABLED` untuk dipakai |
| restrictions | JSON NULL | dari GET settings / webhook |
| restricted_until | DATETIME(3) NULL | |
| connection_status | VARCHAR(16) | `HEALTHY`\|`DEGRADED`\|`ERROR` |
| last_error | TEXT NULL | |
| last_synced_at | DATETIME(3) NULL | |
| is_test_number | TINYINT(1) | memengaruhi batas CPR |

### 4.7 `skills`

`id`, `organization_id`, `code VARCHAR(48)`, `name`, `description`, `is_active`. Unique `(organization_id, code)`.

### 4.8 `queues`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id, organization_id | | |
| code | VARCHAR(48) | unique per org |
| name | VARCHAR(120) | |
| strategy | VARCHAR(24) | `LONGEST_IDLE`\|`ROUND_ROBIN`\|`FEWEST_CALLS`\|`SKILL_PRIORITY` |
| ring_timeout_seconds | INT | default 15 |
| max_wait_seconds | INT | default 90 |
| wrap_up_seconds | INT | default 30 |
| require_disposition | TINYINT(1) | default 1 |
| overflow_action | VARCHAR(24) | `REJECT`\|`OVERFLOW_QUEUE`\|`CALLBACK` |
| overflow_queue_id | CHAR(26) NULL | |
| recording_policy | VARCHAR(16) NULL | override organisasi |
| transcription_policy | VARCHAR(16) NULL | |
| priority | INT | default 0 |
| is_active | TINYINT(1) | |

### 4.9 `queue_skills`

`id`, `queue_id`, `skill_id`, `is_required TINYINT(1)`, `min_level TINYINT`. Unique `(queue_id, skill_id)`.

### 4.10 `agent_profiles`

`id`, `organization_id`, `user_id UNIQUE`, `extension VARCHAR(16) NULL`, `max_concurrent_calls INT default 1`, `auto_answer TINYINT(1) default 0`, `current_status VARCHAR(24)`, `current_status_reason VARCHAR(64) NULL`, `status_since DATETIME(3)`, `last_assigned_at DATETIME(3) NULL`, `active_call_id CHAR(26) NULL`, `is_active`.

Status: `OFFLINE`, `AVAILABLE`, `RINGING`, `ON_CALL`, `WRAP_UP`, `BREAK`, `BUSY`.

### 4.11 `agent_skills`

`id`, `agent_profile_id`, `skill_id`, `level TINYINT (1..5)`. Unique `(agent_profile_id, skill_id)`.

### 4.12 `agent_queues`

`id`, `agent_profile_id`, `queue_id`, `priority INT`. Unique `(agent_profile_id, queue_id)`.

### 4.13 `agent_status_events`

`id`, `organization_id`, `agent_profile_id`, `from_status`, `to_status`, `reason`, `occurred_at DATETIME(3)`, `duration_seconds INT NULL` (diisi saat transisi berikutnya), `source VARCHAR(24)` (`USER`, `SYSTEM`, `SUPERVISOR`).
Index: `(organization_id, agent_profile_id, occurred_at)`.

### 4.14 `routing_rules`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id, organization_id | | |
| wa_phone_number_id | CHAR(26) FK | |
| priority | INT | dievaluasi menaik |
| match_type | VARCHAR(24) | `ALWAYS`\|`PAYLOAD_EQUALS`\|`PAYLOAD_PREFIX`\|`PAYLOAD_REGEX`\|`CONTACT_TAG`\|`TIME_WINDOW` |
| match_value | VARCHAR(255) NULL | |
| queue_id | CHAR(26) FK | |
| is_active | TINYINT(1) | |

Evaluasi: aturan pertama yang cocok menang; bila tidak ada, dipakai antrian default nomor (`wa_phone_numbers.default_queue_id`, kolom tambahan `CHAR(26) NULL`).

### 4.15 `contacts`

| Kolom | Tipe |
|---|---|
| id, organization_id | |
| wa_id | VARCHAR(24) — nomor E.164 tanpa `+` |
| phone_e164 | VARCHAR(24) |
| profile_name | VARCHAR(160) NULL — dari webhook |
| display_name | VARCHAR(160) NULL — diisi manual |
| external_customer_id | VARCHAR(120) NULL |
| email | VARCHAR(190) NULL |
| tags | JSON |
| attributes | JSON |
| notes | TEXT NULL |
| csw_expires_at | DATETIME(3) NULL — customer service window |
| last_interaction_at | DATETIME(3) NULL |
| is_blocked | TINYINT(1) |

Unique `(organization_id, wa_id)`. Index `(organization_id, external_customer_id)`, `(organization_id, phone_e164)`.

### 4.16 `call_permissions`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id, organization_id | | |
| contact_id | CHAR(26) FK | |
| wa_phone_number_id | CHAR(26) FK | izin bersifat per pasangan nomor bisnis + kontak |
| status | VARCHAR(24) | `UNKNOWN`\|`REQUESTED`\|`GRANTED_TEMPORARY`\|`GRANTED_PERMANENT`\|`DENIED`\|`REVOKED` |
| granted_at | DATETIME(3) NULL | |
| expires_at | DATETIME(3) NULL | untuk temporary |
| source | VARCHAR(32) | `FREE_FORM_CPR`\|`TEMPLATE_CPR`\|`CALLBACK_PERMISSION`\|`PROFILE_GRANT`\|`INFERRED` |
| last_request_at | DATETIME(3) NULL | |
| requests_24h | INT default 0 | |
| requests_7d | INT default 0 | |
| window_reset_at | DATETIME(3) NULL | |
| consecutive_unanswered | INT default 0 | |

Unique `(wa_phone_number_id, contact_id)`.

### 4.17 `call_permission_requests`

`id`, `organization_id`, `call_permission_id`, `channel VARCHAR(16)` (`FREE_FORM`\|`TEMPLATE`), `template_name NULL`, `wamid VARCHAR(128) NULL`, `sent_at`, `response VARCHAR(24) NULL` (`ACCEPTED`\|`DECLINED`\|`NO_RESPONSE`), `responded_at NULL`, `error_code NULL`, `raw_payload JSON NULL`.

### 4.18 `calls` (tabel inti)

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | CHAR(26) PK | ULID, dipakai sebagai `biz_opaque_callback_data` |
| organization_id | CHAR(26) | |
| wa_phone_number_id | CHAR(26) FK | |
| contact_id | CHAR(26) FK NULL | |
| wacid | VARCHAR(128) NULL UNIQUE | ID panggilan Meta |
| direction | VARCHAR(24) | `INBOUND` (UIC) \| `OUTBOUND` (BIC) |
| state | VARCHAR(24) | lihat state machine |
| end_reason | VARCHAR(32) NULL | `COMPLETED`\|`FAILED`\|`NO_ANSWER`\|`REJECTED_BY_AGENT`\|`REJECTED_BY_USER`\|`ABANDONED`\|`OVERFLOW`\|`STALE` |
| from_number | VARCHAR(24) | |
| to_number | VARCHAR(24) | |
| queue_id | CHAR(26) NULL | |
| assigned_agent_id | CHAR(26) NULL | `agent_profiles.id` |
| offer_attempts | INT default 0 | jumlah agent yang sudah ditawari |
| cta_payload | VARCHAR(512) NULL | |
| deeplink_payload | VARCHAR(512) NULL | |
| entry_point | VARCHAR(32) NULL | `CHAT_ICON`\|`CTA_BUTTON`\|`TEMPLATE_BUTTON`\|`DEEPLINK`\|`OUTBOUND` |
| recording_enabled | TINYINT(1) | |
| transcription_enabled | TINYINT(1) | |
| queued_at | DATETIME(3) NULL | |
| first_offered_at | DATETIME(3) NULL | |
| pre_accepted_at | DATETIME(3) NULL | |
| answered_at | DATETIME(3) NULL | |
| ended_at | DATETIME(3) NULL | |
| wrap_up_ended_at | DATETIME(3) NULL | |
| meta_start_time | DATETIME(3) NULL | dari webhook terminate |
| meta_end_time | DATETIME(3) NULL | |
| meta_duration_seconds | INT NULL | sumber kebenaran penagihan |
| wait_seconds | INT NULL | terhitung |
| talk_seconds | INT NULL | |
| wrap_up_seconds | INT NULL | |
| error_code | INT NULL | |
| error_message | VARCHAR(500) NULL | |
| billable_pulses | INT NULL | ceil(duration/6) untuk OUTBOUND |
| created_at / updated_at | | |

Index:
- `INDEX(organization_id, created_at)`
- `INDEX(organization_id, state)`
- `INDEX(organization_id, queue_id, created_at)`
- `INDEX(organization_id, assigned_agent_id, created_at)`
- `INDEX(contact_id, created_at)`
- `UNIQUE(wacid)`

### 4.19 `call_events` (append-only)

| Kolom | Tipe |
|---|---|
| id | CHAR(26) PK |
| organization_id | CHAR(26) |
| call_id | CHAR(26) FK |
| sequence | INT — nomor urut dalam satu panggilan |
| type | VARCHAR(48) — `WEBHOOK_CONNECT`, `ACTION_PRE_ACCEPT`, `ACTION_ACCEPT`, `AGENT_OFFERED`, `AGENT_REJECTED`, `STATE_CHANGED`, `META_ERROR`, dsb. |
| actor_type | VARCHAR(16) — `META`\|`SYSTEM`\|`AGENT`\|`SUPERVISOR` |
| actor_id | CHAR(26) NULL |
| payload | JSON — **SDP disimpan sebagai hash, bukan isi penuh** |
| occurred_at | DATETIME(3) |

Unique `(call_id, sequence)`. Tabel ini tidak boleh di-UPDATE atau DELETE.

### 4.20 `call_recordings`

`id`, `organization_id`, `call_id UNIQUE`, `meta_media_id VARCHAR(64)`, `sha256 VARCHAR(64)`, `mime_type VARCHAR(64)`, `storage_key VARCHAR(500) NULL`, `size_bytes BIGINT NULL`, `duration_seconds INT NULL`, `status VARCHAR(24)` (`PENDING`\|`DOWNLOADING`\|`ARCHIVED`\|`FAILED`\|`EXPIRED`), `attempts INT`, `last_error TEXT NULL`, `meta_expires_at DATETIME(3)`, `archived_at NULL`, `purge_after DATETIME(3) NULL`.

### 4.21 `call_transcripts`

`id`, `organization_id`, `call_id UNIQUE`, `meta_media_id`, `sha256`, `storage_key NULL`, `language VARCHAR(8) NULL`, `confidence DECIMAL(4,3) NULL`, `duration_seconds DECIMAL(8,2) NULL`, `full_text MEDIUMTEXT NULL`, `status`, `attempts`, `last_error`, `meta_expires_at`, `archived_at`, `purge_after`.

Index full-text: `FULLTEXT KEY ft_transcript (full_text) WITH PARSER ngram` (MySQL 8, mendukung Bahasa Indonesia dan pencarian sebagian kata).

### 4.22 `transcript_segments`

`id`, `organization_id`, `call_transcript_id`, `segment_index INT`, `speaker VARCHAR(16)` (`Business`\|`Customer`), `channel TINYINT`, `start_ms INT`, `end_ms INT`, `text TEXT`, `confidence DECIMAL(4,3)`, `words JSON NULL`.
Index `(call_transcript_id, segment_index)`.

### 4.23 `call_summaries` (fitur AI opsional)

`id`, `organization_id`, `call_id UNIQUE`, `summary TEXT`, `sentiment VARCHAR(16)` (`POSITIVE`\|`NEUTRAL`\|`NEGATIVE`), `topics JSON`, `action_items JSON`, `compliance_flags JSON`, `model VARCHAR(64)`, `prompt_version VARCHAR(24)`, `generated_at`, `status`.

### 4.24 `dispositions` & `call_dispositions`

`dispositions`: `id`, `organization_id`, `parent_id NULL`, `code VARCHAR(48)`, `label VARCHAR(160)`, `requires_note TINYINT(1)`, `sort_order INT`, `is_active`. Unique `(organization_id, code)`. Maksimal 2 level.

`call_dispositions`: `id`, `organization_id`, `call_id`, `disposition_id`, `agent_profile_id`, `note TEXT NULL`, `tags JSON`, `created_at`. Unique `(call_id)` (satu disposisi final per panggilan; perubahan menghasilkan entri audit).

### 4.25 `callbacks`

`id`, `organization_id`, `contact_id`, `wa_phone_number_id`, `source_call_id NULL`, `reason VARCHAR(160)`, `priority TINYINT`, `scheduled_at NULL`, `assigned_agent_id NULL`, `status VARCHAR(24)`, `attempts INT`, `last_attempt_at NULL`, `resulting_call_id NULL`, `note TEXT NULL`.
Index `(organization_id, status, scheduled_at)`.

### 4.26 `call_quality_samples`

`id`, `organization_id`, `call_id`, `sampled_at DATETIME(3)`, `rtt_ms INT`, `jitter_ms DECIMAL(6,2)`, `packet_loss_pct DECIMAL(5,2)`, `audio_level_in DECIMAL(5,4)`, `audio_level_out DECIMAL(5,4)`, `mos_estimate DECIMAL(3,2)`, `connection_type VARCHAR(24) NULL`.
Index `(call_id, sampled_at)`. Retensi 30 hari (job pembersih).

### 4.27 `entry_point_payloads`

`id`, `organization_id`, `code VARCHAR(64)` unique per org, `label`, `queue_id NULL`, `description`, `is_active`.
Dipakai FR-EPT-004 & FR-CALL-017.

### 4.28 `message_templates`

Cache lokal template Meta: `id`, `organization_id`, `waba_id`, `name`, `language`, `category`, `type VARCHAR(32)` (`VOICE_CALL_BUTTON`\|`CALL_PERMISSION_REQUEST`\|`OTHER`), `status VARCHAR(24)`, `components JSON`, `meta_template_id VARCHAR(64) NULL`, `last_synced_at`.

### 4.29 `webhook_events`

`id`, `meta_app_id CHAR(26)`, `organization_id CHAR(26) NULL` (diisi setelah resolusi), `dedupe_key CHAR(64) UNIQUE`, `field VARCHAR(48)`, `waba_id VARCHAR(64) NULL`, `phone_number_id VARCHAR(64) NULL`, `payload JSON`, `signature_valid TINYINT(1)`, `received_at DATETIME(3)`, `processed_at NULL`, `status VARCHAR(24)` (`PENDING`\|`PROCESSED`\|`FAILED`\|`SKIPPED`), `attempts INT`, `last_error TEXT NULL`.
Index `(status, received_at)`, `(phone_number_id, received_at)`. Retensi 30 hari.

### 4.30 `domain_events` (outbox)

`id`, `organization_id NULL`, `aggregate_type`, `aggregate_id`, `type VARCHAR(64)`, `payload JSON`, `occurred_at`, `published_at NULL`, `attempts INT`.
Index `(published_at, occurred_at)`.

### 4.31 `notifications`

`id`, `organization_id`, `user_id NULL` (null = broadcast peran), `target_role VARCHAR(32) NULL`, `severity VARCHAR(16)`, `type VARCHAR(48)`, `title`, `body TEXT`, `data JSON`, `read_at NULL`, `created_at`.

### 4.32 `daily_call_stats`

`id`, `organization_id`, `stat_date DATE`, `queue_id NULL`, `agent_profile_id NULL`, `wa_phone_number_id NULL`, `direction`, `total_calls`, `answered_calls`, `abandoned_calls`, `rejected_calls`, `failed_calls`, `total_wait_seconds`, `total_talk_seconds`, `total_wrap_seconds`, `max_wait_seconds`, `billable_pulses`.
Unique `(organization_id, stat_date, queue_id, agent_profile_id, wa_phone_number_id, direction)`.

### 4.33 `audit_logs`

`id`, `organization_id NULL`, `actor_user_id NULL`, `actor_ip`, `actor_user_agent`, `action VARCHAR(64)`, `resource_type VARCHAR(48)`, `resource_id VARCHAR(64)`, `before JSON NULL`, `after JSON NULL`, `metadata JSON`, `created_at`.
Index `(organization_id, created_at)`, `(resource_type, resource_id)`.

---

## 5. Contoh entity TypeORM

```ts
// modules/calling/infrastructure/CallOrmEntity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { CallDirection, CallState, CallEndReason } from '../domain/enums';

@Entity({ name: 'calls' })
@Index('idx_calls_org_created', ['organizationId', 'createdAt'])
@Index('idx_calls_org_state', ['organizationId', 'state'])
@Index('idx_calls_org_queue_created', ['organizationId', 'queueId', 'createdAt'])
export class CallOrmEntity {
  @PrimaryColumn({ type: 'char', length: 26 })
  id!: string;

  @Column({ name: 'organization_id', type: 'char', length: 26 })
  organizationId!: string;

  @Column({ name: 'wa_phone_number_id', type: 'char', length: 26 })
  waPhoneNumberId!: string;

  @Column({ name: 'contact_id', type: 'char', length: 26, nullable: true })
  contactId!: string | null;

  @Index('uq_calls_wacid', { unique: true })
  @Column({ type: 'varchar', length: 128, nullable: true })
  wacid!: string | null;

  @Column({ type: 'varchar', length: 24 })
  direction!: CallDirection;

  @Column({ type: 'varchar', length: 24 })
  state!: CallState;

  @Column({ name: 'end_reason', type: 'varchar', length: 32, nullable: true })
  endReason!: CallEndReason | null;

  @Column({ name: 'meta_duration_seconds', type: 'int', nullable: true })
  metaDurationSeconds!: number | null;

  // ... kolom lain sesuai §4.18

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
```

Domain entity **terpisah** dari ORM entity; mapper di `application/mappers/CallMapper.ts`.

```ts
// modules/calling/domain/entities/Call.ts (tanpa dekorator, tanpa TypeORM)
export class Call {
  private constructor(private props: CallProps) {}

  static createInbound(input: CreateInboundCallInput): Call { /* invariant */ }

  assignAgent(agentId: string, at: Date): void {
    this.transitionTo(CallState.OFFERING, at);
    this.props.assignedAgentId = agentId;
    this.props.offerAttempts += 1;
    this.addEvent(new CallOfferedEvent(this.props.id, agentId, at));
  }

  private transitionTo(next: CallState, at: Date): void {
    if (!CallStateMachine.canTransition(this.props.state, next)) {
      throw new IllegalCallTransitionError(this.props.state, next);
    }
    this.props.state = next;
  }
}
```

---

## 6. Migration

- Lokasi: `apps/backend/src/infrastructure/database/migrations/`.
- Penamaan: `<timestamp>-<DeskripsiPascalCase>.ts`, mis. `1754900000000-CreateCallTables.ts`.
- Setiap migration WAJIB memiliki `up` **dan** `down` yang benar.
- Perubahan yang berpotensi mengunci tabel besar harus dijalankan dalam langkah terpisah (tambah kolom nullable → backfill batch → tambah constraint).
- Urutan migration awal:
  1. `CreateTenancyAndIdentity`
  2. `CreateMetaAccounts`
  3. `CreateRoutingAndAgents`
  4. `CreateContactsAndPermissions`
  5. `CreateCallsAndEvents`
  6. `CreateMediaAndTranscripts`
  7. `CreateDispositionsAndCallbacks`
  8. `CreateAnalyticsAndAudit`
  9. `CreateWebhookAndOutbox`
  10. `AddTranscriptFullTextIndex`

---

## 7. Seed data (development)

`pnpm --filter backend seed` membuat:
- 1 organisasi `Nusanet Demo` (timezone `Asia/Jakarta`)
- 1 platform owner, 1 org admin, 1 supervisor, 5 agent
- 3 skill (`BILLING`, `TEKNIS`, `SALES`), 3 antrian, mapping agent↔skill
- 1 Meta App + 1 WABA + 1 nomor (test number, token dummy)
- 8 disposisi bertingkat, 5 payload entry point
- 200 panggilan historis acak + transkrip contoh untuk menguji laporan & pencarian

Seed WAJIB idempoten (aman dijalankan berulang).

---

## 8. Kebijakan retensi

| Data | Retensi default | Mekanisme |
|---|---|---|
| `webhook_events` | 30 hari | job harian |
| `call_quality_samples` | 30 hari | job harian |
| `call_events` | 400 hari | job bulanan (arsip ke storage sebelum hapus) |
| Rekaman & transkrip | `organizations.media_retention_days` | job harian menghapus objek storage + baris |
| `audit_logs` | 730 hari | job bulanan |
| `calls`, `daily_call_stats` | permanen | — |
