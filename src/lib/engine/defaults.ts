import type {
  EquityHolding,
  IncomeStream,
  OneTimeEvent,
  PlanInputs,
  Property,
  WorkPhase,
} from './types';

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export const DEFAULTS = {
  nominalReturn: 0.06,
  inflation: 0.025,
  percentageRate: 0.04,
  planningHorizonAge: 95,
} as const;

/** Sensible starting point for a new plan, before onboarding answers are applied. */
export function defaultInputs(startYear = new Date().getFullYear()): PlanInputs {
  return {
    currentAge: 42,
    retirementAge: 52,
    planningHorizonAge: DEFAULTS.planningHorizonAge,
    startYear,
    assets: { mode: 'total', total: 1_500_000, taxable: 0, traditional: 0, roth: 0, cash: 0, other: 0 },
    annualSavings: 120_000,
    savingsRealGrowth: 0,
    fullTimeNetIncome: null,
    retirementSpending: 160_000,
    withdrawal: {
      strategy: 'fixed-real',
      percentageRate: DEFAULTS.percentageRate,
      taxRate: 0,
    },
    nominalReturn: DEFAULTS.nominalReturn,
    inflation: DEFAULTS.inflation,
    workPhases: [],
    incomeStreams: [],
    events: [],
    properties: [],
    equity: [],
    equityAssumption: { outcome: 'base', timing: 'expected' },
    downturn: {
      enabled: false,
      age: 52,
      decline: 0.3,
      recoveryReturn: DEFAULTS.nominalReturn,
      recoveryYears: 0,
    },
  };
}

export function newWorkPhase(partial: Partial<WorkPhase> = {}): WorkPhase {
  return {
    id: uid('phase'),
    label: 'Consulting',
    anchor: 'retirement',
    startAge: 50,
    years: 5,
    annualNetIncome: 120_000,
    incomeRealGrowth: 0,
    spendingOverride: null,
    coversSpending: false,
    ...partial,
  };
}

export function newIncomeStream(partial: Partial<IncomeStream> = {}): IncomeStream {
  return {
    id: uid('income'),
    label: 'Social Security',
    startAge: 67,
    endAge: 200,
    annualAmount: 40_000,
    inflationAdjusted: true,
    ...partial,
  };
}

export function newEvent(partial: Partial<OneTimeEvent> = {}): OneTimeEvent {
  return {
    id: uid('event'),
    label: 'College tuition',
    category: 'college',
    age: 50,
    amount: -120_000,
    inflationAdjusted: true,
    taxNote: '',
    ...partial,
  };
}

export function newEquityHolding(partial: Partial<EquityHolding> = {}): EquityHolding {
  return {
    id: uid('equity'),
    label: 'Company equity',
    kind: 'private-company',
    conservative: 1_000_000,
    base: 2_000_000,
    optimistic: 3_500_000,
    taxRate: 0.25,
    probability: 0.75,
    expectedAge: 48,
    earliestAge: 46,
    latestAge: 52,
    payoutYears: 1,
    inflationAdjusted: false,
    requiresEmployment: false,
    ...partial,
  };
}

export function newProperty(partial: Partial<Property> = {}): Property {
  return {
    id: uid('property'),
    label: 'Primary home',
    isPrimaryResidence: true,
    currentValue: 1_400_000,
    appreciation: 0.03,
    mortgageBalance: 650_000,
    mortgageRate: 0.0325,
    annualMortgagePayment: 48_000,
    annualCarryingCosts: 28_000,
    costsSeparateFromSpending: false,
    sale: { enabled: false, age: 60, sellingCostRate: 0.06, netProceedsOverride: null },
    ...partial,
  };
}

/**
 * The "Explore a Sample Plan" household: a 44-year-old consulting partner and
 * spouse with a liquidity event on the horizon. Entirely fictional.
 */
export function samplePlanInputs(startYear = new Date().getFullYear()): PlanInputs {
  const base = defaultInputs(startYear);
  return {
    ...base,
    currentAge: 44,
    retirementAge: 50,
    assets: {
      mode: 'detailed',
      total: 0,
      taxable: 1_150_000,
      traditional: 1_050_000,
      roth: 240_000,
      cash: 160_000,
      other: 0,
    },
    annualSavings: 180_000,
    savingsRealGrowth: 0.01,
    fullTimeNetIncome: 420_000,
    retirementSpending: 205_000,
    withdrawal: { ...base.withdrawal, taxRate: 0.15 },
    workPhases: [
      newWorkPhase({
        id: 'sample_phase_consulting',
        label: 'Independent consulting',
        anchor: 'retirement',
        years: 5,
        annualNetIncome: 140_000,
      }),
    ],
    incomeStreams: [
      newIncomeStream({ id: 'sample_ss', label: 'Social Security (household)', startAge: 67, annualAmount: 52_000 }),
    ],
    events: [
      newEvent({ id: 'sample_college_1', label: 'College — first child', age: 47, amount: -160_000 }),
      newEvent({ id: 'sample_college_2', label: 'College — second child', age: 50, amount: -170_000 }),
      newEvent({
        id: 'sample_downsize',
        label: 'Buy smaller home',
        category: 'home-purchase',
        age: 62,
        amount: -950_000,
        taxNote: 'Paid in cash from sale proceeds',
      }),
    ],
    properties: [
      newProperty({
        id: 'sample_home',
        label: 'Family home',
        currentValue: 1_650_000,
        mortgageBalance: 720_000,
        mortgageRate: 0.03,
        annualMortgagePayment: 52_000,
        annualCarryingCosts: 32_000,
        sale: { enabled: true, age: 62, sellingCostRate: 0.06, netProceedsOverride: null },
      }),
    ],
    equity: [
      newEquityHolding({
        id: 'sample_equity',
        label: 'Firm equity buyout',
        kind: 'private-company',
        conservative: 600_000,
        base: 1_200_000,
        optimistic: 2_400_000,
        taxRate: 0.25,
        probability: 0.8,
        expectedAge: 49,
        earliestAge: 47,
        latestAge: 53,
      }),
    ],
  };
}
