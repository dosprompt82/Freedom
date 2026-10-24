import { phaseStart } from './projection';
import type { PlanInputs, ValidationIssue } from './types';

/** Hard limits for inputs. The UI uses these for sliders and explains any adjustment. */
export const LIMITS = {
  currentAge: { min: 18, max: 85 },
  retirementAge: { min: 18, max: 90 },
  planningHorizonAge: { min: 60, max: 110 },
  assets: { min: 0, max: 500_000_000 },
  annualSavings: { min: 0, max: 10_000_000 },
  retirementSpending: { min: 0, max: 5_000_000 },
  nominalReturn: { min: -0.05, max: 0.15 },
  inflation: { min: -0.02, max: 0.12 },
  targetRate: { min: 0.01, max: 0.1 },
  percentageRate: { min: 0.005, max: 0.15 },
  taxRate: { min: 0, max: 0.6 },
  savingsRealGrowth: { min: -0.1, max: 0.1 },
  workIncome: { min: 0, max: 5_000_000 },
} as const;

export function validateInputs(inputs: PlanInputs): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (field: string, message: string) => issues.push({ field, severity: 'error', message });
  const warn = (field: string, message: string) => issues.push({ field, severity: 'warning', message });

  if (inputs.retirementAge < inputs.currentAge) {
    err('retirementAge', 'Target retirement age is earlier than your current age. The plan treats you as already retired.');
  }
  if (inputs.planningHorizonAge <= inputs.currentAge) {
    err('planningHorizonAge', 'The planning horizon must be later than your current age.');
  }
  if (inputs.retirementAge > inputs.planningHorizonAge) {
    warn('retirementAge', 'Retirement is after the planning horizon, so no retirement years are modeled.');
  }
  if (inputs.withdrawal.targetRate <= 0) {
    err('withdrawal.targetRate', 'The target withdrawal rate must be above zero.');
  }
  if (inputs.nominalReturn <= inputs.inflation) {
    warn('nominalReturn', 'Your return assumption does not beat inflation, so your portfolio loses purchasing power each year.');
  }
  if (inputs.withdrawal.strategy === 'percentage' && inputs.withdrawal.percentageRate > 0.06) {
    warn('withdrawal.percentageRate', 'Withdrawing more than 6% a year has historically been hard to sustain over long retirements.');
  }

  for (const p of inputs.workPhases) {
    const s = phaseStart(p, inputs.retirementAge);
    if (p.anchor === 'age' && s < inputs.retirementAge) {
      warn(
        `workPhases.${p.id}`,
        `“${p.label}” starts before full-time work ends at ${inputs.retirementAge}. Years before then are ignored, because your annual savings already reflect your earnings.`,
      );
    }
  }
  for (const s of inputs.incomeStreams) {
    if (s.endAge <= s.startAge) warn(`incomeStreams.${s.id}`, `“${s.label}” ends before it starts.`);
    else if (s.startAge < inputs.retirementAge) {
      warn(
        `incomeStreams.${s.id}`,
        `“${s.label}” starts before full-time work ends. Income before ${inputs.retirementAge} is assumed to already be in your annual savings.`,
      );
    }
  }
  for (const e of inputs.events) {
    if (e.age < inputs.currentAge || e.age > inputs.planningHorizonAge) {
      warn(`events.${e.id}`, `“${e.label}” falls outside the planning window and is ignored.`);
    }
  }
  for (const p of inputs.properties) {
    if (p.mortgageBalance > 0 && p.annualMortgagePayment <= p.mortgageBalance * p.mortgageRate) {
      warn(`properties.${p.id}`, `The payment on “${p.label}” does not cover interest, so the balance never falls.`);
    }
    if (p.sale.enabled && (p.sale.age < inputs.currentAge || p.sale.age > inputs.planningHorizonAge)) {
      warn(`properties.${p.id}`, `The sale of “${p.label}” falls outside the planning window and is ignored.`);
    }
  }
  const pe = inputs.privateEquity;
  if (pe.enabled && !(pe.conservative <= pe.base && pe.base <= pe.optimistic)) {
    warn('privateEquity', 'Equity cases are usually ordered conservative ≤ base ≤ optimistic.');
  }
  return issues;
}
