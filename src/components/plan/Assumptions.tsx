import { investableAssets, realReturn, workPhaseWindows, type PlanInputs } from '@/lib/engine';
import { formatMoney, formatPct } from '@/lib/format';

export function assumptionRows(inputs: PlanInputs): { label: string; value: string; note?: string }[] {
  const rows: { label: string; value: string; note?: string }[] = [
    { label: 'Current age', value: `${inputs.currentAge} (${inputs.startYear})` },
    { label: 'Full-time work ends', value: `Age ${inputs.retirementAge}` },
    { label: 'Planning horizon', value: `Through age ${inputs.planningHorizonAge}` },
    { label: 'Investable assets today', value: formatMoney(investableAssets(inputs.assets)), note: inputs.assets.mode === 'detailed' ? 'Sum of account types' : 'Single total' },
    { label: 'Annual savings while working', value: formatMoney(inputs.annualSavings), note: `Today's dollars${inputs.savingsRealGrowth ? `, growing ${formatPct(inputs.savingsRealGrowth)} above inflation` : ', rising with inflation'}` },
    { label: 'Retirement spending', value: formatMoney(inputs.retirementSpending), note: "After tax, today's dollars, rising with inflation" },
    {
      label: 'Withdrawal strategy',
      value: inputs.withdrawal.strategy === 'fixed-real' ? 'Fixed real spending' : `${formatPct(inputs.withdrawal.percentageRate)} of portfolio each year`,
    },
    { label: 'Tax on withdrawals', value: inputs.withdrawal.taxRate ? formatPct(inputs.withdrawal.taxRate) : 'Not modeled', note: inputs.withdrawal.taxRate ? 'Effective rate' : 'Spending assumed to include taxes' },
    { label: 'Investment return', value: `${formatPct(inputs.nominalReturn, 2)} nominal`, note: `${formatPct(realReturn(inputs.nominalReturn, inputs.inflation), 2)} real` },
    { label: 'Inflation', value: formatPct(inputs.inflation, 2) },
  ];
  for (const w of workPhaseWindows(inputs)) {
    rows.push({
      label: w.phase.label,
      value: `Ages ${w.start}–${w.end - 1}`,
      note: w.phase.coversSpending ? 'Covers all spending; portfolio not touched' : `${formatMoney(w.phase.annualNetIncome)}/yr after tax`,
    });
  }
  for (const s of inputs.incomeStreams) {
    rows.push({ label: s.label, value: `From age ${s.startAge}`, note: `${formatMoney(s.annualAmount)}/yr${s.inflationAdjusted ? ', inflation-adjusted' : ', fixed'}` });
  }
  for (const e of inputs.events) {
    rows.push({ label: e.label, value: `Age ${e.age}`, note: `${e.amount >= 0 ? '+' : '−'}${formatMoney(Math.abs(e.amount))} net${e.inflationAdjusted ? " (today's $)" : ' (future $)'}${e.taxNote ? ` · ${e.taxNote}` : ''}` });
  }
  for (const h of inputs.equity) {
    rows.push({
      label: h.label,
      value: `${formatMoney(h.conservative, { compact: true })} / ${formatMoney(h.base, { compact: true })} / ${formatMoney(h.optimistic, { compact: true })} pre-tax`,
      note: `Conservative / base / optimistic · ${formatPct(h.taxRate, 0)} tax · ages ${h.earliestAge}–${h.latestAge} (expected ${h.expectedAge}) · ${formatPct(h.probability, 0)} chance${h.payoutYears > 1 ? ` · paid over ${h.payoutYears} years` : ''}${h.requiresEmployment ? ' · must still be employed' : ''}`,
    });
  }
  if (inputs.equity.length) {
    const a = inputs.equityAssumption;
    rows.push({ label: 'Equity outcome used in plan', value: a.outcome === 'none' ? 'No payout' : `${a.outcome}, ${a.timing} timing` });
  }
  for (const p of inputs.properties) {
    rows.push({
      label: p.label,
      value: p.sale.enabled ? `Sold at ${p.sale.age}` : 'Not sold (equity not counted)',
      note: `Value ${formatMoney(p.currentValue, { compact: true })}, mortgage ${formatMoney(p.mortgageBalance, { compact: true })}${p.costsSeparateFromSpending ? ', costs paid on top of spending' : ''}`,
    });
  }
  if (inputs.downturn.enabled) {
    rows.push({ label: 'Market downturn stress test', value: `−${formatPct(inputs.downturn.decline, 0)} at age ${inputs.downturn.age}` });
  }
  return rows;
}

export function AssumptionsTable({ inputs }: { inputs: PlanInputs }) {
  return (
    <dl className="divide-y divide-line">
      {assumptionRows(inputs).map((r, i) => (
        <div key={i} className="print-avoid grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[1fr_1fr] sm:gap-4">
          <dt className="text-[13px] text-ink-2">{r.label}</dt>
          <dd className="text-[13px] sm:text-right">
            <span className="tnum font-medium text-ink">{r.value}</span>
            {r.note && <span className="block text-[12px] text-ink-3">{r.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
