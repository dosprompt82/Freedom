import {
  analyzeWithInsights,
  balanceAtAge,
  investableAssets,
  phaseSummaries,
  realReturn,
  workPhaseWindows,
  type PlanInputs,
} from '../engine';
import { formatMoney, formatPct } from '../format';

const m = (n: number | null | undefined) => (n == null ? 'n/a' : formatMoney(n));

/**
 * A compact, factual text snapshot of the plan and everything the engine
 * computed from it. The assistant answers from this (and from its tools), so
 * every number it quotes traces back to the deterministic model.
 */
export function buildBriefing(inputs: PlanInputs): string {
  const a = analyzeWithInsights(inputs);
  const { metrics: x, projection: p } = a;
  const L: string[] = [];
  const push = (s = '') => L.push(s);

  push("PLAN SNAPSHOT (all money in today's dollars unless marked; computed by the app's projection engine)");
  push(`Current age ${inputs.currentAge} in ${inputs.startYear}. Full-time work ends at ${inputs.retirementAge}. Plan runs through age ${inputs.planningHorizonAge}.`);
  push(`Investable assets now ${m(investableAssets(inputs.assets))}. Annual savings while working ${m(inputs.annualSavings)}${inputs.savingsRealGrowth ? `, growing ${formatPct(inputs.savingsRealGrowth)} above inflation` : ''}.`);
  push(`Retirement spending ${m(inputs.retirementSpending)}/yr after tax. Withdrawal strategy: ${inputs.withdrawal.strategy === 'fixed-real' ? 'fixed real spending' : `${formatPct(inputs.withdrawal.percentageRate)} of portfolio per year`}. Tax on withdrawals: ${inputs.withdrawal.taxRate ? formatPct(inputs.withdrawal.taxRate) : 'not modeled'}.`);
  push(`Return ${formatPct(inputs.nominalReturn, 2)} nominal, inflation ${formatPct(inputs.inflation, 2)}, real return ${formatPct(realReturn(inputs.nominalReturn, inputs.inflation), 2)}. Steady returns every year unless a downturn is set${inputs.downturn.enabled ? ` (downturn: −${formatPct(inputs.downturn.decline, 0)} at age ${inputs.downturn.age})` : ''}.`);
  push();

  push('KEY RESULTS');
  push(`Work-optional age (earliest age to stop ALL paid work and never run short through ${inputs.planningHorizonAge}, single steady-return projection): ${a.workOptional ?? 'not reached'}.`);
  push(`Portfolio when full-time work ends (${inputs.retirementAge}): ${m(x.portfolioAtRetirement.real)} (${m(x.portfolioAtRetirement.nominal)} future dollars).`);
  push(`Portfolio at 65: ${m(x.portfolioAt65?.real)}; at 80: ${m(x.portfolioAt80?.real)}; at end of plan: ${m(x.portfolioAtHorizon.real)}.`);
  push(`Plan as entered ${x.depletionAge == null ? `lasts through ${inputs.planningHorizonAge}` : `runs short at age ${x.depletionAge}`}. Initial withdrawal rate ${x.initialWithdrawalRate == null ? 'n/a' : formatPct(x.initialWithdrawalRate)}.`);
  push(`Years worked from now: ${x.fullTimeYears} full-time + ${x.transitionYears} transition.`);
  push();

  const phases = workPhaseWindows(inputs);
  if (phases.length) {
    push('WORK AFTER FULL-TIME');
    const sums = phaseSummaries(p);
    for (const w of phases) {
      const s = sums.find((q) => q.phaseId === w.phase.id);
      push(
        `- ${w.phase.label}, ages ${w.start}–${w.end - 1}: ${
          w.phase.coversSpending
            ? `assumed to cover all spending (needs about ${m(s?.avgIncomeReal)}/yr after tax); portfolio not touched`
            : `${m(w.phase.annualNetIncome)}/yr after tax`
        }. Portfolio ${m(s?.portfolioStartReal)} → ${m(s?.portfolioEndReal)} over the phase.`,
      );
    }
    push();
  }

  if (inputs.incomeStreams.length || inputs.events.length || inputs.properties.length) {
    push('OTHER INCOME, EVENTS, PROPERTY');
    for (const s of inputs.incomeStreams) push(`- ${s.label}: ${m(s.annualAmount)}/yr from age ${s.startAge}${s.endAge < 150 ? ` to ${s.endAge}` : ''}${s.inflationAdjusted ? '' : ' (fixed, not inflation-adjusted)'}.`);
    for (const e of inputs.events) push(`- ${e.label}: ${e.amount >= 0 ? '+' : '−'}${m(Math.abs(e.amount))} at age ${e.age}${e.inflationAdjusted ? '' : ' (future dollars)'}.`);
    for (const h of inputs.properties) push(`- ${h.label}: value ${m(h.currentValue)}, mortgage ${m(h.mortgageBalance)}; ${h.sale.enabled ? `sold at ${h.sale.age}` : 'not sold (equity never counted as spendable)'}.`);
    push();
  }

  const eq = a.equity;
  if (eq.hasEquity) {
    push('COMPANY EQUITY (illiquid until it pays out)');
    for (const h of inputs.equity) {
      push(
        `- ${h.label}: pre-tax ${m(h.conservative)} / ${m(h.base)} / ${m(h.optimistic)} (conservative/base/optimistic), tax ${formatPct(h.taxRate, 0)}, payout expected at ${h.expectedAge} (window ${h.earliestAge}–${h.latestAge}), ${formatPct(h.probability, 0)} chance it pays at all${h.payoutYears > 1 ? `, paid over ${h.payoutYears} years` : ''}${h.requiresEmployment ? '; MUST STILL BE EMPLOYED FULL-TIME at payout or it is forfeited' : ''}.`,
      );
    }
    push(`After tax: conservative ${m(eq.net.conservative)}, base ${m(eq.net.base)}, optimistic ${m(eq.net.optimistic)}; probability-weighted ${m(eq.expectedValue)}. Base case is ${formatPct(eq.shareOfNetWorth, 0)} of net worth.`);
    push(`Plan currently assumes: ${inputs.equityAssumption.outcome === 'none' ? 'no payout' : `${inputs.equityAssumption.outcome} outcome, ${inputs.equityAssumption.timing} timing`}.`);
    push('Work-optional age by outcome × timing (early / expected / late):');
    for (const o of ['conservative', 'base', 'optimistic'] as const) {
      const row = (['earliest', 'expected', 'latest'] as const).map((t) => eq.grid.find((c) => c.outcome === o && c.timing === t)?.workOptional ?? 'not reached');
      push(`  ${o}: ${row.join(' / ')}`);
    }
    push(`  never pays out: ${eq.workOptionalWithout ?? 'not reached'}`);
    const be = eq.breakeven;
    push(
      be.status === 'needed'
        ? `Minimum equity proceeds the plan as entered needs: ${m(be.netAmount)} after tax around age ${be.byAge}.`
        : be.status === 'not-needed'
          ? 'The plan as entered lasts even with no equity payout.'
          : be.status === 'forfeited'
            ? `The plan leaves full-time work before the payout, which requires employment, so it is forfeited.`
            : be.status === 'insufficient'
              ? 'Equity alone cannot fund the plan as entered.'
              : '',
    );
    push();
  }

  push('MILESTONES');
  for (const ms of a.milestones) push(`- ${ms.age == null ? 'not established' : `age ${ms.age}`}: ${ms.label}`);
  push();

  push("PORTFOLIO BY AGE (start of year, today's dollars)");
  const ages: number[] = [];
  for (let age = inputs.currentAge; age <= inputs.planningHorizonAge + 1; age += 1) {
    if (age === inputs.currentAge || age % 5 === 0 || age === inputs.retirementAge || age === inputs.planningHorizonAge + 1) ages.push(age);
  }
  push(ages.map((age) => `${age}: ${formatMoney(balanceAtAge(p, age, 'real') ?? 0, { compact: true })}`).join(', '));
  push();

  push('APP INSIGHTS');
  for (const i of a.insights) push(`- ${i.title}: ${i.body}`);
  if (a.issues.length) {
    push();
    push('WARNINGS');
    for (const i of a.issues) push(`- ${i.message}`);
  }
  return L.join('\n');
}

export const ASSISTANT_INSTRUCTIONS = `You are the plan assistant inside Freedom at 50, a retirement and financial-independence planner. The user is asking about THEIR plan, summarized below by the app.

How to answer:
- Ground every number in the plan snapshot or in a tool result. Never invent or estimate figures yourself. For any "what if" (different retirement age, spending, returns, equity outcome or timing, consulting), call the what_if tool and quote its results. Use year_detail for a specific age.
- Say which dollars you mean: the snapshot is in today's dollars.
- The app's headline measure is the work-optional age: the earliest age to stop all paid work and never run short in a single steady-return projection. It is not a guarantee. Frame answers around it (e.g. how a change moves it). The app does not use withdrawal-rate targets.
- Be direct and brief: 2-6 short sentences or a few "- " bullets. Plain text, no headings, no tables.
- You give educational explanations, not personalized investment, tax or legal advice. If asked for that, explain what the model shows and suggest a qualified professional for the decision.
- If the plan lacks something the question depends on (e.g. Social Security isn't entered), say so and say where to add it in the app.`;
