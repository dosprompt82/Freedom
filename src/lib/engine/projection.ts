import { growth, investableAssets } from './math';
import type {
  DollarMode,
  LifePhase,
  PlanInputs,
  Projection,
  ProjectionYear,
  WorkPhase,
  YearEvent,
} from './types';

/**
 * Timing conventions (annual model, applied identically to every scenario):
 *
 * 1. Money LEAVING the portfolio (withdrawals for spending, housing costs paid
 *    from the portfolio, one-time expenses) is taken at the START of the year,
 *    so it earns no return that year.
 * 2. Money ENTERING the portfolio (savings, income surpluses, windfalls, sale
 *    proceeds) arrives at the END of the year, so it earns no return that year.
 * 3. The year's return is applied to what remains invested after step 1.
 *
 *    end = (begin - outflowsStart) * (1 + r) + inflowsEnd
 *
 * Both choices are mildly conservative. Amounts in today's dollars are priced
 * at the inflation level of the moment they occur: (1+i)^t at the start of
 * year t, (1+i)^(t+1) at the end. With constant inflation this makes the
 * nominal model exactly equivalent to a real-dollar model that uses the
 * Fisher real return.
 *
 * The step function is written per period so that a monthly model could reuse
 * it with periodic rates; only annual periods are exposed today.
 */

export interface ProjectionOptions {
  /** Override the nominal return for each period (used by Monte Carlo and tests). */
  returnSequence?: readonly number[];
  /** Override the retirement age without copying inputs (used by searches). */
  retirementAge?: number;
  /** Force a withdrawal strategy (work-optional search always uses fixed real spending). */
  strategy?: PlanInputs['withdrawal']['strategy'];
  /** Ignore all work phases (used to test whether work is truly optional). */
  excludeWorkPhases?: boolean;
}

export function phaseStart(phase: WorkPhase, retirementAge: number): number {
  return phase.anchor === 'retirement' ? retirementAge : phase.startAge;
}

export function phaseEnd(phase: WorkPhase, retirementAge: number): number {
  return phaseStart(phase, retirementAge) + Math.max(0, phase.years);
}

/** Phases active at `age`. Phases never apply before full-time work ends. */
export function activePhases(
  phases: readonly WorkPhase[],
  age: number,
  retirementAge: number,
): WorkPhase[] {
  if (age < retirementAge) return [];
  return phases.filter((p) => {
    const s = phaseStart(p, retirementAge);
    return age >= s && age < s + p.years && p.years > 0;
  });
}

/** Annual spending need used to size the Freedom Target, in today's dollars. */
export function freedomTargetBasis(inputs: PlanInputs) {
  const housing = inputs.properties
    .filter((p) => p.costsSeparateFromSpending)
    .filter((p) => !(p.sale.enabled && p.sale.age < inputs.retirementAge))
    .reduce((sum, p) => sum + p.annualCarryingCosts, 0);
  return {
    spending: inputs.retirementSpending,
    housing,
    rate: inputs.withdrawal.targetRate,
  };
}

export function freedomTargetReal(inputs: PlanInputs): number {
  const b = freedomTargetBasis(inputs);
  if (b.rate <= 0) return Infinity;
  return (b.spending + b.housing) / b.rate;
}

/** Nominal return for period t under the plan's base + downturn assumptions. */
export function scheduledReturn(inputs: PlanInputs, t: number): number {
  const age = inputs.currentAge + t;
  const d = inputs.downturn;
  if (d.enabled) {
    if (age === d.age) return -Math.abs(d.decline);
    if (age > d.age && age <= d.age + d.recoveryYears) return d.recoveryReturn;
  }
  return inputs.nominalReturn;
}

interface PropertyState {
  value: number;
  mortgage: number;
  sold: boolean;
}

export function projectPlan(inputs: PlanInputs, options: ProjectionOptions = {}): Projection {
  const retirementAge = options.retirementAge ?? inputs.retirementAge;
  const strategy = options.strategy ?? inputs.withdrawal.strategy;
  const phases = options.excludeWorkPhases ? [] : inputs.workPhases;
  const i = inputs.inflation;
  const taxRate = Math.min(0.95, Math.max(0, inputs.withdrawal.taxRate));
  const periods = Math.max(0, inputs.planningHorizonAge - inputs.currentAge + 1);

  const props: PropertyState[] = inputs.properties.map((p) => ({
    value: p.currentValue,
    mortgage: Math.max(0, p.mortgageBalance),
    sold: false,
  }));

  const years: ProjectionYear[] = [];
  let balance = investableAssets(inputs.assets);

  for (let t = 0; t < periods; t++) {
    const age = inputs.currentAge + t;
    const priceStart = growth(i, t);
    const priceEnd = growth(i, t + 1);
    const r = options.returnSequence?.[t] ?? scheduledReturn(inputs, t);
    const working = age < retirementAge;
    const active = activePhases(phases, age, retirementAge);
    const phase: LifePhase = working ? 'accumulation' : active.length ? 'transition' : 'retirement';
    const events: YearEvent[] = [];

    // --- Inflows at year end -------------------------------------------------
    const contributions = working
      ? Math.max(0, inputs.annualSavings) * growth(inputs.savingsRealGrowth, t) * priceEnd
      : 0;

    // --- Income (after full-time work only) ----------------------------------
    let workIncome = 0;
    let spendingReal = inputs.retirementSpending;
    for (const p of active) {
      const yearsIn = age - phaseStart(p, retirementAge);
      workIncome += p.annualNetIncome * growth(p.incomeRealGrowth, yearsIn) * priceStart;
    }
    const override = active.find((p) => p.spendingOverride != null)?.spendingOverride;
    if (override != null) spendingReal = override;

    let otherIncome = 0;
    if (!working) {
      for (const s of inputs.incomeStreams) {
        if (age >= s.startAge && age < s.endAge) {
          otherIncome += s.inflationAdjusted ? s.annualAmount * priceStart : s.annualAmount;
        }
      }
    }

    // --- One-time events -----------------------------------------------------
    let eventsIn = 0;
    let eventsOut = 0;
    for (const e of inputs.events) {
      if (e.age !== age || e.amount === 0) continue;
      if (e.amount > 0) {
        const amt = e.inflationAdjusted ? e.amount * priceEnd : e.amount;
        eventsIn += amt;
        events.push({ label: e.label, kind: 'event', amount: amt });
      } else {
        const amt = e.inflationAdjusted ? -e.amount * priceStart : -e.amount;
        eventsOut += amt;
        events.push({ label: e.label, kind: 'event', amount: -amt });
      }
    }

    const pe = inputs.privateEquity;
    if (pe.enabled && pe.selectedCase !== 'none' && pe.age === age) {
      const raw = pe[pe.selectedCase];
      if (raw > 0) {
        const amt = pe.inflationAdjusted ? raw * priceEnd : raw;
        eventsIn += amt;
        events.push({ label: `${pe.label} (${pe.selectedCase})`, kind: 'equity', amount: amt });
      }
    }

    if (inputs.downturn.enabled && inputs.downturn.age === age && !options.returnSequence) {
      events.push({
        label: `Market downturn (−${Math.round(inputs.downturn.decline * 100)}%)`,
        kind: 'downturn',
        amount: 0,
      });
    }

    // --- Real estate ---------------------------------------------------------
    let housingCosts = 0;
    let propertyValue = 0;
    let mortgageBalance = 0;
    inputs.properties.forEach((p, idx) => {
      const st = props[idx];
      if (st.sold) return;
      // Mortgage amortization for the year.
      let payment = 0;
      if (st.mortgage > 0) {
        const interest = st.mortgage * p.mortgageRate;
        payment = Math.min(p.annualMortgagePayment, st.mortgage + interest);
        st.mortgage = Math.max(0, st.mortgage + interest - payment);
      }
      st.value = st.value * (1 + p.appreciation);
      if (!working && p.costsSeparateFromSpending) {
        housingCosts += p.annualCarryingCosts * priceStart + payment;
      }
      if (p.sale.enabled && p.sale.age === age) {
        const proceeds =
          p.sale.netProceedsOverride ?? st.value * (1 - p.sale.sellingCostRate) - st.mortgage;
        if (proceeds >= 0) eventsIn += proceeds;
        else eventsOut += -proceeds;
        events.push({ label: `${p.label} sale`, kind: 'property-sale', amount: proceeds });
        st.sold = true;
        st.mortgage = 0;
        st.value = 0;
        return;
      }
      propertyValue += st.value;
      mortgageBalance += st.mortgage;
    });

    // --- Spending and withdrawals --------------------------------------------
    const beginBalance = balance;
    let spending = 0;
    let withdrawal = 0;
    let withdrawalTax = 0;
    let surplusInvested = 0;
    let lifestyleShortfall = 0;

    if (!working) {
      spending = spendingReal * priceStart;
      const income = workIncome + otherIncome;
      if (strategy === 'fixed-real') {
        const need = spending + housingCosts - income;
        if (need > 0) {
          withdrawal = need / (1 - taxRate);
          withdrawalTax = withdrawal - need;
        } else {
          surplusInvested = -need;
        }
      } else {
        withdrawal = Math.max(0, beginBalance) * Math.max(0, inputs.withdrawal.percentageRate);
        withdrawalTax = withdrawal * taxRate;
      }
    }

    // --- Balance update ------------------------------------------------------
    const outStart = withdrawal + eventsOut;
    let unfunded = 0;
    let invested = beginBalance - outStart;
    if (invested < 0) {
      unfunded = -invested;
      invested = 0;
    }
    // When the portfolio cannot cover everything, withdrawals for living costs
    // are funded first; anything left over is reported as unfunded.
    const fundedOutflows = beginBalance - invested;
    const fundedWithdrawal = Math.max(0, withdrawal - Math.max(0, unfunded - eventsOut));
    if (withdrawal > 0 && fundedWithdrawal < withdrawal) {
      withdrawalTax = fundedWithdrawal * (withdrawalTax / withdrawal);
      withdrawal = fundedWithdrawal;
    }
    const investmentReturn = invested * r;
    const endBalance = invested + investmentReturn + contributions + surplusInvested + eventsIn;

    const spendable = working ? 0 : withdrawal - withdrawalTax + workIncome + otherIncome;
    if (!working && strategy === 'percentage') {
      lifestyleShortfall = Math.max(0, spending + housingCosts - spendable);
    }

    years.push({
      t,
      age,
      year: inputs.startYear + t,
      phase,
      priceStart,
      priceEnd,
      returnRate: r,
      beginBalance,
      contributions,
      workIncome,
      otherIncome,
      spending,
      housingCosts,
      withdrawal,
      withdrawalTax,
      surplusInvested,
      eventsIn,
      eventsOut,
      fundedOutflows,
      investmentReturn,
      endBalance,
      spendable,
      unfunded,
      lifestyleShortfall,
      propertyValue,
      mortgageBalance,
      events,
    });

    balance = endBalance;
  }

  return {
    inputs: { ...inputs, retirementAge },
    years,
    freedomTargetReal: freedomTargetReal({ ...inputs, retirementAge }),
    freedomTargetBasis: freedomTargetBasis({ ...inputs, retirementAge }),
  };
}

/** A year's figures expressed in the requested dollars. Real values reconcile exactly. */
export interface DisplayYear {
  age: number;
  year: number;
  phase: LifePhase;
  begin: number;
  contributions: number;
  income: number;
  workIncome: number;
  otherIncome: number;
  spending: number;
  housing: number;
  withdrawal: number;
  withdrawalTax: number;
  inflows: number;
  outflows: number;
  returns: number;
  end: number;
  spendable: number;
  unfunded: number;
  events: { label: string; amount: number; kind: YearEvent['kind'] }[];
}

/**
 * Express a year in nominal or real dollars. In real mode each flow is deflated
 * at the moment it occurs (start-of-year flows by priceStart, end-of-year flows
 * by priceEnd) and the investment return is the reconciling item, so
 * begin + inflows + returns - outflows = end holds in both modes. The real
 * "return" is therefore the return after inflation.
 */
export function displayYear(y: ProjectionYear, mode: DollarMode): DisplayYear {
  const s = mode === 'real' ? y.priceStart : 1;
  const e = mode === 'real' ? y.priceEnd : 1;
  const begin = y.beginBalance / s;
  const end = y.endBalance / e;
  const contributions = y.contributions / e;
  const surplus = y.surplusInvested / e;
  const eventsIn = y.eventsIn / e;
  const withdrawal = y.withdrawal / s;
  const inflows = contributions + surplus + eventsIn;
  const outflows = y.fundedOutflows / s;
  return {
    age: y.age,
    year: y.year,
    phase: y.phase,
    begin,
    contributions: contributions + surplus,
    income: (y.workIncome + y.otherIncome) / s,
    workIncome: y.workIncome / s,
    otherIncome: y.otherIncome / s,
    spending: y.spending / s,
    housing: y.housingCosts / s,
    withdrawal,
    withdrawalTax: y.withdrawalTax / s,
    inflows,
    outflows,
    returns: end - begin - inflows + outflows,
    end,
    spendable: y.spendable / s,
    unfunded: y.unfunded / s,
    events: y.events.map((ev) => ({
      label: ev.label,
      kind: ev.kind,
      amount: ev.amount / (ev.amount >= 0 ? e : s),
    })),
  };
}

/** Balance on reaching `age` (start of that year). Past the horizon, the final end balance. */
export function balanceAtAge(
  projection: Projection,
  age: number,
  mode: DollarMode,
): number | null {
  const { years } = projection;
  if (!years.length) return null;
  const first = years[0];
  const last = years[years.length - 1];
  if (age < first.age) return null;
  if (age === last.age + 1) return mode === 'real' ? last.endBalance / last.priceEnd : last.endBalance;
  const y = years.find((row) => row.age === age);
  if (!y) return null;
  return mode === 'real' ? y.beginBalance / y.priceStart : y.beginBalance;
}

/** Chart series: balance on reaching each age, current age through horizon + 1. */
export function balanceSeries(projection: Projection, mode: DollarMode) {
  const pts = projection.years.map((y) => ({
    age: y.age,
    year: y.year,
    value: mode === 'real' ? y.beginBalance / y.priceStart : y.beginBalance,
  }));
  const last = projection.years[projection.years.length - 1];
  if (last) {
    pts.push({
      age: last.age + 1,
      year: last.year + 1,
      value: mode === 'real' ? last.endBalance / last.priceEnd : last.endBalance,
    });
  }
  return pts;
}
