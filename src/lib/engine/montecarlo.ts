import { sampleEquityPayouts } from './equity';
import { depletionAge } from './metrics';
import { projectPlan } from './projection';
import type { PlanInputs } from './types';

/**
 * Monte Carlo simulation (beta).
 *
 * Model: each year's nominal portfolio return is drawn independently from a
 * lognormal distribution whose arithmetic mean equals the plan's nominal
 * return and whose standard deviation equals `volatility`. Inflation is held
 * at the plan's assumption in every path, so real returns and nominal returns
 * stay coherent with the deterministic projection.
 *
 * Limitations (shown in the UI): independent annual draws ignore momentum and
 * mean reversion, there is no correlation between inflation and returns,
 * lognormal tails are thinner than historical crashes, and the result depends
 * entirely on the mean and volatility you choose. It is an illustration of
 * dispersion, not a forecast.
 *
 * Equity holdings are drawn per path too: whether a liquidity event happens
 * (its probability), which outcome (25% conservative / 50% base / 25%
 * optimistic) and when (uniform across the earliest–latest window).
 */

/** Mulberry32: small, fast, seedable PRNG. Deterministic for a given seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller. */
export function normal(rand: () => number): number {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface MonteCarloOptions {
  paths?: number;
  volatility?: number;
  seed?: number;
  /** Draw each equity holding's payout (whether, how much, when) per path. Default true. */
  equityUncertainty?: boolean;
}

export interface MonteCarloResult {
  paths: number;
  volatility: number;
  seed: number;
  /** Whether equity outcomes were drawn per path. */
  equityUncertainty: boolean;
  /** Share of paths that fund planned spending through the planning horizon. */
  successRate: number;
  /** Real (today's dollars) balance percentiles on reaching each age. */
  bands: { age: number; p10: number; p25: number; p50: number; p75: number; p90: number }[];
  medianDepletionAge: number | null;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function runMonteCarlo(inputs: PlanInputs, opts: MonteCarloOptions = {}): MonteCarloResult {
  const paths = Math.max(1, Math.floor(opts.paths ?? 2000));
  const volatility = Math.max(0, opts.volatility ?? 0.15);
  const seed = opts.seed ?? 50;
  const rand = mulberry32(seed);
  const periods = Math.max(0, inputs.planningHorizonAge - inputs.currentAge + 1);

  const m = inputs.nominalReturn;
  const s2 = Math.log(1 + (volatility * volatility) / ((1 + m) * (1 + m)));
  const mu = Math.log(1 + m) - s2 / 2;
  const s = Math.sqrt(s2);

  const balances: number[][] = Array.from({ length: periods + 1 }, () => []);
  let successes = 0;
  const depletions: number[] = [];
  const seq = new Array<number>(periods);
  const drawEquity = (opts.equityUncertainty ?? true) && inputs.equity.length > 0;

  for (let k = 0; k < paths; k++) {
    for (let t = 0; t < periods; t++) seq[t] = Math.exp(mu + s * normal(rand)) - 1;
    const p = projectPlan(inputs, {
      returnSequence: seq,
      equityPayouts: drawEquity ? sampleEquityPayouts(inputs, rand) : undefined,
    });
    const dep = depletionAge(p);
    if (dep == null) successes++;
    else depletions.push(dep);
    p.years.forEach((y, t) => balances[t].push(y.beginBalance / y.priceStart));
    const last = p.years[p.years.length - 1];
    if (last) balances[periods].push(last.endBalance / last.priceEnd);
  }

  const bands = balances.map((vals, t) => {
    const sorted = vals.slice().sort((a, b) => a - b);
    return {
      age: inputs.currentAge + t,
      p10: percentile(sorted, 0.1),
      p25: percentile(sorted, 0.25),
      p50: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      p90: percentile(sorted, 0.9),
    };
  });

  depletions.sort((a, b) => a - b);
  return {
    paths,
    volatility,
    seed,
    equityUncertainty: drawEquity,
    successRate: successes / paths,
    bands,
    medianDepletionAge: depletions.length > paths / 2 ? depletions[Math.floor(paths / 2)] : null,
  };
}
