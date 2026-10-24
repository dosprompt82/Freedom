import { growth } from './math';
import { balanceAtAge, phaseEnd, phaseStart, projectPlan } from './projection';
import type { MoneyPair, PlanInputs, PlanMetrics, Projection } from './types';

function pair(projection: Projection, age: number): MoneyPair | null {
  const real = balanceAtAge(projection, age, 'real');
  const nominal = balanceAtAge(projection, age, 'nominal');
  if (real == null || nominal == null) return null;
  return { real, nominal };
}

function horizonPair(projection: Projection): MoneyPair {
  const last = projection.years[projection.years.length - 1];
  if (!last) return { real: 0, nominal: 0 };
  return { real: last.endBalance / last.priceEnd, nominal: last.endBalance };
}

/** Earliest age with spending or an expense the portfolio could not fund. */
export function depletionAge(projection: Projection): number | null {
  const y = projection.years.find((row) => row.unfunded > 0.5);
  return y ? y.age : null;
}

export function computeMetrics(projection: Projection): PlanMetrics {
  const { inputs, years } = projection;
  const ret = inputs.retirementAge;
  const i = inputs.inflation;

  const atRetirement =
    ret > inputs.planningHorizonAge ? horizonPair(projection) : pair(projection, ret) ?? horizonPair(projection);
  const yearsToRet = Math.max(0, ret - inputs.currentAge);
  const targetReal = projection.freedomTargetReal;
  const freedomTarget: MoneyPair = {
    real: targetReal,
    nominal: targetReal * growth(i, yearsToRet),
  };

  const fullTimeYears = Math.max(
    0,
    Math.min(ret, inputs.planningHorizonAge + 1) - inputs.currentAge,
  );
  const transitionYears = years.filter((y) => y.phase === 'transition').length;

  let transitionIncomeReal = 0;
  let totalWithdrawalsReal = 0;
  let earlyRetirementWithdrawalsReal = 0;
  let totalUnfundedReal = 0;
  let yearsWithLifestyleShortfall = 0;
  for (const y of years) {
    transitionIncomeReal += y.workIncome / y.priceStart;
    totalWithdrawalsReal += y.withdrawal / y.priceStart;
    if (y.age >= ret && y.age < ret + 5) earlyRetirementWithdrawalsReal += y.withdrawal / y.priceStart;
    totalUnfundedReal += y.unfunded / y.priceStart;
    if (y.lifestyleShortfall > 0.5) yearsWithLifestyleShortfall++;
  }

  let totalEarnedIncomeReal: number | null = null;
  if (inputs.fullTimeNetIncome != null) {
    let ft = 0;
    for (let t = 0; t < fullTimeYears; t++) {
      ft += inputs.fullTimeNetIncome * growth(inputs.savingsRealGrowth, t);
    }
    totalEarnedIncomeReal = ft + transitionIncomeReal;
  }

  const firstRetYear = years.find((y) => y.age === ret);
  const initialWithdrawalRate =
    firstRetYear && firstRetYear.beginBalance > 0
      ? firstRetYear.withdrawal / firstRetYear.beginBalance
      : null;

  return {
    portfolioAtRetirement: atRetirement,
    portfolioAt65: pair(projection, 65),
    portfolioAt80: pair(projection, 80),
    portfolioAtHorizon: horizonPair(projection),
    freedomTarget,
    fundingGap: {
      real: atRetirement.real - freedomTarget.real,
      nominal: atRetirement.nominal - freedomTarget.nominal,
    },
    depletionAge: depletionAge(projection),
    fullTimeYears,
    transitionYears,
    totalYearsWorked: fullTimeYears + transitionYears,
    totalEarnedIncomeReal,
    transitionIncomeReal,
    totalWithdrawalsReal,
    earlyRetirementWithdrawalsReal,
    initialWithdrawalRate,
    totalUnfundedReal,
    yearsWithLifestyleShortfall,
  };
}

/**
 * First age at which the household's portfolio, if it kept working and saving
 * as planned, would reach the Freedom Target (compared in today's dollars).
 * This is the withdrawal-rate heuristic only — not a test of sustainability.
 */
export function targetReachedAge(inputs: PlanInputs): number | null {
  const keepWorking = projectPlan(inputs, {
    retirementAge: inputs.planningHorizonAge + 1,
    excludeWorkPhases: true,
  });
  const target = keepWorking.freedomTargetReal;
  if (!Number.isFinite(target)) return null;
  for (const y of keepWorking.years) {
    if (y.beginBalance / y.priceStart >= target) return y.age;
  }
  const last = keepWorking.years[keepWorking.years.length - 1];
  if (last && last.endBalance / last.priceEnd >= target) return last.age + 1;
  return null;
}

/**
 * Deterministic work-optional test: the earliest age at which the household
 * could stop ALL paid work (no consulting or part-time phases), spend its
 * fixed real retirement budget, and never run short through the planning
 * horizon under the plan's return, inflation, event and income assumptions.
 * This is a single-path stress-free projection, not a probability.
 */
export function workOptionalAge(inputs: PlanInputs): number | null {
  for (let age = inputs.currentAge; age <= inputs.planningHorizonAge; age++) {
    const p = projectPlan(inputs, {
      retirementAge: age,
      strategy: 'fixed-real',
      excludeWorkPhases: true,
    });
    if (depletionAge(p) == null) return age;
  }
  return null;
}

/** Whether the plan as entered (with its own strategy and work phases) funds spending to the horizon. */
export function planIsFunded(projection: Projection): boolean {
  return depletionAge(projection) == null;
}

export function workPhaseWindows(inputs: PlanInputs) {
  return inputs.workPhases
    .filter((p) => p.years > 0)
    .map((p) => {
      const start = Math.max(phaseStart(p, inputs.retirementAge), inputs.retirementAge);
      const end = phaseEnd(p, inputs.retirementAge);
      return { phase: p, start, end, ignoredBeforeRetirement: phaseStart(p, inputs.retirementAge) < inputs.retirementAge };
    })
    .filter((w) => w.end > w.start);
}

export interface PhaseSummary {
  phaseId: string;
  label: string;
  start: number;
  end: number;
  coversSpending: boolean;
  /** Average after-tax work income per year during the phase, today's dollars. */
  avgIncomeReal: number;
  /** Highest single-year income needed (today's dollars), e.g. when housing costs end. */
  maxIncomeReal: number;
  /** Portfolio on entering and leaving the phase, today's dollars. */
  portfolioStartReal: number | null;
  portfolioEndReal: number | null;
  withdrawalsReal: number;
}

/** What each post-career work phase earns and does to the portfolio, from the projection. */
export function phaseSummaries(projection: Projection): PhaseSummary[] {
  const { inputs } = projection;
  return workPhaseWindows(inputs).map((w) => {
    const rows = projection.years.filter((y) => y.age >= w.start && y.age < w.end);
    const incomes = rows.map((y) => y.workIncome / y.priceStart);
    return {
      phaseId: w.phase.id,
      label: w.phase.label,
      start: w.start,
      end: w.end,
      coversSpending: w.phase.coversSpending,
      avgIncomeReal: incomes.length ? incomes.reduce((a, b) => a + b, 0) / incomes.length : 0,
      maxIncomeReal: incomes.length ? Math.max(...incomes) : 0,
      portfolioStartReal: balanceAtAge(projection, w.start, 'real'),
      portfolioEndReal: balanceAtAge(projection, Math.min(w.end, inputs.planningHorizonAge + 1), 'real'),
      withdrawalsReal: rows.reduce((s, y) => s + y.withdrawal / y.priceStart, 0),
    };
  });
}
