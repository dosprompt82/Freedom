import { newEvent, newWorkPhase } from './defaults';
import type { PlanInputs } from './types';

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  apply: (base: PlanInputs) => PlanInputs;
}

const clone = (p: PlanInputs): PlanInputs => structuredClone(p);

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'retire-50',
    name: 'Retire at 50',
    description: 'Stop full-time work at 50.',
    apply: (b) => ({ ...clone(b), retirementAge: Math.max(50, b.currentAge) }),
  },
  {
    id: 'retire-55',
    name: 'Retire at 55',
    description: 'Stop full-time work at 55.',
    apply: (b) => ({ ...clone(b), retirementAge: Math.max(55, b.currentAge) }),
  },
  {
    id: 'part-time-50-55',
    name: 'Part-time from 50 to 55',
    description: 'Leave full-time work at 50 and consult for five years.',
    apply: (b) => {
      const n = clone(b);
      n.retirementAge = Math.max(50, b.currentAge);
      n.workPhases = [
        newWorkPhase({ label: 'Part-time consulting', anchor: 'age', startAge: n.retirementAge, years: 55 - n.retirementAge > 0 ? 55 - n.retirementAge : 5, annualNetIncome: 120_000 }),
      ];
      return n;
    },
  },
  {
    id: 'equity-none',
    name: 'Equity never pays out',
    description: 'Plan without any company equity proceeds.',
    apply: (b) => ({ ...clone(b), equityAssumption: { ...b.equityAssumption, outcome: 'none' } }),
  },
  {
    id: 'equity-late-conservative',
    name: 'Equity pays less, later',
    description: 'Conservative outcome at the latest plausible age.',
    apply: (b) => ({ ...clone(b), equityAssumption: { outcome: 'conservative', timing: 'latest' } }),
  },
  {
    id: 'equity-optimistic',
    name: 'Equity upside',
    description: 'Optimistic outcome at the expected age.',
    apply: (b) => ({ ...clone(b), equityAssumption: { outcome: 'optimistic', timing: 'expected' } }),
  },
  {
    id: 'bigger-home',
    name: 'Buy a more expensive home',
    description: 'Spend an extra $600K (today’s dollars) on a home in two years and carry $15K more a year.',
    apply: (b) => {
      const n = clone(b);
      n.events = [
        ...n.events,
        newEvent({ label: 'Home upgrade (net cost)', category: 'home-purchase', age: b.currentAge + 2, amount: -600_000 }),
      ];
      n.retirementSpending = b.retirementSpending + 15_000;
      return n;
    },
  },
  {
    id: 'spend-more',
    name: 'Increase retirement spending',
    description: 'Spend 20% more each year in retirement.',
    apply: (b) => ({ ...clone(b), retirementSpending: Math.round(b.retirementSpending * 1.2) }),
  },
  {
    id: 'spend-less',
    name: 'Reduce retirement spending',
    description: 'Spend $15,000 less each year in retirement.',
    apply: (b) => ({ ...clone(b), retirementSpending: Math.max(0, b.retirementSpending - 15_000) }),
  },
  {
    id: 'lower-returns',
    name: 'Lower investment returns',
    description: 'Returns 1.5 percentage points lower every year.',
    apply: (b) => ({ ...clone(b), nominalReturn: b.nominalReturn - 0.015 }),
  },
  {
    id: 'downturn',
    name: 'Market downturn at retirement',
    description: 'A 30% fall in the first year after full-time work ends.',
    apply: (b) => {
      const n = clone(b);
      n.downturn = { enabled: true, age: b.retirementAge, decline: 0.3, recoveryReturn: b.nominalReturn, recoveryYears: 0 };
      return n;
    },
  },
  {
    id: 'delay-2',
    name: 'Delay retirement two years',
    description: 'Work full-time two more years.',
    apply: (b) => ({ ...clone(b), retirementAge: b.retirementAge + 2 }),
  },
];

export function templateById(id: string): ScenarioTemplate | undefined {
  return SCENARIO_TEMPLATES.find((t) => t.id === id);
}
