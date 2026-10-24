import { defaultInputs, newEquityHolding } from './defaults';
import type { EquityCase, PlanInputs } from './types';

interface LegacyPrivateEquity {
  enabled?: boolean;
  label?: string;
  age?: number;
  conservative?: number;
  base?: number;
  optimistic?: number;
  selectedCase?: EquityCase;
  inflationAdjusted?: boolean;
}

/**
 * Bring saved or imported inputs up to the current shape. Missing fields take
 * defaults, and the single `privateEquity` block from version 1 becomes an
 * equity holding (its amounts were already after tax, so taxRate is 0).
 */
export function normalizeInputs(raw: unknown): PlanInputs {
  const d = defaultInputs();
  const r = (raw ?? {}) as Partial<PlanInputs> & { privateEquity?: LegacyPrivateEquity };
  const inputs: PlanInputs = {
    ...d,
    ...r,
    assets: { ...d.assets, ...r.assets },
    withdrawal: { ...d.withdrawal, ...r.withdrawal },
    downturn: { ...d.downturn, ...r.downturn },
    workPhases: r.workPhases ?? [],
    incomeStreams: r.incomeStreams ?? [],
    events: r.events ?? [],
    properties: r.properties ?? [],
    equity: r.equity ?? [],
    equityAssumption: { ...d.equityAssumption, ...r.equityAssumption },
  };
  const legacy = r.privateEquity;
  if (!r.equity && legacy?.enabled) {
    const age = legacy.age ?? d.currentAge + 5;
    inputs.equity = [
      newEquityHolding({
        label: legacy.label ?? 'Equity liquidity event',
        conservative: legacy.conservative ?? 0,
        base: legacy.base ?? 0,
        optimistic: legacy.optimistic ?? 0,
        taxRate: 0,
        probability: 1,
        expectedAge: age,
        earliestAge: age,
        latestAge: age,
        inflationAdjusted: !!legacy.inflationAdjusted,
      }),
    ];
    inputs.equityAssumption = { outcome: legacy.selectedCase ?? 'base', timing: 'expected' };
  }
  delete (inputs as { privateEquity?: unknown }).privateEquity;
  return inputs;
}
