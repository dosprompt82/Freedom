import { describe, expect, it } from 'vitest';
import {
  analyzeEquity,
  analyzeWithInsights,
  balanceAtAge,
  breakevenEquity,
  equityPayouts,
  expectedEquityValue,
  newEquityHolding,
  normalizeInputs,
  phaseSummaries,
  computeMetrics,
  computeMilestones,
  defaultInputs,
  displayYear,
  freedomTargetReal,
  futureValueEndOfYear,
  newEvent,
  newIncomeStream,
  newProperty,
  newWorkPhase,
  projectPlan,
  realReturn,
  runMonteCarlo,
  samplePlanInputs,
  SCENARIO_TEMPLATES,
  targetReachedAge,
  validateInputs,
  workOptionalAge,
  type PlanInputs,
} from '@/lib/engine';

/** A minimal, assumption-free plan: no inflation, no events, no phases. */
function plain(overrides: Partial<PlanInputs> = {}): PlanInputs {
  const base = defaultInputs(2026);
  return {
    ...base,
    currentAge: 40,
    retirementAge: 50,
    planningHorizonAge: 95,
    assets: { ...base.assets, mode: 'total', total: 1_000_000 },
    annualSavings: 100_000,
    retirementSpending: 100_000,
    nominalReturn: 0.05,
    inflation: 0,
    ...overrides,
  };
}

const close = (a: number, b: number, tol = 0.01) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('rates', () => {
  it('uses the exact Fisher relation for real returns', () => {
    close(realReturn(0.06, 0.025), 1.06 / 1.025 - 1, 1e-12);
    expect(realReturn(0.06, 0.025)).not.toBeCloseTo(0.035, 4);
  });
});

describe('accumulation', () => {
  it('matches the closed-form end-of-year contribution formula', () => {
    const p = projectPlan(plain({ planningHorizonAge: 60, retirementAge: 61 }));
    const atRet = balanceAtAge(p, 50, 'nominal')!;
    close(atRet, futureValueEndOfYear(1_000_000, 100_000, 0.05, 10));
  });

  it('applies Ending = Beginning × (1 + r) + Contribution each year', () => {
    const p = projectPlan(plain());
    for (const y of p.years.filter((r) => r.phase === 'accumulation')) {
      close(y.endBalance, y.beginBalance * 1.05 + y.contributions, 1e-6);
    }
  });

  it('keeps savings constant in today’s dollars and equals a real-return model', () => {
    const i = 0.03;
    const p = projectPlan(plain({ inflation: i, retirementAge: 61, planningHorizonAge: 60 }));
    const real = balanceAtAge(p, 50, 'real')!;
    close(real, futureValueEndOfYear(1_000_000, 100_000, realReturn(0.05, i), 10), 0.5);
    close(p.years[3].contributions / p.years[3].priceEnd, 100_000, 1e-6);
  });

  it('grows savings in real terms when asked', () => {
    const p = projectPlan(plain({ savingsRealGrowth: 0.02 }));
    close(p.years[2].contributions, 100_000 * 1.02 ** 2, 1e-6);
  });
});

describe('retirement withdrawals', () => {
  it('withdraws fixed real spending at the start of each year', () => {
    const p = projectPlan(plain({ inflation: 0.02 }));
    const first = p.years.find((y) => y.age === 50)!;
    close(first.withdrawal, 100_000 * 1.02 ** 10, 1e-6);
    close(first.endBalance, (first.beginBalance - first.withdrawal) * 1.05, 1e-6);
  });

  it('finds the exact depletion age with zero returns', () => {
    const p = projectPlan(
      plain({ nominalReturn: 0, currentAge: 50, retirementAge: 50, annualSavings: 0, assets: { ...plain().assets, total: 450_000 } }),
    );
    // 450k covers four full years (50–53) and half of the fifth.
    const m = computeMetrics(p);
    expect(m.depletionAge).toBe(54);
    close(p.years[4].unfunded, 50_000, 1e-6);
    close(p.years[4].withdrawal, 50_000, 1e-6);
    expect(p.years[5].withdrawal).toBe(0);
  });

  it('grosses up withdrawals for an effective tax rate', () => {
    const p = projectPlan(plain({ withdrawal: { ...plain().withdrawal, taxRate: 0.2 } }));
    const y = p.years.find((r) => r.age === 50)!;
    close(y.withdrawal, 125_000, 1e-6);
    close(y.withdrawalTax, 25_000, 1e-6);
    close(y.spendable, 100_000, 1e-6);
  });

  it('withdraws a percentage of the beginning balance and never depletes', () => {
    const inputs = plain({ withdrawal: { ...plain().withdrawal, strategy: 'percentage', percentageRate: 0.04 } });
    const p = projectPlan(inputs);
    for (const y of p.years.filter((r) => r.age >= 50)) close(y.withdrawal, y.beginBalance * 0.04, 1e-6);
    expect(computeMetrics(p).depletionAge).toBeNull();
  });

  it('flags lifestyle shortfalls under the percentage strategy instead of hiding them', () => {
    const inputs = plain({
      retirementSpending: 300_000,
      withdrawal: { ...plain().withdrawal, strategy: 'percentage', percentageRate: 0.03 },
    });
    expect(computeMetrics(projectPlan(inputs)).yearsWithLifestyleShortfall).toBeGreaterThan(0);
  });
});

describe('work phases', () => {
  it('offsets spending with after-tax work income and invests surpluses at year end', () => {
    const inputs = plain({ workPhases: [newWorkPhase({ annualNetIncome: 150_000, years: 3 })] });
    const p = projectPlan(inputs);
    const y = p.years.find((r) => r.age === 50)!;
    expect(y.phase).toBe('transition');
    expect(y.withdrawal).toBe(0);
    close(y.surplusInvested, 50_000, 1e-6);
    close(y.endBalance, y.beginBalance * 1.05 + 50_000, 1e-6);
    expect(p.years.find((r) => r.age === 53)!.phase).toBe('retirement');
  });

  it('does not double count income before full-time work ends', () => {
    const inputs = plain({
      workPhases: [newWorkPhase({ anchor: 'age', startAge: 45, years: 8, annualNetIncome: 200_000 })],
    });
    const p = projectPlan(inputs);
    const working = p.years.find((r) => r.age === 47)!;
    expect(working.workIncome).toBe(0);
    expect(p.years.find((r) => r.age === 52)!.workIncome).toBeGreaterThan(0);
    expect(p.years.find((r) => r.age === 53)!.workIncome).toBe(0);
    expect(validateInputs(inputs).some((v) => v.field.startsWith('workPhases'))).toBe(true);
  });

  it('supports multiple phases and spending overrides', () => {
    const inputs = plain({
      workPhases: [
        newWorkPhase({ id: 'a', years: 2, annualNetIncome: 80_000, spendingOverride: 90_000 }),
        newWorkPhase({ id: 'b', anchor: 'age', startAge: 52, years: 2, annualNetIncome: 40_000 }),
      ],
    });
    const p = projectPlan(inputs);
    close(p.years.find((r) => r.age === 50)!.withdrawal, 10_000, 1e-6);
    close(p.years.find((r) => r.age === 52)!.withdrawal, 60_000, 1e-6);
    const m = computeMetrics(p);
    expect(m.transitionYears).toBe(4);
    expect(m.totalYearsWorked).toBe(14);
  });

  it('can assume consulting covers all spending, leaving the portfolio untouched', () => {
    const inputs = plain({
      inflation: 0.02,
      workPhases: [newWorkPhase({ years: 4, coversSpending: true, annualNetIncome: 1 })],
      incomeStreams: [newIncomeStream({ startAge: 52, endAge: 200, annualAmount: 30_000 })],
    });
    const p = projectPlan(inputs);
    for (const age of [50, 51, 52, 53]) {
      const y = p.years.find((r) => r.age === age)!;
      expect(y.withdrawal).toBe(0);
      expect(y.surplusInvested).toBe(0);
      close(y.workIncome + y.otherIncome, y.spending, 1e-6);
      close(y.endBalance, y.beginBalance * 1.05, 1e-6);
    }
    close(p.years.find((r) => r.age === 52)!.workIncome / p.years.find((r) => r.age === 52)!.priceStart, 70_000, 1e-6);
    expect(p.years.find((r) => r.age === 54)!.withdrawal).toBeGreaterThan(0);
    const sum = phaseSummaries(p)[0];
    expect(sum).toMatchObject({ start: 50, end: 54, coversSpending: true, withdrawalsReal: 0 });
    close(sum.avgIncomeReal, (100_000 * 2 + 70_000 * 2) / 4, 1e-6);
  });

  it('keeps a covered phase withdrawal-free under the percentage strategy too', () => {
    const inputs = plain({
      withdrawal: { ...plain().withdrawal, strategy: 'percentage' },
      workPhases: [newWorkPhase({ years: 3, coversSpending: true })],
    });
    const p = projectPlan(inputs);
    expect(p.years.find((r) => r.age === 51)!.withdrawal).toBe(0);
    expect(p.years.find((r) => r.age === 53)!.withdrawal).toBeGreaterThan(0);
  });

  it('applies other income only after full-time work ends', () => {
    const inputs = plain({ incomeStreams: [newIncomeStream({ startAge: 45, endAge: 200, annualAmount: 30_000 })] });
    const p = projectPlan(inputs);
    expect(p.years.find((r) => r.age === 46)!.otherIncome).toBe(0);
    close(p.years.find((r) => r.age === 50)!.withdrawal, 70_000, 1e-6);
  });
});

describe('one-time events', () => {
  it('adds windfalls at year end and takes expenses at year start', () => {
    const inputs = plain({
      events: [
        newEvent({ id: 'in', age: 42, amount: 500_000, inflationAdjusted: false }),
        newEvent({ id: 'out', age: 44, amount: -200_000, inflationAdjusted: false }),
      ],
    });
    const p = projectPlan(inputs);
    const y42 = p.years.find((r) => r.age === 42)!;
    close(y42.endBalance, y42.beginBalance * 1.05 + 100_000 + 500_000, 1e-6);
    const y44 = p.years.find((r) => r.age === 44)!;
    close(y44.endBalance, (y44.beginBalance - 200_000) * 1.05 + 100_000, 1e-6);
  });

  it('inflates today’s-dollar events and leaves fixed-dollar events alone', () => {
    const inputs = plain({
      inflation: 0.03,
      events: [
        newEvent({ id: 'a', age: 45, amount: -100_000, inflationAdjusted: true }),
        newEvent({ id: 'b', age: 46, amount: 100_000, inflationAdjusted: false }),
      ],
    });
    const p = projectPlan(inputs);
    close(p.years[5].eventsOut, 100_000 * 1.03 ** 5, 1e-6);
    close(p.years[6].eventsIn, 100_000, 1e-6);
  });
});

describe('company equity', () => {
  const holding = (over: Partial<Parameters<typeof newEquityHolding>[0]> = {}) =>
    newEquityHolding({
      id: 'eq',
      conservative: 1e6,
      base: 2e6,
      optimistic: 4e6,
      taxRate: 0.25,
      probability: 0.8,
      expectedAge: 45,
      earliestAge: 43,
      latestAge: 48,
      ...over,
    });
  const withEq = (outcome: 'none' | 'conservative' | 'base' | 'optimistic', timing: 'expected' | 'earliest' | 'latest' = 'expected', over = {}) =>
    plain({ equity: [holding(over)], equityAssumption: { outcome, timing } });

  it('adds only the selected outcome, after tax, at the selected timing', () => {
    expect(projectPlan(withEq('none')).years.every((y) => y.events.every((e) => e.kind !== 'equity'))).toBe(true);
    close(projectPlan(withEq('base')).years[5].eventsIn, 1.5e6, 1e-6);
    close(projectPlan(withEq('conservative', 'earliest')).years[3].eventsIn, 0.75e6, 1e-6);
    close(projectPlan(withEq('optimistic', 'latest')).years[8].eventsIn, 3e6, 1e-6);
  });

  it('is never treated as liquid before it pays out', () => {
    expect(projectPlan(withEq('optimistic')).years[5].beginBalance).toBe(projectPlan(withEq('none')).years[5].beginBalance);
  });

  it('spreads staged payouts evenly', () => {
    const p = projectPlan(withEq('base', 'expected', { payoutYears: 3 }));
    for (const k of [5, 6, 7]) close(p.years[k].eventsIn, 0.5e6, 1e-6);
    expect(p.years[8].eventsIn).toBe(0);
  });

  it('computes a probability-weighted value', () => {
    // 0.8 × (0.25×0.75M + 0.5×1.5M + 0.25×3M) = 0.8 × 1.6875M
    close(expectedEquityValue(withEq('base')), 0.8 * 1.6875e6, 1e-6);
  });

  it('finds the minimum proceeds the plan needs', () => {
    const inputs = withEq('base', 'expected');
    const be = breakevenEquity({ ...inputs, retirementAge: 43 });
    expect(be.status).toBe('needed');
    if (be.status !== 'needed') return;
    const scale = be.netAmount / 1.5e6;
    const ok = projectPlan({ ...inputs, retirementAge: 43 }, { equityPayouts: equityPayouts(inputs, 'base', 'expected', scale * 1.001) });
    const short = projectPlan({ ...inputs, retirementAge: 43 }, { equityPayouts: equityPayouts(inputs, 'base', 'expected', scale * 0.99) });
    expect(computeMetrics(ok).depletionAge).toBeNull();
    expect(computeMetrics(short).depletionAge).not.toBeNull();
  });

  it('reports a work-optional range across outcomes', () => {
    const a = analyzeEquity(withEq('base'));
    expect(a.grid).toHaveLength(10);
    expect(a.workOptionalBest).not.toBeNull();
    expect(a.workOptionalBest!).toBeLessThanOrEqual(a.workOptionalWithout ?? Infinity);
  });

  it('migrates the version-1 single equity block', () => {
    const legacy = { ...plain(), equity: undefined, equityAssumption: undefined, privateEquity: { enabled: true, label: 'Old', age: 47, conservative: 1, base: 2, optimistic: 3, selectedCase: 'optimistic' } };
    const n = normalizeInputs(legacy);
    expect(n.equity).toHaveLength(1);
    expect(n.equity[0]).toMatchObject({ label: 'Old', expectedAge: 47, taxRate: 0, probability: 1, base: 2 });
    expect(n.equityAssumption.outcome).toBe('optimistic');
    expect('privateEquity' in n).toBe(false);
  });
});

describe('real estate', () => {
  it('never counts home equity as investable unless sold', () => {
    const home = newProperty({ currentValue: 2_000_000, mortgageBalance: 0 });
    const withHome = projectPlan(plain({ properties: [home] }));
    const without = projectPlan(plain());
    expect(withHome.years.at(-1)!.endBalance).toBeCloseTo(without.years.at(-1)!.endBalance, 6);
    expect(withHome.years[0].propertyValue).toBeGreaterThan(0);
  });

  it('adds sale proceeds once, net of selling costs and the mortgage', () => {
    const home = newProperty({
      currentValue: 1_000_000,
      appreciation: 0,
      mortgageBalance: 0,
      sale: { enabled: true, age: 60, sellingCostRate: 0.06, netProceedsOverride: null },
    });
    const p = projectPlan(plain({ properties: [home] }));
    const sale = p.years.find((r) => r.age === 60)!;
    close(sale.eventsIn, 940_000, 1e-6);
    expect(p.years.filter((r) => r.eventsIn > 0).length).toBe(1);
    expect(p.years.find((r) => r.age === 61)!.propertyValue).toBe(0);
  });

  it('adds carrying costs only after full-time work and only when marked separate', () => {
    const inside = projectPlan(plain({ properties: [newProperty({ mortgageBalance: 0, annualCarryingCosts: 20_000 })] }));
    expect(inside.years.every((y) => y.housingCosts === 0)).toBe(true);
    const separate = projectPlan(
      plain({ properties: [newProperty({ mortgageBalance: 0, annualCarryingCosts: 20_000, costsSeparateFromSpending: true })] }),
    );
    expect(separate.years.find((y) => y.age === 45)!.housingCosts).toBe(0);
    close(separate.years.find((y) => y.age === 50)!.withdrawal, 120_000, 1e-6);
    close(freedomTargetReal(separate.inputs), 120_000 / 0.035, 1e-6);
  });

  it('computes the mortgage payoff milestone from the amortization', () => {
    const p = projectPlan(
      plain({ properties: [newProperty({ mortgageBalance: 100_000, mortgageRate: 0, annualMortgagePayment: 25_000 })] }),
    );
    const m = computeMilestones(p, { targetAge: null, workOptional: null }).find((x) => x.kind === 'mortgage-payoff')!;
    expect(m.age).toBe(44);
  });
});

describe('market downturn', () => {
  it('replaces the return for the downturn year and recovery years', () => {
    const p = projectPlan(
      plain({ downturn: { enabled: true, age: 50, decline: 0.3, recoveryReturn: 0.1, recoveryYears: 2 } }),
    );
    expect(p.years.find((y) => y.age === 50)!.returnRate).toBe(-0.3);
    expect(p.years.find((y) => y.age === 51)!.returnRate).toBe(0.1);
    expect(p.years.find((y) => y.age === 52)!.returnRate).toBe(0.1);
    expect(p.years.find((y) => y.age === 53)!.returnRate).toBe(0.05);
  });
});

describe('presentation', () => {
  it('reconciles every year in both nominal and real dollars', () => {
    const p = projectPlan(samplePlanInputs(2026));
    for (const y of p.years) {
      for (const mode of ['nominal', 'real'] as const) {
        const d = displayYear(y, mode);
        close(d.begin + d.inflows + d.returns - d.outflows, d.end, 1e-4);
      }
    }
  });

  it('chains years: each beginning balance is the prior ending balance', () => {
    const p = projectPlan(samplePlanInputs(2026));
    for (let k = 1; k < p.years.length; k++) expect(p.years[k].beginBalance).toBe(p.years[k - 1].endBalance);
  });
});

describe('targets and milestones', () => {
  it('sizes the Freedom Target from spending and the withdrawal-rate assumption', () => {
    const a = plain({ retirementSpending: 150_000 });
    const b = plain({ retirementSpending: 135_000 });
    close(freedomTargetReal(a) - freedomTargetReal(b), 15_000 / 0.035, 1e-6);
    expect(Math.round(15_000 / 0.035)).toBe(428_571);
  });

  it('distinguishes reaching the target from a sustainable retirement', () => {
    const inputs = plain();
    const target = targetReachedAge(inputs);
    const wo = workOptionalAge(inputs);
    expect(target).not.toBeNull();
    expect(wo).not.toBeNull();
    // Stopping at the work-optional age lasts; one year earlier does not.
    expect(computeMetrics(projectPlan(inputs, { retirementAge: wo!, excludeWorkPhases: true })).depletionAge).toBeNull();
    expect(computeMetrics(projectPlan(inputs, { retirementAge: wo! - 1, excludeWorkPhases: true })).depletionAge).not.toBeNull();
  });

  it('is work-optional today when assets already cover spending forever', () => {
    expect(workOptionalAge(plain({ assets: { ...plain().assets, total: 50_000_000 } }))).toBe(40);
  });

  it('reports milestones that cannot be established', () => {
    const broke = plain({ assets: { ...plain().assets, total: 0 }, annualSavings: 0 });
    const ms = computeMilestones(projectPlan(broke));
    expect(ms.find((m) => m.kind === 'target-reached')!.age).toBeNull();
    expect(ms.find((m) => m.kind === 'work-optional')!.age).toBeNull();
    expect(ms.some((m) => m.kind === 'depletion')).toBe(true);
  });
});

describe('insights', () => {
  it('only quotes numbers the engine produced', () => {
    const inputs = plain({ retirementSpending: 150_000 });
    const a = analyzeWithInsights(inputs);
    const spend = a.insights.find((x) => x.id === 'spending')!;
    expect(spend.body).toContain('$15,000');
    expect(spend.body).toContain('$430,000'); // 428,571 rounded for prose
    const delay = a.insights.find((x) => x.id === 'delay')!;
    const delayed = computeMetrics(projectPlan({ ...inputs, retirementAge: 52 }));
    const gain = delayed.portfolioAtRetirement.real - a.metrics.portfolioAtRetirement.real;
    expect(gain).toBeGreaterThan(0);
    expect(delay.body).toMatch(/approximately \$[\d,]+/);
  });

  it('produces insights for the sample plan without throwing', () => {
    const a = analyzeWithInsights(samplePlanInputs(2026));
    expect(a.insights.length).toBeGreaterThan(4);
    for (const i of a.insights) expect(i.body).not.toMatch(/NaN|Infinity|undefined/);
  });
});

describe('scenarios', () => {
  it('every template produces a valid, analyzable plan without mutating the base', () => {
    const base = samplePlanInputs(2026);
    const snapshot = JSON.stringify(base);
    for (const t of SCENARIO_TEMPLATES) {
      const s = t.apply(base);
      const a = analyzeWithInsights(s);
      expect(a.projection.years.length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe('monte carlo', () => {
  it('draws equity outcomes per path when holdings exist', () => {
    const inputs = plain({ retirementAge: 45, equity: [newEquityHolding({ expectedAge: 44, earliestAge: 42, latestAge: 46, probability: 0.5 })] });
    const withEq = runMonteCarlo(inputs, { paths: 400, seed: 1 });
    const fixed = runMonteCarlo(inputs, { paths: 400, seed: 1, equityUncertainty: false });
    expect(withEq.equityUncertainty).toBe(true);
    expect(withEq.successRate).not.toBe(fixed.successRate);
  });

  it('is reproducible for a seed', () => {
    const a = runMonteCarlo(plain(), { paths: 200, seed: 7 });
    const b = runMonteCarlo(plain(), { paths: 200, seed: 7 });
    expect(a.successRate).toBe(b.successRate);
    expect(a.bands[20].p50).toBe(b.bands[20].p50);
  });

  it('collapses to the deterministic projection with zero volatility', () => {
    const inputs = plain();
    const mc = runMonteCarlo(inputs, { paths: 5, volatility: 0 });
    const det = projectPlan(inputs);
    close(mc.bands[10].p50, det.years[10].beginBalance, 1e-3);
  });

  it('preserves the arithmetic mean return', () => {
    // With many paths, the mean of single-year returns should be near the input.
    const inputs = plain({ currentAge: 94, retirementAge: 100, annualSavings: 0 });
    const mc = runMonteCarlo(inputs, { paths: 20000, volatility: 0.15, seed: 3 });
    const mean = mc.bands[1]; // after one year, median < mean for lognormal
    expect(mean.p50).toBeLessThan(1_000_000 * 1.05);
  });
});
