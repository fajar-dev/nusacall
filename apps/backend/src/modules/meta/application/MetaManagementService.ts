import type { TenantContext } from '../../../shared/domain/TenantContext';
import type { EncryptionServicePort } from '../../../shared/domain/ports/EncryptionServicePort';
import { ForbiddenError } from '../../../shared/errors/AppError';

export interface CreateMetaAppParams {
  name: string;
  metaAppId: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphApiVersion?: string;
}

export interface MetaAppDTO {
  id: string;
  organizationId: string;
  name: string;
  metaAppId: string;
  graphApiVersion: string;
  status: string;
  createdAt?: Date;
}

export interface CreateWabaParams {
  metaAppId: string;
  wabaId: string;
  name: string;
}

export interface WabaDTO {
  id: string;
  organizationId: string;
  metaAppId: string;
  wabaId: string;
  name: string;
  status: string;
  lastSyncedAt?: Date | null;
  createdAt?: Date;
}

export interface CreatePhoneNumberParams {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  accessToken: string;
  isTestNumber?: boolean;
}

export interface WaPhoneNumberDTO {
  id: string;
  organizationId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  callingStatus: string;
  sipStatus: string;
  connectionStatus: string;
  isTestNumber: boolean;
  createdAt?: Date;
}

export interface MetaManagementRepositoryPort {
  saveMetaApp(data: {
    organizationId: string;
    name: string;
    metaAppId: string;
    appSecretEnc: Buffer;
    webhookVerifyTokenEnc: Buffer;
    graphApiVersion?: string;
  }): Promise<MetaAppDTO>;
  listMetaApps(organizationId: string): Promise<MetaAppDTO[]>;

  saveWaba(data: {
    organizationId: string;
    metaAppId: string;
    wabaId: string;
    name: string;
  }): Promise<WabaDTO>;
  listWabas(organizationId: string): Promise<WabaDTO[]>;

  savePhoneNumber(data: {
    organizationId: string;
    wabaId: string;
    phoneNumberId: string;
    displayPhoneNumber: string;
    verifiedName: string;
    accessTokenEnc: Buffer;
    isTestNumber?: boolean;
  }): Promise<WaPhoneNumberDTO>;
  listPhoneNumbers(organizationId: string): Promise<WaPhoneNumberDTO[]>;
}

export class MetaManagementService {
  constructor(
    private readonly repo: MetaManagementRepositoryPort,
    private readonly cipher: EncryptionServicePort
  ) {}

  async createMetaApp(tenant: TenantContext, params: CreateMetaAppParams): Promise<MetaAppDTO> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan');
    }

    const appSecretEnc = this.cipher.encrypt(params.appSecret);
    const webhookVerifyTokenEnc = this.cipher.encrypt(params.webhookVerifyToken);

    return this.repo.saveMetaApp({
      organizationId: tenant.organizationId,
      name: params.name,
      metaAppId: params.metaAppId,
      appSecretEnc,
      webhookVerifyTokenEnc,
      graphApiVersion: params.graphApiVersion ?? 'v23.0',
    });
  }

  async listMetaApps(tenant: TenantContext): Promise<MetaAppDTO[]> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan');
    }
    return this.repo.listMetaApps(tenant.organizationId);
  }

  async createWaba(tenant: TenantContext, params: CreateWabaParams): Promise<WabaDTO> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan');
    }

    return this.repo.saveWaba({
      organizationId: tenant.organizationId,
      metaAppId: params.metaAppId,
      wabaId: params.wabaId,
      name: params.name,
    });
  }

  async listWabas(tenant: TenantContext): Promise<WabaDTO[]> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan');
    }
    return this.repo.listWabas(tenant.organizationId);
  }

  async createPhoneNumber(tenant: TenantContext, params: CreatePhoneNumberParams): Promise<WaPhoneNumberDTO> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan');
    }

    const accessTokenEnc = this.cipher.encrypt(params.accessToken);

    return this.repo.savePhoneNumber({
      organizationId: tenant.organizationId,
      wabaId: params.wabaId,
      phoneNumberId: params.phoneNumberId,
      displayPhoneNumber: params.displayPhoneNumber,
      verifiedName: params.verifiedName,
      accessTokenEnc,
      isTestNumber: params.isTestNumber ?? false,
    });
  }

  async listPhoneNumbers(tenant: TenantContext): Promise<WaPhoneNumberDTO[]> {
    if (!tenant.organizationId) {
      throw new ForbiddenError('ORGANIZATION_CONTEXT_REQUIRED', 'Konteks organisasi diperlukan');
    }
    return this.repo.listPhoneNumbers(tenant.organizationId);
  }
}
