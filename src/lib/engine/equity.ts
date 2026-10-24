import type { EquityCase, EquityHolding, EquityTiming, PlanInputs } from './types';

/** A resolved liquidity event: net after-tax proceeds spread over `years` from `age`. */
export interface EquityPayout {
  holdingId: string;
  label: string;
  outcome: Exclude<EquityCase, 'none'>;
  age: number;
  years: number;
  /** Total net proceeds (after tax). Future dollars unless inflationAdjusted. */
  netTotal: number;
  inflationAdjusted: boolean;
}

export const OUTCOMES: Exclude<EquityCase, 'none'>[] = ['conservative', 'base', 'optimistic'];
export const TIMINGS: EquityTiming[] = ['earliest', 'expected', 'latest'];

/**
 * Weights used for the probability-weighted value and Monte Carlo draws when a
 * liquidity event happens: conservative 25%, base 50%, optimistic 25%.
 */
export const OUTCOME_WEIGHTS: Record<Exclude<EquityCase, 'none'>, number> = {
  conservative: 0.25,
  base: 0.5,
  optimistic: 0.25,
};

export function netProceeds(h: EquityHolding, outcome: Exclude<EquityCase, 'none'>): number {
  return Math.max(0, h[outcome]) * (1 - Math.min(0.95, Math.max(0, h.taxRate)));
}

export function payoutAge(h: EquityHolding, timing: EquityTiming): number {
  return timing === 'earliest' ? h.earliestAge : timing === 'latest' ? h.latestAge : h.expectedAge;
}

/** Payouts implied by a plan-wide outcome and timing assumption. */
export function equityPayouts(
  inputs: PlanInputs,
  outcome: EquityCase = inputs.equityAssumption.outcome,
  timing: EquityTiming = inputs.equityAssumption.timing,
  scale = 1,
): EquityPayout[] {
  if (outcome === 'none') return [];
  return inputs.equity
    .map((h) => ({
      holdingId: h.id,
      label: h.label,
      outcome,
      age: payoutAge(h, timing),
      years: Math.max(1, Math.round(h.payoutYears)),
      netTotal: netProceeds(h, outcome) * scale,
      inflationAdjusted: h.inflationAdjusted,
    }))
    .filter((p) => p.netTotal > 0);
}

/** Probability-weighted after-tax value of all holdings (future dollars, undiscounted). */
export function expectedEquityValue(inputs: PlanInputs): number {
  return inputs.equity.reduce(
    (sum, h) =>
      sum +
      Math.min(1, Math.max(0, h.probability)) *
        OUTCOMES.reduce((s, o) => s + OUTCOME_WEIGHTS[o] * netProceeds(h, o), 0),
    0,
  );
}

export function totalNet(inputs: PlanInputs, outcome: Exclude<EquityCase, 'none'>): number {
  return inputs.equity.reduce((s, h) => s + netProceeds(h, outcome), 0);
}

/** One random draw of every holding's outcome, for Monte Carlo. */
export function sampleEquityPayouts(inputs: PlanInputs, rand: () => number): EquityPayout[] {
  const out: EquityPayout[] = [];
  for (const h of inputs.equity) {
    if (rand() >= Math.min(1, Math.max(0, h.probability))) continue;
    const u = rand();
    const outcome = u < OUTCOME_WEIGHTS.conservative ? 'conservative' : u < 0.75 ? 'base' : 'optimistic';
    const lo = Math.min(h.earliestAge, h.latestAge);
    const hi = Math.max(h.earliestAge, h.latestAge);
    const age = lo + Math.floor(rand() * (hi - lo + 1));
    const netTotal = netProceeds(h, outcome);
    if (netTotal > 0) {
      out.push({ holdingId: h.id, label: h.label, outcome, age, years: Math.max(1, Math.round(h.payoutYears)), netTotal, inflationAdjusted: h.inflationAdjusted });
    }
  }
  return out;
}
