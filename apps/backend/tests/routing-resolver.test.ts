import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutingResolverService } from '../src/modules/routing/application/RoutingResolverService';
import type { RoutingRuleRecord, RoutingRuleRepositoryPort } from '../src/modules/routing/domain/ports/RoutingRuleRepositoryPort';
import { ValidationError } from '../src/shared/errors/AppError';

describe('E4-T4: RoutingResolverService & Decision Table Simulation', () => {
  let rulesStore: RoutingRuleRecord[];
  let mockRuleRepo: RoutingRuleRepositoryPort;
  const orgId = '01J8ORG0000000000000000001';
  const defaultQueueId = '01J8QUE000000000000000DEFAULT';

  beforeEach(() => {
    rulesStore = [
      {
        id: 'RULE_VIP',
        organizationId: orgId,
        priority: 10,
        matchField: 'contactAttributes.tier',
        matchOperator: 'EQUALS',
        matchValue: 'VIP',
        targetQueueId: 'QUEUE_VIP',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'RULE_PREFIX',
        organizationId: orgId,
        priority: 20,
        matchField: 'payload',
        matchOperator: 'PREFIX',
        matchValue: 'PROMO_',
        targetQueueId: 'QUEUE_PROMO',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'RULE_REGEX',
        organizationId: orgId,
        priority: 30,
        matchField: 'phoneNumber',
        matchOperator: 'REGEX',
        matchValue: '^\\+62812',
        targetQueueId: 'QUEUE_INDONESIA_TELKOMSEL',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'RULE_IN',
        organizationId: orgId,
        priority: 40,
        matchField: 'payload',
        matchOperator: 'IN',
        matchValue: 'SUPPORT,HELP,INFO',
        targetQueueId: 'QUEUE_HELP',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRuleRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      listByOrg: vi.fn(),
      listActiveByOrg: vi.fn().mockImplementation(async (organizationId: string) => {
        return rulesStore.filter((r) => r.organizationId === organizationId && r.isActive);
      }),
      update: vi.fn(),
      delete: vi.fn(),
    };
  });

  describe('resolveQueue', () => {
    it('should route to VIP queue when contactAttributes match EQUALS', async () => {
      const resolver = new RoutingResolverService(mockRuleRepo);

      const result = await resolver.resolveQueue(orgId, {
        contactAttributes: { tier: 'VIP' },
        defaultQueueId,
      });

      expect(result.targetQueueId).toBe('QUEUE_VIP');
      expect(result.matchedRuleId).toBe('RULE_VIP');
    });

    it('should route to PROMO queue when payload matches PREFIX', async () => {
      const resolver = new RoutingResolverService(mockRuleRepo);

      const result = await resolver.resolveQueue(orgId, {
        payload: 'PROMO_SUMMER_2026',
        defaultQueueId,
      });

      expect(result.targetQueueId).toBe('QUEUE_PROMO');
      expect(result.matchedRuleId).toBe('RULE_PREFIX');
    });

    it('should route using REGEX operator', async () => {
      const resolver = new RoutingResolverService(mockRuleRepo);

      const result = await resolver.resolveQueue(orgId, {
        phoneNumber: '+6281299998888',
        defaultQueueId,
      });

      expect(result.targetQueueId).toBe('QUEUE_INDONESIA_TELKOMSEL');
      expect(result.matchedRuleId).toBe('RULE_REGEX');
    });

    it('should route using IN operator', async () => {
      const resolver = new RoutingResolverService(mockRuleRepo);

      const result = await resolver.resolveQueue(orgId, {
        payload: 'HELP',
        defaultQueueId,
      });

      expect(result.targetQueueId).toBe('QUEUE_HELP');
      expect(result.matchedRuleId).toBe('RULE_IN');
    });

    it('should fallback to default queue when no rules match', async () => {
      const resolver = new RoutingResolverService(mockRuleRepo);

      const result = await resolver.resolveQueue(orgId, {
        payload: 'UNKNOWN',
        phoneNumber: '+14155552671',
        defaultQueueId,
      });

      expect(result.targetQueueId).toBe(defaultQueueId);
      expect(result.matchedRuleId).toBeNull();
    });

    it('should throw ValidationError if organizationId or defaultQueueId is missing', async () => {
      const resolver = new RoutingResolverService(mockRuleRepo);

      await expect(resolver.resolveQueue('', { defaultQueueId })).rejects.toThrow(ValidationError);
      await expect(resolver.resolveQueue(orgId, { defaultQueueId: '' })).rejects.toThrow(ValidationError);
    });
  });

  describe('simulate (Decision Table Logs)', () => {
    it('should return decision log table for all active rules', async () => {
      const resolver = new RoutingResolverService(mockRuleRepo);

      const simulation = await resolver.simulate(orgId, {
        payload: 'HELP',
        defaultQueueId,
      });

      expect(simulation.targetQueueId).toBe('QUEUE_HELP');
      expect(simulation.matchedRuleId).toBe('RULE_IN');
      expect(simulation.evaluationTable.length).toBe(4);

      // Verify each log entry
      expect(simulation.evaluationTable[0]!.ruleId).toBe('RULE_VIP');
      expect(simulation.evaluationTable[0]!.matched).toBe(false);

      expect(simulation.evaluationTable[3]!.ruleId).toBe('RULE_IN');
      expect(simulation.evaluationTable[3]!.matched).toBe(true);
    });
  });
});
