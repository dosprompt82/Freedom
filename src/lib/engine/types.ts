/**
 * Freedom at 50 — financial model types.
 *
 * Conventions (see docs/METHODOLOGY.md for the full write-up):
 * - The model runs in annual periods. Period t = 0 is the current year, when the
 *   household is `currentAge`. Period t covers the year from age (currentAge + t)
 *   to age (currentAge + t + 1).
 * - All money inputs are in TODAY'S DOLLARS unless a field says otherwise.
 *   Internally the engine computes in nominal (future) dollars and reports
 *   both nominal and inflation-adjusted ("real", today's dollars) values.
 * - Rates are decimals: 0.06 means 6%.
 * - Ages are integers; "from age A to age B" means periods with A <= age < B.
 */

export type Rate = number;
export type Dollars = number;

export type WithdrawalStrategy = 'fixed-real' | 'percentage';

export interface AssetBreakdown {
  /** 'total' uses `total`; 'detailed' sums the category fields. */
  mode: 'total' | 'detailed';
  total: Dollars;
  taxable: Dollars;
  traditional: Dollars;
  roth: Dollars;
  cash: Dollars;
  other: Dollars;
}

/**
 * Work after full-time employment ends (consulting, part-time, a board seat...).
 * Income is AFTER-TAX take-home pay in today's dollars. Phases only apply at or
 * after the retirement age: before that, earnings are already reflected in
 * `annualSavings`, so counting them again would double count.
 */
export interface WorkPhase {
  id: string;
  label: string;
  /** 'retirement' starts the phase when full-time work ends; 'age' uses startAge. */
  anchor: 'retirement' | 'age';
  startAge: number;
  years: number;
  annualNetIncome: Dollars;
  /** Real (above-inflation) annual growth of the phase's income. */
  incomeRealGrowth: Rate;
  /** Optional spending (today's $) during this phase, replacing retirement spending. */
  spendingOverride: Dollars | null;
}

/** Non-work income after full-time work ends: pension, Social Security, annuity, rent. */
export interface IncomeStream {
  id: string;
  label: string;
  startAge: number;
  /** Exclusive. Use the planning horizon + 1 for "for life". */
  endAge: number;
  /** After-tax annual amount. Today's $ if inflationAdjusted, else fixed future $. */
  annualAmount: Dollars;
  inflationAdjusted: boolean;
}

export type EventCategory =
  | 'equity'
  | 'inheritance'
  | 'home-sale'
  | 'home-purchase'
  | 'college'
  | 'medical'
  | 'business-sale'
  | 'gift'
  | 'other';

export interface OneTimeEvent {
  id: string;
  label: string;
  category: EventCategory;
  age: number;
  /** Net after-tax amount. Positive = money in, negative = money out. */
  amount: Dollars;
  /** true: amount is in today's dollars and grows with inflation. false: fixed future dollars. */
  inflationAdjusted: boolean;
  /** Free-text note on the tax assumption (the engine does not compute taxes on events). */
  taxNote: string;
}

export interface Property {
  id: string;
  label: string;
  isPrimaryResidence: boolean;
  currentValue: Dollars;
  /** Nominal annual appreciation. */
  appreciation: Rate;
  mortgageBalance: Dollars;
  mortgageRate: Rate;
  /** Principal + interest per year, fixed nominal dollars. */
  annualMortgagePayment: Dollars;
  /** Taxes, insurance, maintenance, HOA per year, today's dollars. */
  annualCarryingCosts: Dollars;
  /**
   * When true, mortgage payments and carrying costs are paid from the portfolio
   * after full-time work ends, IN ADDITION to the retirement spending target.
   * When false (default) they are assumed to be inside the spending target.
   * While working full-time they are always assumed to be covered by income
   * (annual savings is already net of household costs).
   */
  costsSeparateFromSpending: boolean;
  sale: {
    enabled: boolean;
    /** The sale closes at the end of the year the household is this age. */
    age: number;
    sellingCostRate: Rate;
    /** Optional explicit net proceeds in future dollars (after costs, mortgage payoff and taxes). */
    netProceedsOverride: Dollars | null;
  };
}

export type EquityCase = 'none' | 'conservative' | 'base' | 'optimistic';
export type EquityTiming = 'expected' | 'earliest' | 'latest';

export type EquityKind =
  | 'private-company'
  | 'rsu'
  | 'options'
  | 'carried-interest'
  | 'business'
  | 'other';

/**
 * Wealth that is real but not yet spendable: vested private company shares,
 * unvested RSUs, options, carried interest, a stake in a business. It never
 * counts as investable until it pays out, and its size, timing and very
 * existence are uncertain, so it is modeled as a range rather than a number.
 */
export interface EquityHolding {
  id: string;
  label: string;
  kind: EquityKind;
  /** Pre-tax proceeds in each case. Fixed future dollars unless inflationAdjusted. */
  conservative: Dollars;
  base: Dollars;
  optimistic: Dollars;
  /** Effective tax on the proceeds (0 when the amounts are already after tax). */
  taxRate: Rate;
  /** Chance that a liquidity event happens at all within the window (0–1). */
  probability: Rate;
  /** Most likely age at which proceeds start, and the plausible window around it. */
  expectedAge: number;
  earliestAge: number;
  latestAge: number;
  /** Proceeds arrive in equal parts over this many years (1 = lump sum). */
  payoutYears: number;
  inflationAdjusted: boolean;
}

/** Which outcome the main projection assumes for every holding. */
export interface EquityAssumption {
  outcome: EquityCase;
  timing: EquityTiming;
}

export interface MarketDownturn {
  enabled: boolean;
  /** Age at which the decline happens (the full year's return is replaced). */
  age: number;
  /** Positive decimal: 0.3 = a 30% fall. */
  decline: Rate;
  /** Nominal return for the years right after the downturn. */
  recoveryReturn: Rate;
  /** How many years use recoveryReturn before reverting to the base return. */
  recoveryYears: number;
}

export interface WithdrawalSettings {
  strategy: WithdrawalStrategy;
  /** Used by the 'percentage' strategy: share of the beginning balance withdrawn each year. */
  percentageRate: Rate;
  /** Initial withdrawal-rate heuristic used to size the Freedom Target (default 3.5%). */
  targetRate: Rate;
  /** Optional effective tax rate on portfolio withdrawals (0 = not modeled). */
  taxRate: Rate;
}

export interface PlanInputs {
  currentAge: number;
  /** Age at which full-time work ends (withdrawals may begin). */
  retirementAge: number;
  /** Last age modeled; the projection runs through the end of this year of life. */
  planningHorizonAge: number;
  /** Calendar year in which the household is currentAge. */
  startYear: number;

  assets: AssetBreakdown;

  /** Net amount added to investments per year while working full-time (today's $). */
  annualSavings: Dollars;
  /** Real (above-inflation) annual growth of savings. */
  savingsRealGrowth: Rate;
  /** Optional after-tax full-time take-home pay (today's $), used only for earned-income totals. */
  fullTimeNetIncome: Dollars | null;

  /** After-tax annual retirement lifestyle budget, today's dollars. */
  retirementSpending: Dollars;
  withdrawal: WithdrawalSettings;

  /** Nominal annual portfolio return. */
  nominalReturn: Rate;
  inflation: Rate;

  workPhases: WorkPhase[];
  incomeStreams: IncomeStream[];
  events: OneTimeEvent[];
  properties: Property[];
  equity: EquityHolding[];
  equityAssumption: EquityAssumption;
  downturn: MarketDownturn;
}

export type LifePhase = 'accumulation' | 'transition' | 'retirement';

export interface YearEvent {
  label: string;
  kind: 'event' | 'equity' | 'property-sale' | 'downturn';
  /** Nominal dollars. */
  amount: Dollars;
}

/** One modeled year. Every money field is NOMINAL; use `toReal` helpers for today's dollars. */
export interface ProjectionYear {
  t: number;
  age: number;
  year: number;
  phase: LifePhase;
  /** Cumulative inflation at the start of the year: (1 + i)^t. */
  priceStart: number;
  /** Cumulative inflation at the end of the year: (1 + i)^(t + 1). */
  priceEnd: number;
  returnRate: Rate;

  beginBalance: Dollars;
  /** Savings added at year end while working full-time. */
  contributions: Dollars;
  /** After-tax work income from transition phases. */
  workIncome: Dollars;
  /** Pensions and other non-work income. */
  otherIncome: Dollars;
  /** Lifestyle spending target for the year (after full-time work ends). */
  spending: Dollars;
  /** Housing costs paid from the portfolio in addition to spending. */
  housingCosts: Dollars;
  /** Gross amount taken from the portfolio at the start of the year (incl. tax). */
  withdrawal: Dollars;
  /** Portion of withdrawal assumed to go to taxes. */
  withdrawalTax: Dollars;
  /** Income above spending, invested at year end. */
  surplusInvested: Dollars;
  eventsIn: Dollars;
  eventsOut: Dollars;
  /** Outflows actually paid from the portfolio (withdrawal + expenses, capped at the balance). */
  fundedOutflows: Dollars;
  investmentReturn: Dollars;
  endBalance: Dollars;
  /** Money available to spend this year (withdrawal net of tax + income). */
  spendable: Dollars;
  /** Spending or expenses the portfolio could not fund. */
  unfunded: Dollars;
  /** For the percentage strategy: how far spendable falls short of the spending target. */
  lifestyleShortfall: Dollars;

  propertyValue: Dollars;
  mortgageBalance: Dollars;
  events: YearEvent[];
}

export interface Projection {
  inputs: PlanInputs;
  years: ProjectionYear[];
  /** Freedom target in today's dollars (annual spending need / target withdrawal rate). */
  freedomTargetReal: Dollars;
  /** Inputs to the target, for transparent display. */
  freedomTargetBasis: { spending: Dollars; housing: Dollars; rate: Rate };
}

export type DollarMode = 'real' | 'nominal';

export interface MoneyPair {
  real: Dollars;
  nominal: Dollars;
}

export interface PlanMetrics {
  portfolioAtRetirement: MoneyPair;
  portfolioAt65: MoneyPair | null;
  portfolioAt80: MoneyPair | null;
  portfolioAtHorizon: MoneyPair;
  freedomTarget: MoneyPair;
  /** portfolioAtRetirement - freedomTarget (positive = surplus). */
  fundingGap: MoneyPair;
  /** First age with spending or expenses the portfolio could not cover. */
  depletionAge: number | null;
  fullTimeYears: number;
  transitionYears: number;
  totalYearsWorked: number;
  /** Earned after-tax income from now on, in today's dollars (null if full-time pay unknown). */
  totalEarnedIncomeReal: Dollars | null;
  transitionIncomeReal: Dollars;
  totalWithdrawalsReal: Dollars;
  /** Withdrawals during the first five years after full-time work ends, today's $. */
  earlyRetirementWithdrawalsReal: Dollars;
  /** Initial withdrawal rate in the first full year after full-time work ends. */
  initialWithdrawalRate: Rate | null;
  totalUnfundedReal: Dollars;
  yearsWithLifestyleShortfall: number;
}

export type MilestoneKind =
  | 'target-reached'
  | 'work-optional'
  | 'retirement'
  | 'phase-start'
  | 'phase-end'
  | 'equity'
  | 'event'
  | 'property-sale'
  | 'mortgage-payoff'
  | 'downturn'
  | 'depletion'
  | 'horizon';

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  label: string;
  /** null when the milestone could not be established within the horizon. */
  age: number | null;
  year: number | null;
  detail: string;
  tone: 'positive' | 'neutral' | 'caution' | 'negative';
}

export type InsightTone = 'positive' | 'neutral' | 'caution' | 'negative';

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
}

export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}
