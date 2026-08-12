import type { RoutingRuleRecord, RoutingRuleRepositoryPort } from '../domain/ports/RoutingRuleRepositoryPort';
import { ValidationError } from '../../../shared/errors/AppError';

export interface RoutingContext {
  payload?: string | undefined;
  phoneNumber?: string | undefined;
  contactAttributes?: Record<string, unknown> | undefined;
  defaultQueueId: string;
}

export interface EvaluationLog {
  ruleId: string;
  priority: number;
  matchField: string;
  matchOperator: string;
  matchValue: string;
  actualValue: string | null;
  matched: boolean;
}

export class RoutingResolverService {
  constructor(private readonly routingRuleRepo: RoutingRuleRepositoryPort) {}

  private extractFieldValue(field: string, context: RoutingContext): string | null {
    if (field === 'payload') return context.payload || null;
    if (field === 'phoneNumber' || field === 'phone_number') return context.phoneNumber || null;

    if (field.startsWith('contactAttributes.') || field.startsWith('contact.customAttributes.')) {
      const key = field.split('.').slice(1).join('.');
      if (!context.contactAttributes || !(key in context.contactAttributes)) return null;
      const val = context.contactAttributes[key];
      return val !== undefined && val !== null ? String(val) : null;
    }

    return null;
  }

  private evaluateRule(rule: RoutingRuleRecord, actualVal: string | null): boolean {
    if (actualVal === null) return false;

    switch (rule.matchOperator) {
      case 'EQUALS':
        return actualVal === rule.matchValue;
      case 'PREFIX':
        return actualVal.startsWith(rule.matchValue);
      case 'REGEX':
        try {
          return new RegExp(rule.matchValue).test(actualVal);
        } catch {
          return false;
        }
      case 'IN':
        return rule.matchValue
          .split(',')
          .map((s) => s.trim())
          .includes(actualVal);
      default:
        return false;
    }
  }

  async resolveQueue(
    organizationId: string,
    context: RoutingContext
  ): Promise<{ targetQueueId: string; matchedRuleId: string | null }> {
    if (!organizationId) throw new ValidationError('organizationId wajib diisi');
    if (!context.defaultQueueId) throw new ValidationError('defaultQueueId wajib diisi');

    const rules = await this.routingRuleRepo.listActiveByOrg(organizationId);
    rules.sort((a, b) => a.priority - b.priority);

    for (const rule of rules) {
      const actualVal = this.extractFieldValue(rule.matchField, context);
      if (this.evaluateRule(rule, actualVal)) {
        return { targetQueueId: rule.targetQueueId, matchedRuleId: rule.id };
      }
    }

    return { targetQueueId: context.defaultQueueId, matchedRuleId: null };
  }

  async simulate(
    organizationId: string,
    context: RoutingContext
  ): Promise<{
    targetQueueId: string;
    matchedRuleId: string | null;
    evaluationTable: EvaluationLog[];
  }> {
    if (!organizationId) throw new ValidationError('organizationId wajib diisi');
    if (!context.defaultQueueId) throw new ValidationError('defaultQueueId wajib diisi');

    const rules = await this.routingRuleRepo.listActiveByOrg(organizationId);
    rules.sort((a, b) => a.priority - b.priority);

    const evaluationTable: EvaluationLog[] = [];
    let finalTargetQueueId = context.defaultQueueId;
    let finalMatchedRuleId: string | null = null;

    for (const rule of rules) {
      const actualVal = this.extractFieldValue(rule.matchField, context);
      const isMatch = this.evaluateRule(rule, actualVal);

      evaluationTable.push({
        ruleId: rule.id,
        priority: rule.priority,
        matchField: rule.matchField,
        matchOperator: rule.matchOperator,
        matchValue: rule.matchValue,
        actualValue: actualVal,
        matched: isMatch,
      });

      if (isMatch && finalMatchedRuleId === null) {
        finalTargetQueueId = rule.targetQueueId;
        finalMatchedRuleId = rule.id;
      }
    }

    return {
      targetQueueId: finalTargetQueueId,
      matchedRuleId: finalMatchedRuleId,
      evaluationTable,
    };
  }
}
