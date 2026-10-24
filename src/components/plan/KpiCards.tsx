'use client';

import type { DollarMode, PlanAnalysis } from '@/lib/engine';
import { formatMoney, formatPct } from '@/lib/format';
import { GLOSSARY } from '@/lib/glossary';
import { Badge, InfoTip, ToneIcon, cx } from '../ui';

export function KpiCards({ analysis, mode }: { analysis: PlanAnalysis; mode: DollarMode }) {
  const { metrics: m, inputs, workOptional } = analysis;
  const unit = mode === 'real' ? "today's dollars" : 'future dollars';
  const gap = m.fundingGap[mode];
  const surplus = gap >= 0;
  const woDelta = workOptional == null ? null : inputs.retirementAge - workOptional;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="Projected retirement portfolio"
        value={formatMoney(m.portfolioAtRetirement[mode], { compact: true })}
        sub={`At age ${inputs.retirementAge} · ${unit}`}
        tip={<>Your projected investable assets when full-time work ends, after the final year of savings.</>}
      />
      <Kpi
        label="Freedom Target"
        value={formatMoney(m.freedomTarget[mode], { compact: true })}
        sub={`${formatMoney(analysis.projection.freedomTargetBasis.spending + analysis.projection.freedomTargetBasis.housing, { compact: true })} ÷ ${formatPct(inputs.withdrawal.targetRate)} · ${unit}`}
        tip={GLOSSARY.freedomTarget}
        accent="gold"
      />
      <Kpi
        label={surplus ? 'Projected surplus' : 'Projected funding gap'}
        value={formatMoney(Math.abs(gap), { compact: true })}
        sub={
          <span className="inline-flex items-center gap-1.5">
            <ToneIcon tone={surplus ? 'positive' : 'caution'} className="h-3.5 w-3.5" />
            {surplus ? 'Above' : 'Below'} the illustrative target at {inputs.retirementAge}
          </span>
        }
        tone={surplus ? 'positive' : 'caution'}
        tip="Projected retirement portfolio minus the Freedom Target. A gap does not by itself mean a plan fails; see whether the portfolio lasts."
      />
      <Kpi
        label="Work-optional age"
        value={workOptional == null ? 'Not yet' : String(workOptional)}
        sub={
          workOptional == null ? (
            `Not reached by ${inputs.planningHorizonAge} under these assumptions`
          ) : woDelta! > 0 ? (
            <Badge tone="positive">{woDelta} yr{woDelta === 1 ? '' : 's'} before your target</Badge>
          ) : woDelta === 0 ? (
            <Badge tone="neutral">Same as your target</Badge>
          ) : (
            <Badge tone="caution">{-woDelta!} yr{woDelta === -1 ? '' : 's'} after your target</Badge>
          )
        }
        tip={GLOSSARY.workOptional}
        estimate
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
  accent,
  estimate,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  tip: React.ReactNode;
  tone?: 'positive' | 'caution';
  accent?: 'gold';
  estimate?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card">
      {accent === 'gold' && <div className="absolute inset-x-0 top-0 h-0.5 bg-[color:var(--gold)]" aria-hidden />}
      {tone && (
        <div className={cx('absolute inset-x-0 top-0 h-0.5', tone === 'positive' ? 'bg-accent' : 'bg-caution')} aria-hidden />
      )}
      <div className="flex items-center text-[12.5px] font-medium text-ink-2">
        {label}
        <InfoTip term={label}>{tip}</InfoTip>
        {estimate && <span className="ml-auto text-[10.5px] uppercase tracking-wider text-ink-3">Estimate</span>}
      </div>
      <div
        className={cx(
          'tnum mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] transition-colors',
          tone === 'positive' ? 'text-accent' : tone === 'caution' ? 'text-caution' : 'text-ink',
        )}
        aria-live="polite"
      >
        {value}
      </div>
      <div className="mt-2 text-[12px] text-ink-3">{sub}</div>
    </div>
  );
}
