import type { AssetBreakdown, Rate } from './types';

/** Exact Fisher relationship: (1 + nominal) / (1 + inflation) - 1. */
export function realReturn(nominal: Rate, inflation: Rate): Rate {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** Inverse of realReturn. */
export function nominalFromReal(real: Rate, inflation: Rate): Rate {
  return (1 + real) * (1 + inflation) - 1;
}

/** Cumulative growth factor (1 + rate)^years. */
export function growth(rate: Rate, years: number): number {
  return Math.pow(1 + rate, years);
}

/** Convert a nominal amount `years` from now to today's dollars. */
export function toToday(nominal: number, inflation: Rate, years: number): number {
  return nominal / growth(inflation, years);
}

/** Convert today's dollars to nominal dollars `years` from now. */
export function toFuture(real: number, inflation: Rate, years: number): number {
  return real * growth(inflation, years);
}

export function investableAssets(assets: AssetBreakdown): number {
  if (assets.mode === 'total') return Math.max(0, assets.total);
  return Math.max(
    0,
    assets.taxable + assets.traditional + assets.roth + assets.cash + assets.other,
  );
}

/**
 * Closed-form future value with end-of-year contributions (constant nominal
 * contribution, constant return). Used as a cross-check in tests; the app uses
 * the year-by-year cash-flow model.
 */
export function futureValueEndOfYear(
  present: number,
  contribution: number,
  rate: Rate,
  years: number,
): number {
  if (rate === 0) return present + contribution * years;
  const g = growth(rate, years);
  return present * g + contribution * ((g - 1) / rate);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
