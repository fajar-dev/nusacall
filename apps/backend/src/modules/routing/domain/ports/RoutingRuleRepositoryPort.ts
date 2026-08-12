export interface RoutingRuleRecord {
  id: string;
  organizationId: string;
  priority: number;
  matchField: string;
  matchOperator: 'EQUALS' | 'PREFIX' | 'REGEX' | 'IN';
  matchValue: string;
  targetQueueId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutingRuleRepositoryPort {
  create(rule: Omit<RoutingRuleRecord, 'createdAt' | 'updatedAt'>): Promise<RoutingRuleRecord>;
  findById(organizationId: string, id: string): Promise<RoutingRuleRecord | null>;
  listByOrg(organizationId: string): Promise<RoutingRuleRecord[]>;
  listActiveByOrg(organizationId: string): Promise<RoutingRuleRecord[]>;
  update(organizationId: string, id: string, patch: Partial<Omit<RoutingRuleRecord, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<RoutingRuleRecord>;
  delete(organizationId: string, id: string): Promise<boolean>;
}
