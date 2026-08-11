import { describe, it, expect } from 'vitest';
import { SystemClock, TestClock } from '../src/shared/utils/Clock';
import { AppDataSource } from '../src/infrastructure/database/data-source';

describe('E0-T7: Clock & TypeORM DataSource', () => {
  it('SystemClock should return current Date', () => {
    const clock = new SystemClock();
    const before = new Date();
    const now = clock.now();
    const after = new Date();

    expect(now.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(now.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('TestClock should return deterministic Date and update when set', () => {
    const fixed = new Date('2026-08-11T10:00:00.000Z');
    const clock = new TestClock(fixed);

    expect(clock.now()).toEqual(fixed);

    const updated = new Date('2026-08-12T12:00:00.000Z');
    clock.setFixedDate(updated);
    expect(clock.now()).toEqual(updated);
  });

  it('AppDataSource MUST have synchronize set to false (Rule N2)', () => {
    expect(AppDataSource.options.synchronize).toBe(false);
  });
});
