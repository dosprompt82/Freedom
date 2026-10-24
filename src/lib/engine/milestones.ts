import { formatMoney } from '../format';
import { depletionAge, phaseSummaries, workOptionalAge, workPhaseWindows } from './metrics';
import type { Milestone, PlanInputs, Projection } from './types';

const yearOf = (inputs: PlanInputs, age: number) => inputs.startYear + (age - inputs.currentAge);

export interface MilestoneContext {
  /** Pre-computed to avoid repeated searches; computed on demand when omitted. */
  workOptional?: number | null;
}

/** Every milestone is derived from model output; none are hard-coded labels. */
export function computeMilestones(projection: Projection, ctx: MilestoneContext = {}): Milestone[] {
  const { inputs, years } = projection;
  const out: Milestone[] = [];
  const horizon = inputs.planningHorizonAge;
  const mk = (m: Omit<Milestone, 'year'>): Milestone => ({
    ...m,
    year: m.age == null ? null : yearOf(inputs, m.age),
  });

  const wo = ctx.workOptional !== undefined ? ctx.workOptional : workOptionalAge(inputs);
  out.push(
    mk({
      id: 'work-optional',
      kind: 'work-optional',
      label: 'Work becomes optional',
      age: wo,
      detail:
        wo == null
          ? `No age before ${horizon} lets you stop all paid work and fund your spending through ${horizon} under these assumptions.`
          : `Earliest age at which stopping all paid work funds your spending through age ${horizon} in this single deterministic projection.`,
      tone: wo == null ? 'caution' : 'positive',
    }),
  );

  if (inputs.retirementAge <= horizon) {
    out.push(
      mk({
        id: 'retirement',
        kind: 'retirement',
        label: 'Full-time work ends',
        age: inputs.retirementAge,
        detail: 'Your planned retirement age. Annual savings stop here.',
        tone: 'neutral',
      }),
    );
  }

  const summaries = phaseSummaries(projection);
  for (const w of workPhaseWindows(inputs)) {
    if (w.start > horizon) continue;
    const sum = summaries.find((x) => x.phaseId === w.phase.id);
    out.push(
      mk({
        id: `phase-start-${w.phase.id}`,
        kind: 'phase-start',
        label: `${w.phase.label} begins`,
        age: w.start,
        detail: w.phase.coversSpending
          ? `Assumed to cover all spending for ${w.end - w.start} year${w.end - w.start === 1 ? '' : 's'}, so the portfolio is not touched. That takes about ${formatMoney(sum?.avgIncomeReal ?? 0, { compact: true })}/yr after tax (today's dollars).`
          : `${formatMoney(w.phase.annualNetIncome, { compact: true })}/yr after tax (today's dollars) for ${w.end - w.start} year${w.end - w.start === 1 ? '' : 's'}.`,
        tone: 'neutral',
      }),
    );
    if (w.end <= horizon) {
      out.push(
        mk({
          id: `phase-end-${w.phase.id}`,
          kind: 'phase-end',
          label: `${w.phase.label} ends`,
          age: w.end,
          detail: 'Spending is fully funded by the portfolio and other income from here.',
          tone: 'neutral',
        }),
      );
    }
  }

  for (const y of years) {
    for (const ev of y.events) {
      if (ev.kind === 'equity') {
        out.push(
          mk({
            id: `equity-${y.age}`,
            kind: 'equity',
            label: ev.label,
            age: y.age,
            detail: `${formatMoney(ev.amount / y.priceEnd, { compact: true })} net in today's dollars (${formatMoney(ev.amount, { compact: true })} future dollars), received at year end.`,
            tone: 'positive',
          }),
        );
      } else if (ev.kind === 'equity-forfeited') {
        out.push(
          mk({
            id: `forfeit-${y.age}-${ev.label}`,
            kind: 'equity',
            label: ev.label,
            age: y.age,
            detail: `${formatMoney(ev.amount / y.priceEnd, { compact: true })} after tax (today's dollars) is lost because full-time work ends before this payout.`,
            tone: 'negative',
          }),
        );
      } else if (ev.kind === 'property-sale') {
        out.push(
          mk({
            id: `sale-${y.age}-${ev.label}`,
            kind: 'property-sale',
            label: ev.label,
            age: y.age,
            detail: `Net proceeds of ${formatMoney(ev.amount, { compact: true })} (future dollars) are added to investable assets.`,
            tone: ev.amount >= 0 ? 'positive' : 'negative',
          }),
        );
      } else if (ev.kind === 'event') {
        out.push(
          mk({
            id: `event-${y.age}-${ev.label}`,
            kind: 'event',
            label: ev.label,
            age: y.age,
            detail: `${ev.amount >= 0 ? 'Inflow' : 'Outflow'} of ${formatMoney(Math.abs(ev.amount), { compact: true })} (future dollars).`,
            tone: ev.amount >= 0 ? 'positive' : 'neutral',
          }),
        );
      } else if (ev.kind === 'downturn') {
        out.push(
          mk({
            id: `downturn-${y.age}`,
            kind: 'downturn',
            label: ev.label,
            age: y.age,
            detail: 'Deterministic stress test: one assumed bad year, not a forecast or probability.',
            tone: 'caution',
          }),
        );
      }
    }
  }

  // Mortgage payoff: first year a property's mortgage balance reaches zero.
  inputs.properties.forEach((p) => {
    if (p.mortgageBalance <= 0) return;
    let bal = p.mortgageBalance;
    for (let age = inputs.currentAge; age <= horizon; age++) {
      if (p.sale.enabled && age > p.sale.age) return;
      const interest = bal * p.mortgageRate;
      bal = Math.max(0, bal + interest - Math.min(p.annualMortgagePayment, bal + interest));
      if (bal <= 0.5) {
        out.push(
          mk({
            id: `mortgage-${p.id}`,
            kind: 'mortgage-payoff',
            label: `${p.label} mortgage paid off`,
            age: age + 1,
            detail: 'Based on the balance, rate and annual payment you entered.',
            tone: 'positive',
          }),
        );
        return;
      }
    }
    out.push(
      mk({
        id: `mortgage-${p.id}`,
        kind: 'mortgage-payoff',
        label: `${p.label} mortgage`,
        age: null,
        detail:
          p.annualMortgagePayment <= p.mortgageBalance * p.mortgageRate
            ? 'The annual payment does not cover interest, so the mortgage never pays off.'
            : `Not paid off by age ${horizon} at the entered payment.`,
        tone: 'caution',
      }),
    );
  });

  const dep = depletionAge(projection);
  out.push(
    mk(
      dep == null
        ? {
            id: 'horizon',
            kind: 'horizon',
            label: `Portfolio lasts through ${horizon}`,
            age: horizon,
            detail: 'Under these assumptions the portfolio funds planned spending through the planning horizon.',
            tone: 'positive',
          }
        : {
            id: 'depletion',
            kind: 'depletion',
            label: 'Portfolio depleted',
            age: dep,
            detail: 'From this age the portfolio can no longer fund planned spending under these assumptions.',
            tone: 'negative',
          },
    ),
  );

  const order = (m: Milestone) => (m.age == null ? Number.POSITIVE_INFINITY : m.age);
  return out.sort((a, b) => order(a) - order(b));
}
