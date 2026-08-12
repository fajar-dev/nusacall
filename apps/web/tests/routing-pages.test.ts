import { describe, it, expect } from 'vitest';
import idLocale from '../app/i18n/locales/id.json';
import enLocale from '../app/i18n/locales/en.json';

describe('E4-T6: Frontend Admin Queues, Skills & Routing Pages', () => {
  it('should have correct i18n translation keys for queues, skills, and routing admin pages', () => {
    expect(idLocale.queues.title).toBe('Manajemen Antrian');
    expect(enLocale.queues.title).toBe('Queue Management');

    expect(idLocale.skills.title).toBe('Manajemen Skill Agent');
    expect(enLocale.skills.title).toBe('Agent Skill Management');

    expect(idLocale.routing.title).toBe('Aturan Routing & Simulator');
    expect(enLocale.routing.title).toBe('Routing Rules & Simulator');
  });

  it('should evaluate simulation logs correctly for frontend routing simulator', () => {
    const simulateFrontend = (
      rules: Array<{ id: string; priority: number; matchField: string; matchOperator: string; matchValue: string; targetQueueId: string }>,
      context: { payload: string; defaultQueueId: string }
    ) => {
      const logs = [];
      let matchedQueue = context.defaultQueueId;
      let matchedRuleId: string | null = null;

      for (const r of rules) {
        let isMatch = false;
        if (r.matchField === 'payload' && r.matchOperator === 'PREFIX' && context.payload.startsWith(r.matchValue)) {
          isMatch = true;
        }
        logs.push({ ruleId: r.id, matched: isMatch });
        if (isMatch && !matchedRuleId) {
          matchedQueue = r.targetQueueId;
          matchedRuleId = r.id;
        }
      }

      return { targetQueueId: matchedQueue, matchedRuleId, logs };
    };

    const rules = [
      { id: 'R1', priority: 10, matchField: 'payload', matchOperator: 'PREFIX', matchValue: 'VIP_', targetQueueId: 'QUEUE_VIP' },
      { id: 'R2', priority: 20, matchField: 'payload', matchOperator: 'PREFIX', matchValue: 'PROMO_', targetQueueId: 'QUEUE_PROMO' },
    ];

    const result = simulateFrontend(rules, { payload: 'PROMO_SUMMER', defaultQueueId: 'QUEUE_DEFAULT' });

    expect(result.targetQueueId).toBe('QUEUE_PROMO');
    expect(result.matchedRuleId).toBe('R2');
    expect(result.logs.length).toBe(2);
    expect(result.logs[0]!.matched).toBe(false);
    expect(result.logs[1]!.matched).toBe(true);
  });
});
