'use client';

import type { DollarMode, EquityAnalysis, PlanAnalysis } from '@/lib/engine';
import { formatMoney } from '@/lib/format';
import { GLOSSARY } from '@/lib/glossary';
import { Badge, InfoTip, ToneIcon, cx } from '../ui';

/** The headline: when work becomes optional, with the supporting facts beside it. */
export function KpiCards({ analysis, mode, equity }: { analysis: PlanAnalysis; mode: DollarMode; equity?: EquityAnalysis }) {
  const { metrics: m, inputs, workOptional } = analysis;
  const unit = mode === 'real' ? "today's dollars" : 'future dollars';
  const ret = inputs.retirementAge;
  const delta = workOptional == null ? null : ret - workOptional;
  const showWithout = equity?.hasEquity && inputs.equityAssumption.outcome !== 'none';

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card sm:col-span-2 xl:col-span-1">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-[color:var(--gold)]" aria-hidden />
        <div className="flex items-center text-[12.5px] font-medium text-ink-2">
          Work-optional age
          <InfoTip term="Work-optional age">{GLOSSARY.workOptional}</InfoTip>
          <span className="ml-auto text-[10.5px] uppercase tracking-wider text-ink-3">Estimate</span>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
          <div className="tnum text-[44px] font-semibold leading-none tracking-[-0.04em] text-ink" aria-live="polite">
            {workOptional ?? 'Not yet'}
          </div>
          {delta == null ? (
            <Badge tone="caution">Not reached by {inputs.planningHorizonAge}</Badge>
          ) : delta > 0 ? (
            <Badge tone="positive">{delta} yr{delta === 1 ? '' : 's'} before your planned {ret}</Badge>
          ) : delta === 0 ? (
            <Badge tone="neutral">Matches your planned {ret}</Badge>
          ) : (
            <Badge tone="caution">{-delta} yr{delta === -1 ? '' : 's'} after your planned {ret}</Badge>
          )}
        </div>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-3">
          {workOptional == null
            ? `Stopping all paid work at any age runs short before ${inputs.planningHorizonAge} under these assumptions.`
            : `Stop all paid work at ${workOptional} and your money lasts through ${inputs.planningHorizonAge}, with steady returns.`}
          {showWithout && <> Without your equity: {equity!.workOptionalWithout ?? 'not reached'}.</>}
        </p>
      </div>

      <Kpi
        label={`Portfolio at ${ret}`}
        value={formatMoney(m.portfolioAtRetirement[mode], { compact: true })}
        sub={`When full-time work ends · ${unit}`}
        tip="Your projected investable assets when full-time work ends, after the final year of savings."
      />
      <Kpi
        label="Your plan as entered"
        value={m.depletionAge == null ? `Lasts to ${inputs.planningHorizonAge}` : `Short at ${m.depletionAge}`}
        sub={
          <span className="inline-flex items-center gap-1.5">
            <ToneIcon tone={m.depletionAge == null ? 'positive' : 'negative'} className="h-3.5 w-3.5" />
            {m.depletionAge == null ? `Stopping at ${ret}, spending is funded` : `Stopping at ${ret}, money runs out`}
          </span>
        }
        tone={m.depletionAge == null ? 'positive' : 'negative'}
        tip="Whether your plan, with your planned retirement age, consulting and other income, funds your spending through the end of the plan."
      />
      <Kpi
        label="Left at end of plan"
        value={formatMoney(m.portfolioAtHorizon[mode], { compact: true })}
        sub={`At age ${inputs.planningHorizonAge} · ${unit}`}
        tip="What remains after funding your planned spending through the end of the plan. A larger cushion means more room for weaker markets."
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tip,
  tone,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  tip: React.ReactNode;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center text-[12.5px] font-medium text-ink-2">
        {label}
        <InfoTip term={label}>{tip}</InfoTip>
      </div>
      <div
        className={cx(
          'tnum mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em]',
          tone === 'positive' ? 'text-accent' : tone === 'negative' ? 'text-negative' : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="mt-2 text-[12px] text-ink-3">{sub}</div>
    </div>
  );
}
