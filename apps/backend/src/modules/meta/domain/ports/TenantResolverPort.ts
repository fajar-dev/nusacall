export interface TenantResolverPort {
  resolveOrganizationId(
    wabaId: string | null,
    phoneNumberId: string | null
  ): Promise<string | null>;
}
