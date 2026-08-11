import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  MetaManagementService,
  type MetaManagementRepositoryPort,
  type MetaAppDTO,
  type WabaDTO,
  type WaPhoneNumberDTO,
} from '../src/modules/meta/application/MetaManagementService';
import { SecretCipher } from '../src/shared/infrastructure/crypto/SecretCipher';
import type { TenantContext } from '../src/shared/domain/TenantContext';

class InMemoryMetaManagementRepository implements MetaManagementRepositoryPort {
  private apps = new Map<string, MetaAppDTO & { appSecretEnc: Buffer; webhookVerifyTokenEnc: Buffer }>();
  private wabas = new Map<string, WabaDTO>();
  private phoneNumbers = new Map<string, WaPhoneNumberDTO & { accessTokenEnc: Buffer }>();

  async saveMetaApp(data: {
    organizationId: string;
    name: string;
    metaAppId: string;
    appSecretEnc: Buffer;
    webhookVerifyTokenEnc: Buffer;
    graphApiVersion?: string;
  }): Promise<MetaAppDTO> {
    const id = `app_${crypto.randomUUID()}`;
    const record = {
      id,
      organizationId: data.organizationId,
      name: data.name,
      metaAppId: data.metaAppId,
      appSecretEnc: data.appSecretEnc,
      webhookVerifyTokenEnc: data.webhookVerifyTokenEnc,
      graphApiVersion: data.graphApiVersion ?? 'v23.0',
      status: 'ACTIVE',
      createdAt: new Date(),
    };
    this.apps.set(id, record);
    const { appSecretEnc, webhookVerifyTokenEnc, ...dto } = record;
    return dto;
  }

  async listMetaApps(organizationId: string): Promise<MetaAppDTO[]> {
    return Array.from(this.apps.values())
      .filter((a) => a.organizationId === organizationId)
      .map(({ appSecretEnc, webhookVerifyTokenEnc, ...dto }) => dto);
  }

  async saveWaba(data: {
    organizationId: string;
    metaAppId: string;
    wabaId: string;
    name: string;
  }): Promise<WabaDTO> {
    const id = `waba_${crypto.randomUUID()}`;
    const dto: WabaDTO = {
      id,
      organizationId: data.organizationId,
      metaAppId: data.metaAppId,
      wabaId: data.wabaId,
      name: data.name,
      status: 'ACTIVE',
      lastSyncedAt: null,
      createdAt: new Date(),
    };
    this.wabas.set(id, dto);
    return dto;
  }

  async listWabas(organizationId: string): Promise<WabaDTO[]> {
    return Array.from(this.wabas.values()).filter((w) => w.organizationId === organizationId);
  }

  async savePhoneNumber(data: {
    organizationId: string;
    wabaId: string;
    phoneNumberId: string;
    displayPhoneNumber: string;
    verifiedName: string;
    accessTokenEnc: Buffer;
    isTestNumber?: boolean;
  }): Promise<WaPhoneNumberDTO> {
    const id = `pn_${crypto.randomUUID()}`;
    const record = {
      id,
      organizationId: data.organizationId,
      wabaId: data.wabaId,
      phoneNumberId: data.phoneNumberId,
      displayPhoneNumber: data.displayPhoneNumber,
      verifiedName: data.verifiedName,
      accessTokenEnc: data.accessTokenEnc,
      callingStatus: 'ENABLED',
      sipStatus: 'DISABLED',
      connectionStatus: 'HEALTHY',
      isTestNumber: data.isTestNumber ?? false,
      createdAt: new Date(),
    };
    this.phoneNumbers.set(id, record);
    const { accessTokenEnc, ...dto } = record;
    return dto;
  }

  async listPhoneNumbers(organizationId: string): Promise<WaPhoneNumberDTO[]> {
    return Array.from(this.phoneNumbers.values())
      .filter((pn) => pn.organizationId === organizationId)
      .map(({ accessTokenEnc, ...dto }) => dto);
  }
}

describe('E2-T3: Meta App, WABA, Phone Number CRUD with Write-Only Tokens', () => {
  const cipher = new SecretCipher({
    activeKeyId: 'k1',
    keys: new Map([['k1', crypto.randomBytes(32)]]),
  });

  const tenantOrg1: TenantContext = { organizationId: 'org_1' };
  const tenantOrg2: TenantContext = { organizationId: 'org_2' };

  it('should create Meta App with encrypted secret and write-only response', async () => {
    const repo = new InMemoryMetaManagementRepository();
    const service = new MetaManagementService(repo, cipher);

    const app = await service.createMetaApp(tenantOrg1, {
      name: 'Test Meta App',
      metaAppId: '1234567890',
      appSecret: 'SuperSecretAppSecret123',
      webhookVerifyToken: 'MyVerifyToken999',
    });

    expect(app.id).toBeDefined();
    expect(app.metaAppId).toBe('1234567890');
    expect((app as any).appSecret).toBeUndefined();
    expect((app as any).appSecretEnc).toBeUndefined();
  });

  it('should create WABA and list scoped by organization', async () => {
    const repo = new InMemoryMetaManagementRepository();
    const service = new MetaManagementService(repo, cipher);

    const createdWaba = await service.createWaba(tenantOrg1, {
      metaAppId: 'app_1',
      wabaId: 'waba_100',
      name: 'NusaCall WABA 1',
    });
    expect(createdWaba.wabaId).toBe('waba_100');

    await service.createWaba(tenantOrg2, {
      metaAppId: 'app_2',
      wabaId: 'waba_200',
      name: 'NusaCall WABA 2',
    });

    const listOrg1 = await service.listWabas(tenantOrg1);
    expect(listOrg1).toHaveLength(1);
    expect(listOrg1[0]?.wabaId).toBe('waba_100');
  });

  it('should create WA Phone Number with write-only access token (token encrypted at rest)', async () => {
    const repo = new InMemoryMetaManagementRepository();
    const service = new MetaManagementService(repo, cipher);

    const pn = await service.createPhoneNumber(tenantOrg1, {
      wabaId: 'waba_1',
      phoneNumberId: 'pn_100',
      displayPhoneNumber: '6281234567890',
      verifiedName: 'NusaCall CS',
      accessToken: 'EAAG_META_SECRET_ACCESS_TOKEN',
    });

    expect(pn.id).toBeDefined();
    expect(pn.phoneNumberId).toBe('pn_100');
    expect((pn as any).accessToken).toBeUndefined();
    expect((pn as any).accessTokenEnc).toBeUndefined();
  });
});
