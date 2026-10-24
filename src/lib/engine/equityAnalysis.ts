import { equityPayouts, expectedEquityValue, OUTCOMES, TIMINGS, totalNet } from './equity';
import { investableAssets } from './math';
import { depletionAge } from './metrics';
import { balanceAtAge, projectPlan } from './projection';
import type { EquityCase, EquityTiming, PlanInputs } from './types';

export interface EquityOutcomeCell {
  outcome: EquityCase;
  timing: EquityTiming;
  /** Total net proceeds in this cell (future dollars unless holdings are inflation-adjusted). */
  netTotal: number;
  workOptional: number | null;
  depletionAge: number | null;
  portfolioAtRetirementReal: number;
  endOfPlanReal: number;
}

export type Breakeven =
  | { status: 'none' }
  | { status: 'not-needed' }
  | { status: 'needed'; netAmount: number; byAge: number }
  | { status: 'insufficient'; netAmount: number; byAge: number };

export interface EquityAnalysis {
  hasEquity: boolean;
  net: Record<'conservative' | 'base' | 'optimistic', number>;
  expectedValue: number;
  /** Base-case net proceeds as a share of today's net worth (investable + equity + home equity). */
  shareOfNetWorth: number;
  /** "none" row plus every outcome × timing. */
  grid: EquityOutcomeCell[];
  /** The minimum equity proceeds the plan as entered needs to last through the horizon. */
  breakeven: Breakeven;
  /** Work-optional age range across all outcomes and timings, and without any payout. */
  workOptionalWithout: number | null;
  workOptionalBest: number | null;
  workOptionalWorst: number | null;
}

function cell(inputs: PlanInputs, outcome: EquityCase, timing: EquityTiming): EquityOutcomeCell {
  const payouts = equityPayouts(inputs, outcome, timing);
  const p = projectPlan(inputs, { equityPayouts: payouts });
  const last = p.years[p.years.length - 1];
  const wo = workOptionalForPayouts(inputs, payouts);
  return {
    outcome,
    timing,
    netTotal: payouts.reduce((s, x) => s + x.netTotal, 0),
    workOptional: wo,
    depletionAge: depletionAge(p),
    portfolioAtRetirementReal: balanceAtAge(p, inputs.retirementAge, 'real') ?? (last ? last.endBalance / last.priceEnd : 0),
    endOfPlanReal: last ? last.endBalance / last.priceEnd : 0,
  };
}

function workOptionalForPayouts(inputs: PlanInputs, payouts: ReturnType<typeof equityPayouts>) {
  for (let age = inputs.currentAge; age <= inputs.planningHorizonAge; age++) {
    const p = projectPlan(inputs, { retirementAge: age, strategy: 'fixed-real', excludeWorkPhases: true, equityPayouts: payouts });
    if (depletionAge(p) == null) return age;
  }
  return null;
}

export function breakevenEquity(inputs: PlanInputs): Breakeven {
  const baseNet = totalNet(inputs, 'base');
  if (!inputs.equity.length || baseNet <= 0) return { status: 'none' };
  const byAge = Math.min(...inputs.equity.map((h) => h.expectedAge));
  const funded = (scale: number) =>
    depletionAge(
      projectPlan(inputs, {
        strategy: 'fixed-real',
        equityPayouts: equityPayouts(inputs, 'base', 'expected', scale),
      }),
    ) == null;
  if (funded(0)) return { status: 'not-needed' };
  let hi = 1;
  while (!funded(hi) && hi < 16) hi *= 2;
  if (!funded(hi)) return { status: 'insufficient', netAmount: baseNet * hi, byAge };
  let lo = 0;
  for (let k = 0; k < 28; k++) {
    const mid = (lo + hi) / 2;
    if (funded(mid)) hi = mid;
    else lo = mid;
  }
  return { status: 'needed', netAmount: baseNet * hi, byAge };
}

export function analyzeEquity(inputs: PlanInputs): EquityAnalysis {
  const net = {
    conservative: totalNet(inputs, 'conservative'),
    base: totalNet(inputs, 'base'),
    optimistic: totalNet(inputs, 'optimistic'),
  };
  const hasEquity = inputs.equity.length > 0 && net.optimistic + net.base + net.conservative > 0;
  const none = cell(inputs, 'none', 'expected');
  if (!hasEquity) {
    return {
      hasEquity,
      net,
      expectedValue: 0,
      shareOfNetWorth: 0,
      grid: [none],
      breakeven: { status: 'none' },
      workOptionalWithout: none.workOptional,
      workOptionalBest: none.workOptional,
      workOptionalWorst: none.workOptional,
    };
  }
  const grid = [none];
  for (const o of OUTCOMES) for (const t of TIMINGS) grid.push(cell(inputs, o, t));

  const homeEquity = inputs.properties.reduce((s, p) => s + Math.max(0, p.currentValue - p.mortgageBalance), 0);
  const worth = investableAssets(inputs.assets) + net.base + homeEquity;
  const ages = grid.slice(1).map((c) => c.workOptional);
  const known = ages.filter((a): a is number => a != null);
  return {
    hasEquity,
    net,
    expectedValue: expectedEquityValue(inputs),
    shareOfNetWorth: worth > 0 ? net.base / worth : 0,
    grid,
    breakeven: breakevenEquity(inputs),
    workOptionalWithout: none.workOptional,
    workOptionalBest: known.length ? Math.min(...known) : null,
    workOptionalWorst: ages.some((a) => a == null) ? null : Math.max(...known),
  };
}

/**
 * The spread of projected balances across every equity outcome and timing,
 * including no payout, for drawing an uncertainty band behind the main line.
 */
export function equityBand(inputs: PlanInputs, mode: 'real' | 'nominal') {
  if (!inputs.equity.length) return [];
  const series: { age: number; value: number }[][] = [];
  const combos: [EquityCase, EquityTiming][] = [['none', 'expected']];
  for (const o of OUTCOMES) for (const t of TIMINGS) combos.push([o, t]);
  for (const [o, t] of combos) {
    const p = projectPlan(inputs, { equityPayouts: equityPayouts(inputs, o, t) });
    series.push(
      p.years.map((y) => ({ age: y.age, value: mode === 'real' ? y.beginBalance / y.priceStart : y.beginBalance })),
    );
  }
  return series[0].map((pt, k) => {
    const vals = series.map((s) => s[k].value);
    return { age: pt.age, lo: Math.min(...vals), hi: Math.max(...vals) };
  });
}
