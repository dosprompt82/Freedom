import { formatMoney, formatPct } from '../format';
import { computeMetrics, depletionAge, targetReachedAge, workOptionalAge } from './metrics';
import { projectPlan } from './projection';
import type { Insight, PlanInputs, PlanMetrics, Projection } from './types';

/**
 * Plain-English observations. Every number below is produced by re-running the
 * deterministic engine with one assumption changed; nothing is estimated by
 * hand. Language stays conditional ("projected", "under these assumptions").
 */

const money = (n: number) => formatMoney(n, { approx: true });
const td = "today's dollars";

export interface InsightContext {
  targetAge: number | null;
  workOptional: number | null;
}

function horizonReal(p: Projection): number {
  const last = p.years[p.years.length - 1];
  return last ? last.endBalance / last.priceEnd : 0;
}

export function planInsights(
  inputs: PlanInputs,
  projection: Projection,
  metrics: PlanMetrics,
  ctx: InsightContext,
): Insight[] {
  const out: Insight[] = [];
  const ret = inputs.retirementAge;
  const horizon = inputs.planningHorizonAge;
  const retiring = ret <= horizon;

  // 1. Freedom Target timing.
  if (ctx.targetAge != null) {
    const delta = ret - ctx.targetAge;
    out.push({
      id: 'target-age',
      tone: delta >= 0 ? 'positive' : 'caution',
      title: `Freedom Target reached at ${ctx.targetAge}`,
      body:
        `If you keep saving as planned, your projected portfolio reaches your illustrative Freedom Target of ${money(metrics.freedomTarget.real)} (${td}) at age ${ctx.targetAge}` +
        (delta > 0
          ? `, ${delta} year${delta === 1 ? '' : 's'} before your target retirement age.`
          : delta < 0
            ? `, ${-delta} year${delta === -1 ? '' : 's'} after your target retirement age of ${ret}.`
            : ', the same year you plan to stop full-time work.'),
    });
  } else {
    out.push({
      id: 'target-age',
      tone: 'caution',
      title: 'Freedom Target not reached',
      body: `At the current savings pace the projected portfolio does not reach ${money(metrics.freedomTarget.real)} (${td}) by the end of your plan (age ${horizon}).`,
    });
  }

  // 2. Gap at retirement.
  if (retiring) {
    const gap = metrics.fundingGap.real;
    out.push({
      id: 'gap',
      tone: gap >= 0 ? 'positive' : 'caution',
      title: gap >= 0 ? 'Projected surplus at retirement' : 'Projected gap at retirement',
      body:
        gap >= 0
          ? `At ${ret}, your projected portfolio of ${money(metrics.portfolioAtRetirement.real)} exceeds the illustrative target by approximately ${money(gap)} (${td}).`
          : `At ${ret}, your projected portfolio of ${money(metrics.portfolioAtRetirement.real)} is approximately ${money(-gap)} short of the illustrative target (${td}). A gap does not by itself mean the plan fails — see whether the portfolio lasts below.`,
    });
  }

  // 3. Sustainability of the plan as entered.
  if (metrics.depletionAge != null) {
    out.push({
      id: 'depletion',
      tone: 'negative',
      title: `Portfolio runs short at ${metrics.depletionAge}`,
      body: `Under these assumptions the portfolio can no longer fund your planned spending from age ${metrics.depletionAge}. Spending less, working longer or adding income in early retirement would push this out.`,
    });
  } else if (retiring) {
    out.push({
      id: 'lasts',
      tone: 'positive',
      title: `Portfolio lasts through ${horizon}`,
      body: `In this single projection your plan funds its spending through age ${horizon}, leaving about ${money(metrics.portfolioAtHorizon.real)} (${td}). This is not a guarantee: real returns arrive unevenly.`,
    });
  }

  // 4. Work-optional age vs plan.
  if (ctx.workOptional != null && retiring) {
    const d = ret - ctx.workOptional;
    out.push({
      id: 'work-optional',
      tone: d >= 0 ? 'positive' : 'caution',
      title: `Work could become optional at ${ctx.workOptional}`,
      body:
        d > 0
          ? `Stopping all paid work at ${ctx.workOptional} would still fund your spending through ${horizon} in this projection — ${d} year${d === 1 ? '' : 's'} earlier than your target. Extra years beyond that build a buffer against weaker markets.`
          : d === 0
            ? `Your target age of ${ret} is the earliest age at which stopping all paid work funds your spending through ${horizon} in this projection, so there is little margin for weaker markets.`
            : `Stopping all paid work at ${ret} would not fund your spending through ${horizon}. Without further earned income, the earliest sustainable age in this projection is ${ctx.workOptional}.`,
    });
  }

  if (!retiring) return out;

  // 5. Working two more years.
  const delayed = projectPlan({ ...inputs, retirementAge: ret + 2 });
  const delayedM = computeMetrics(delayed);
  const delayGain = delayedM.portfolioAtRetirement.real - metrics.portfolioAtRetirement.real;
  if (ret + 2 <= horizon && Math.abs(delayGain) > 1000) {
    out.push({
      id: 'delay',
      tone: 'neutral',
      title: 'The value of two more years',
      body: `Working two additional years increases your projected portfolio at retirement by approximately ${money(delayGain)} (${td}) and shortens the period your savings must fund by two years.`,
    });
  }

  // 6. Spending sensitivity.
  const cut = 15_000;
  if (inputs.retirementSpending > cut * 2 && inputs.withdrawal.targetRate > 0) {
    const targetDelta = cut / inputs.withdrawal.targetRate;
    const leaner = projectPlan({ ...inputs, retirementSpending: inputs.retirementSpending - cut });
    const leanerDep = depletionAge(leaner);
    let effect = '';
    if (metrics.depletionAge != null && leanerDep == null) effect = ` It would also keep the portfolio from running short before ${horizon}.`;
    else if (metrics.depletionAge != null && leanerDep != null && leanerDep > metrics.depletionAge)
      effect = ` It would also push the projected shortfall from age ${metrics.depletionAge} to ${leanerDep}.`;
    else if (leanerDep == null)
      effect = ` It adds approximately ${money(horizonReal(leaner) - metrics.portfolioAtHorizon.real)} to your projected portfolio at the end of your plan (age ${horizon}).`;
    out.push({
      id: 'spending',
      tone: 'neutral',
      title: 'Spending is your most direct lever',
      body: `Reducing annual retirement spending by ${formatMoney(cut)} lowers your illustrative Freedom Target by approximately ${money(targetDelta)} using a ${formatPct(inputs.withdrawal.targetRate)} withdrawal-rate assumption.${effect}`,
    });
  }

  // 7. Transition work.
  if (inputs.workPhases.length && metrics.transitionYears > 0) {
    const without = computeMetrics(projectPlan(inputs, { excludeWorkPhases: true }));
    const saved = without.earlyRetirementWithdrawalsReal - metrics.earlyRetirementWithdrawalsReal;
    if (saved > 1000) {
      out.push({
        id: 'transition',
        tone: 'positive',
        title: 'Your bridge income does heavy lifting',
        body: `Your planned ${inputs.workPhases.length === 1 ? inputs.workPhases[0].label.toLowerCase() : 'post-career work'} reduces the portfolio withdrawals required during your first five years after full-time work by approximately ${money(saved)} (${td}).` +
          (without.depletionAge != null && metrics.depletionAge == null
            ? ` Without it, the portfolio would run short at ${without.depletionAge}.`
            : ''),
      });
    }
  }

  // 8. Sequence-of-returns sensitivity (deterministic stress test).
  if (!inputs.downturn.enabled && ret + 10 <= horizon) {
    const shock = (age: number) =>
      projectPlan({
        ...inputs,
        downturn: { enabled: true, age, decline: 0.25, recoveryReturn: inputs.nominalReturn, recoveryYears: 0 },
      });
    const early = shock(ret);
    const late = shock(ret + 10);
    const earlyLoss = metrics.portfolioAtHorizon.real - horizonReal(early);
    const lateLoss = metrics.portfolioAtHorizon.real - horizonReal(late);
    const earlyDep = depletionAge(early);
    if (earlyLoss > 1000) {
      out.push({
        id: 'sequence',
        tone: earlyDep != null && metrics.depletionAge == null ? 'caution' : 'neutral',
        title: 'The first years of retirement matter most',
        body:
          `A 25% market decline in your first year after full-time work would reduce your projected portfolio at the end of your plan (age ${horizon}) by approximately ${money(earlyLoss)}; the same decline ten years later reduces it by approximately ${money(Math.max(0, lateLoss))} (${td}).` +
          (earlyDep != null && metrics.depletionAge == null ? ` An early decline would cause the portfolio to run short at ${earlyDep}.` : '') +
          ' This is a stress test, not a probability.',
      });
    }
  }

  // 9. Return sensitivity.
  const lower = projectPlan({ ...inputs, nominalReturn: inputs.nominalReturn - 0.01 });
  const lowerDep = depletionAge(lower);
  if (metrics.depletionAge == null && lowerDep != null) {
    out.push({
      id: 'returns',
      tone: 'caution',
      title: 'Sensitive to investment returns',
      body: `If returns average 1 percentage point lower (${formatPct(inputs.nominalReturn - 0.01)} instead of ${formatPct(inputs.nominalReturn)}), the portfolio would run short at age ${lowerDep}.`,
    });
  } else if (metrics.depletionAge == null) {
    out.push({
      id: 'returns',
      tone: 'neutral',
      title: 'Return sensitivity',
      body: `With returns 1 percentage point lower every year, your projected portfolio at the end of your plan (age ${horizon}) falls by approximately ${money(metrics.portfolioAtHorizon.real - horizonReal(lower))} (${td}) but still lasts.`,
    });
  }

  // 10. Initial withdrawal rate.
  if (metrics.initialWithdrawalRate != null && metrics.initialWithdrawalRate > 0) {
    const r = metrics.initialWithdrawalRate;
    out.push({
      id: 'withdrawal-rate',
      tone: r > inputs.withdrawal.targetRate * 1.25 ? 'caution' : 'neutral',
      title: `Initial withdrawal rate: ${formatPct(r)}`,
      body: `In your first year after full-time work, the plan draws ${formatPct(r)} of the portfolio, compared with your ${formatPct(inputs.withdrawal.targetRate)} planning assumption. No withdrawal rate is universally safe.`,
    });
  }

  // 11. Dependence on an uncertain liquidity event.
  const pe = inputs.privateEquity;
  if (pe.enabled && pe.selectedCase !== 'none') {
    const withoutPe = { ...inputs, privateEquity: { ...pe, selectedCase: 'none' as const } };
    const woWithout = workOptionalAge(withoutPe);
    const depWithout = depletionAge(projectPlan(withoutPe));
    const parts: string[] = [];
    if (woWithout !== ctx.workOptional) {
      parts.push(
        woWithout == null
          ? 'work would not become optional within the horizon'
          : `the work-optional age moves to ${woWithout}`,
      );
    }
    if (depWithout != null && metrics.depletionAge == null) parts.push(`the plan would run short at ${depWithout}`);
    out.push({
      id: 'equity',
      tone: parts.length ? 'caution' : 'positive',
      title: parts.length ? 'Your plan leans on the equity payout' : 'Equity payout is upside, not a dependency',
      body: parts.length
        ? `Without the ${pe.label.toLowerCase()}, ${parts.join(' and ')}. Private equity is illiquid and uncertain until it pays out.`
        : `Your plan funds its spending through ${horizon} even without the ${pe.label.toLowerCase()}, so the payout adds flexibility rather than carrying the plan.`,
    });
  }

  if (inputs.withdrawal.strategy === 'percentage' && metrics.yearsWithLifestyleShortfall > 0) {
    out.push({
      id: 'percentage',
      tone: 'caution',
      title: 'Percentage withdrawals vary',
      body: `Withdrawing a fixed ${formatPct(inputs.withdrawal.percentageRate)} of the portfolio means income falls below your spending target in ${metrics.yearsWithLifestyleShortfall} of the modeled retirement years. The portfolio never fully depletes, but your lifestyle has to flex.`,
    });
  }

  return out;
}

export interface ComparisonRow {
  id: string;
  name: string;
  metrics: PlanMetrics;
  workOptional: number | null;
  targetAge: number | null;
}

/** Plain-English tradeoffs between a scenario and the baseline, from computed metrics. */
export function comparisonInsights(base: ComparisonRow, alt: ComparisonRow): Insight[] {
  const out: Insight[] = [];
  const b = base.metrics;
  const a = alt.metrics;
  const dRet = a.portfolioAtRetirement.real - b.portfolioAtRetirement.real;
  const dYears = a.totalYearsWorked - b.totalYearsWorked;
  const dHorizon = a.portfolioAtHorizon.real - b.portfolioAtHorizon.real;

  if (Math.abs(dYears) > 0) {
    out.push({
      id: `${alt.id}-years`,
      tone: 'neutral',
      title: `${alt.name}: ${Math.abs(dYears)} ${dYears > 0 ? 'more' : 'fewer'} year${Math.abs(dYears) === 1 ? '' : 's'} of work`,
      body: `Compared with ${base.name}, the projected portfolio when full-time work ends is ${dRet >= 0 ? 'higher' : 'lower'} by approximately ${money(Math.abs(dRet))} (${td}).`,
    });
  } else if (Math.abs(dRet) > 1000) {
    out.push({
      id: `${alt.id}-ret`,
      tone: dRet >= 0 ? 'positive' : 'caution',
      title: `${alt.name}: ${dRet >= 0 ? 'more' : 'less'} at retirement`,
      body: `The projected portfolio at retirement is approximately ${money(Math.abs(dRet))} ${dRet >= 0 ? 'higher' : 'lower'} than ${base.name} (${td}).`,
    });
  }

  if (a.depletionAge !== b.depletionAge) {
    out.push({
      id: `${alt.id}-dep`,
      tone: a.depletionAge == null ? 'positive' : 'negative',
      title: a.depletionAge == null ? `${alt.name} lasts the full horizon` : `${alt.name} runs short at ${a.depletionAge}`,
      body:
        a.depletionAge == null
          ? `${base.name} runs short at ${b.depletionAge}; this scenario funds spending through the planning horizon.`
          : b.depletionAge == null
            ? `${base.name} lasts through the planning horizon; this scenario does not.`
            : `${base.name} runs short at ${b.depletionAge}.`,
    });
  } else if (Math.abs(dHorizon) > 1000) {
    out.push({
      id: `${alt.id}-horizon`,
      tone: dHorizon >= 0 ? 'positive' : 'caution',
      title: `${alt.name}: ending portfolio ${dHorizon >= 0 ? 'higher' : 'lower'}`,
      body: `At the end of the plan, the projected portfolio is approximately ${money(Math.abs(dHorizon))} ${dHorizon >= 0 ? 'higher' : 'lower'} than ${base.name} (${td}).`,
    });
  }

  if (alt.workOptional !== base.workOptional) {
    out.push({
      id: `${alt.id}-wo`,
      tone: alt.workOptional != null && (base.workOptional == null || alt.workOptional < base.workOptional) ? 'positive' : 'caution',
      title: `${alt.name}: work-optional age ${alt.workOptional ?? 'not reached'}`,
      body: `Compared with ${base.workOptional == null ? 'not reached' : `age ${base.workOptional}`} under ${base.name}.`,
    });
  }
  return out;
}

export { targetReachedAge, workOptionalAge };
