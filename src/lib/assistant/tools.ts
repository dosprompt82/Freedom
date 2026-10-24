import {
  analyzeEquity,
  analyzePlan,
  displayYear,
  newWorkPhase,
  projectPlan,
  type EquityCase,
  type EquityTiming,
  type PlanInputs,
} from '../engine';
import { formatMoney } from '../format';

/**
 * Tools the assistant can call. They run the same deterministic engine the
 * app uses, so a "what if" answer is computed, not guessed. Shared by the
 * browser (artifact sample tools) and the server route.
 */

export interface AssistantToolSpec {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
}

export const ASSISTANT_TOOLS: AssistantToolSpec[] = [
  {
    name: 'what_if',
    description:
      "Re-run the user's plan with some assumptions changed and return before/after results (work-optional age, Freedom Target age, portfolio at retirement and end of plan, depletion age, equity breakeven). All money in today's dollars. Pass only the fields that change.",
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        retirementAge: { type: 'integer', description: 'Age full-time work ends.' },
        retirementSpending: { type: 'number', description: "Annual after-tax retirement spending, today's dollars." },
        annualSavings: { type: 'number', description: "Annual savings while working full-time, today's dollars." },
        nominalReturn: { type: 'number', description: 'Nominal annual return as a decimal, e.g. 0.05.' },
        inflation: { type: 'number', description: 'Inflation as a decimal, e.g. 0.03.' },
        equityOutcome: { type: 'string', enum: ['none', 'conservative', 'base', 'optimistic'] },
        equityTiming: { type: 'string', enum: ['earliest', 'expected', 'latest'] },
        equityDelayYears: { type: 'integer', description: 'Shift every equity payout (expected/earliest/latest) by this many years.' },
        consultingYears: { type: 'integer', description: 'Years of consulting right after full-time work ends (0 removes it).' },
        consultingCoversSpending: { type: 'boolean', description: 'If true, consulting is assumed to cover all spending.' },
        consultingIncome: { type: 'number', description: "Annual after-tax consulting income, today's dollars (ignored when covering spending)." },
        oneTimeAmount: { type: 'number', description: "Add a one-time cash flow (negative = expense), today's dollars." },
        oneTimeAge: { type: 'integer', description: 'Age of the one-time cash flow.' },
      },
    },
  },
  {
    name: 'year_detail',
    description: "Return the projection for one age in today's dollars: beginning and ending portfolio, contributions, income, spending, withdrawals, investment return, events.",
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { age: { type: 'integer' } },
      required: ['age'],
    },
  },
];

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const int = (v: unknown) => {
  const n = num(v);
  return n == null ? undefined : Math.round(n);
};

function applyChanges(base: PlanInputs, c: Record<string, unknown>): { inputs: PlanInputs; applied: string[] } {
  const p: PlanInputs = structuredClone(base);
  const applied: string[] = [];
  const clampAge = (a: number) => Math.max(p.currentAge, Math.min(p.planningHorizonAge, a));

  const ret = int(c.retirementAge);
  if (ret != null) {
    p.retirementAge = clampAge(ret);
    applied.push(`full-time work ends at ${p.retirementAge}`);
  }
  const spend = num(c.retirementSpending);
  if (spend != null && spend >= 0) {
    p.retirementSpending = spend;
    applied.push(`spending ${formatMoney(spend)}/yr`);
  }
  const save = num(c.annualSavings);
  if (save != null && save >= 0) {
    p.annualSavings = save;
    applied.push(`savings ${formatMoney(save)}/yr`);
  }
  const r = num(c.nominalReturn);
  if (r != null && r > -0.5 && r < 0.5) {
    p.nominalReturn = r;
    applied.push(`return ${(r * 100).toFixed(2)}%`);
  }
  const inf = num(c.inflation);
  if (inf != null && inf > -0.1 && inf < 0.3) {
    p.inflation = inf;
    applied.push(`inflation ${(inf * 100).toFixed(2)}%`);
  }
  const outcome = c.equityOutcome as EquityCase | undefined;
  if (outcome && ['none', 'conservative', 'base', 'optimistic'].includes(outcome)) {
    p.equityAssumption = { ...p.equityAssumption, outcome };
    applied.push(`equity outcome ${outcome}`);
  }
  const timing = c.equityTiming as EquityTiming | undefined;
  if (timing && ['earliest', 'expected', 'latest'].includes(timing)) {
    p.equityAssumption = { ...p.equityAssumption, timing };
    applied.push(`equity timing ${timing}`);
  }
  const delay = int(c.equityDelayYears);
  if (delay) {
    p.equity = p.equity.map((h) => ({ ...h, expectedAge: h.expectedAge + delay, earliestAge: h.earliestAge + delay, latestAge: h.latestAge + delay }));
    applied.push(`equity payouts shifted ${delay > 0 ? '+' : ''}${delay} years`);
  }
  const cy = int(c.consultingYears);
  const covers = typeof c.consultingCoversSpending === 'boolean' ? c.consultingCoversSpending : undefined;
  const cinc = num(c.consultingIncome);
  if (cy != null || covers != null || cinc != null) {
    const existing = p.workPhases.find((w) => w.anchor === 'retirement');
    const others = p.workPhases.filter((w) => w !== existing);
    if (cy === 0) {
      p.workPhases = others;
      applied.push('no consulting');
    } else {
      const phase = existing ?? newWorkPhase({ label: 'Consulting', annualNetIncome: 0, years: 5 });
      const next = {
        ...phase,
        years: cy ?? phase.years,
        coversSpending: covers ?? phase.coversSpending,
        annualNetIncome: cinc ?? phase.annualNetIncome,
      };
      p.workPhases = [...others, next];
      applied.push(`consulting ${next.years} yrs${next.coversSpending ? ' covering all spending' : ` at ${formatMoney(next.annualNetIncome)}/yr`}`);
    }
  }
  const amt = num(c.oneTimeAmount);
  const at = int(c.oneTimeAge);
  if (amt != null && at != null) {
    p.events = [...p.events, { id: 'whatif_event', label: 'What-if cash flow', category: 'other', age: clampAge(at), amount: amt, inflationAdjusted: true, taxNote: '' }];
    applied.push(`one-time ${amt >= 0 ? '+' : '−'}${formatMoney(Math.abs(amt))} at ${clampAge(at)}`);
  }
  return { inputs: p, applied };
}

function summary(inputs: PlanInputs) {
  const a = analyzePlan(inputs);
  const be = inputs.equity.length ? analyzeEquity(inputs).breakeven : null;
  return {
    retirementAge: inputs.retirementAge,
    workOptionalAge: a.workOptional,
    freedomTargetReachedAge: a.targetAge,
    freedomTarget: Math.round(a.metrics.freedomTarget.real),
    portfolioAtRetirement: Math.round(a.metrics.portfolioAtRetirement.real),
    portfolioAt65: a.metrics.portfolioAt65 ? Math.round(a.metrics.portfolioAt65.real) : null,
    portfolioAtEndOfPlan: Math.round(a.metrics.portfolioAtHorizon.real),
    runsShortAtAge: a.metrics.depletionAge,
    equityBreakeven:
      be == null ? null : be.status === 'needed' ? { neededAfterTax: Math.round(be.netAmount), byAge: be.byAge } : be.status,
  };
}

export function executeAssistantTool(name: string, raw: unknown, inputs: PlanInputs): unknown {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (name === 'what_if') {
    const { inputs: changed, applied } = applyChanges(inputs, input);
    if (!applied.length) throw new Error('No recognized changes. Pass at least one field.');
    return { units: "today's dollars", changesApplied: applied, before: summary(inputs), after: summary(changed) };
  }
  if (name === 'year_detail') {
    const age = int(input.age);
    const y = projectPlan(inputs).years.find((r) => r.age === age);
    if (!y) throw new Error(`Age must be between ${inputs.currentAge} and ${inputs.planningHorizonAge}.`);
    const d = displayYear(y, 'real');
    const r = (n: number) => Math.round(n);
    return {
      units: "today's dollars",
      age: d.age,
      year: d.year,
      phase: d.phase,
      beginningPortfolio: r(d.begin),
      contributions: r(d.contributions),
      workIncome: r(d.workIncome),
      otherIncome: r(d.otherIncome),
      spendingNeed: r(d.spending + d.housing),
      withdrawals: r(d.withdrawal),
      investmentReturnAfterInflation: r(d.returns),
      endingPortfolio: r(d.end),
      unfundedSpending: r(d.unfunded),
      events: d.events.map((e) => ({ label: e.label, amount: r(e.amount) })),
    };
  }
  throw new Error(`Unknown tool ${name}`);
}
