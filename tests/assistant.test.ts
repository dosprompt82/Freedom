import { describe, expect, it } from 'vitest';
import { buildBriefing } from '@/lib/assistant/briefing';
import { executeAssistantTool } from '@/lib/assistant/tools';
import { analyzePlan, newEquityHolding, newWorkPhase, samplePlanInputs } from '@/lib/engine';

const plan = () => ({
  ...samplePlanInputs(2026),
  equity: [newEquityHolding({ id: 'e', base: 3e6, conservative: 1.5e6, optimistic: 4.5e6, expectedAge: 46, earliestAge: 45, latestAge: 49, requiresEmployment: true })],
  workPhases: [newWorkPhase({ id: 'c', coversSpending: true, years: 5 })],
});

describe('assistant briefing', () => {
  it('states the engine’s own numbers, and nothing undefined', () => {
    const inputs = plan();
    const text = buildBriefing(inputs);
    const a = analyzePlan(inputs);
    expect(text).toContain(`Work-optional age (earliest age to stop ALL paid work`);
    expect(text).toContain(`: ${a.workOptional}.`);
    expect(text).toContain('MUST STILL BE EMPLOYED');
    expect(text).toContain('assumed to cover all spending');
    expect(text).not.toMatch(/undefined|NaN/);
  });
});

describe('assistant tools', () => {
  it('what_if reruns the engine with the requested change', () => {
    const inputs = plan();
    const r = executeAssistantTool('what_if', { retirementAge: inputs.retirementAge + 2 }, inputs) as {
      before: { retirementAge: number; portfolioAtRetirement: number };
      after: { retirementAge: number; portfolioAtRetirement: number };
      changesApplied: string[];
    };
    expect(r.after.retirementAge).toBe(inputs.retirementAge + 2);
    expect(r.after.portfolioAtRetirement).toBeGreaterThan(r.before.portfolioAtRetirement);
    expect(r.changesApplied[0]).toContain('full-time work ends');
  });

  it('shifts equity timing and accepts loosely typed numbers', () => {
    const inputs = plan();
    const r = executeAssistantTool('what_if', { equityDelayYears: '2' }, inputs) as { after: { workOptionalAge: number | null }; before: { workOptionalAge: number | null } };
    expect(r.after.workOptionalAge ?? 999).toBeGreaterThanOrEqual(r.before.workOptionalAge ?? 0);
  });

  it('rejects empty what-ifs and out-of-range years with a message', () => {
    expect(() => executeAssistantTool('what_if', {}, plan())).toThrow(/No recognized changes/);
    expect(() => executeAssistantTool('year_detail', { age: 10 }, plan())).toThrow(/between/);
  });

  it('year_detail reconciles', () => {
    const d = executeAssistantTool('year_detail', { age: 50 }, plan()) as { beginningPortfolio: number; endingPortfolio: number; withdrawals: number };
    expect(d.withdrawals).toBe(0); // consulting covers spending
    expect(d.endingPortfolio).toBeGreaterThan(d.beginningPortfolio);
  });
});
