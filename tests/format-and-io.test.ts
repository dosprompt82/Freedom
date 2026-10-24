import { describe, expect, it } from 'vitest';
import { defaultInputs } from '@/lib/engine';
import { formatMoney, formatPct, roundForProse } from '@/lib/format';
import { exportPlanFile, parsePlanFile, type Plan } from '@/lib/store';

describe('formatting', () => {
  it('formats compact money without awkward rollovers', () => {
    expect(formatMoney(999_999, { compact: true })).toBe('$1M');
    expect(formatMoney(1_234_567, { compact: true })).toBe('$1.23M');
    expect(formatMoney(12_500, { compact: true })).toBe('$12.5K');
    expect(formatMoney(-420_000, { compact: true })).toBe('−$420K');
  });
  it('rounds prose figures to two significant digits', () => {
    expect(roundForProse(428_571)).toBe(430_000);
    expect(roundForProse(15_000)).toBe(15_000);
    expect(formatMoney(428_571, { approx: true })).toBe('$430,000');
  });
  it('formats percentages', () => {
    expect(formatPct(0.035)).toBe('3.5%');
    expect(formatPct(0.0341, 2)).toBe('3.41%');
  });
});

describe('plan import/export', () => {
  const plan: Plan = {
    id: 'p1',
    name: 'Test',
    createdAt: 1,
    updatedAt: 1,
    isSample: false,
    inputs: defaultInputs(2026),
    scenarios: [],
    compare: ['base'],
    versions: [],
  };
  it('round-trips an exported plan', () => {
    const parsed = parsePlanFile(exportPlanFile(plan));
    expect(parsed.name).toBe('Test');
    expect(parsed.inputs).toEqual(plan.inputs);
    expect(parsed.id).not.toBe('p1');
  });
  it('fills fields missing from older files with defaults', () => {
    const partial = { ...plan, inputs: { ...plan.inputs, downturn: undefined, events: undefined } };
    const parsed = parsePlanFile(JSON.stringify(partial));
    expect(parsed.inputs.downturn.enabled).toBe(false);
    expect(parsed.inputs.events).toEqual([]);
  });
  it('rejects files that are not plans', () => {
    expect(() => parsePlanFile('not json')).toThrow(/valid JSON/);
    expect(() => parsePlanFile('{"hello":1}')).toThrow(/Freedom at 50/);
  });
});
