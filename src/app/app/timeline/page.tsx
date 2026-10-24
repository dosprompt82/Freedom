'use client';

import { useMemo, useState } from 'react';
import { ChartLegend, FreedomChart, type Overlay } from '@/components/charts/FreedomChart';
import { IncomeSpendingChart, WithdrawalChart } from '@/components/charts/OtherCharts';
import { ControlsPanel } from '@/components/plan/ControlsPanel';
import { IssuesBanner, PageHeader, SampleBadge } from '@/components/plan/common';
import { MilestoneList, YearTable } from '@/components/plan/Insights';
import { MonteCarloPanel } from '@/components/plan/MonteCarloPanel';
import { EquityAssumptionPicker } from '@/components/plan/Equity';
import { Card, CardHeader, Segmented, Switch, cx } from '@/components/ui';
import { equityBand, projectPlan } from '@/lib/engine';
import { formatMoney } from '@/lib/format';
import { useAnalysis } from '@/lib/hooks';
import { SCENARIO_COLORS, useActivePlan, useStore } from '@/lib/store';

export default function TimelinePage() {
  const plan = useActivePlan()!;
  const updateInputs = useStore((s) => s.updateInputs);
  const mode = useStore((s) => s.dollarMode);
  const setMode = useStore((s) => s.setDollarMode);
  const uiMode = useStore((s) => s.uiMode);
  const analysis = useAnalysis(plan.inputs);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [showTarget, setShowTarget] = useState(true);
  const [overlayIds, setOverlayIds] = useState<string[]>([]);

  const overlays = useMemo<Overlay[]>(
    () =>
      plan.scenarios
        .filter((s) => overlayIds.includes(s.id))
        .map((s, idx) => ({ id: s.id, name: s.name, color: SCENARIO_COLORS[(idx + 1) % SCENARIO_COLORS.length], projection: projectPlan(s.inputs), dashed: true })),
    [plan.scenarios, overlayIds],
  );

  const band = useMemo(() => equityBand(analysis.inputs, mode), [analysis.inputs, mode]);
  const m = analysis.metrics;
  return (
    <div>
      <PageHeader
        eyebrow={<span className="flex items-center gap-2">{plan.name} <SampleBadge isSample={plan.isSample} /></span>}
        title="My Freedom Timeline"
        subtitle="Your projected portfolio from today to the end of your plan. Hover or tap any year to see exactly how it was calculated."
        actions={
          <Segmented
            label="Dollar display"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'real', label: "Today's dollars" },
              { value: 'nominal', label: 'Future dollars' },
            ]}
          />
        }
      />
      <IssuesBanner issues={analysis.issues} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 sm:px-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                <Metric label={`At ${plan.inputs.retirementAge}`} value={formatMoney(m.portfolioAtRetirement[mode], { compact: true })} />
                <Metric label="At 65" value={m.portfolioAt65 ? formatMoney(m.portfolioAt65[mode], { compact: true }) : '—'} />
                <Metric label="At 80" value={m.portfolioAt80 ? formatMoney(m.portfolioAt80[mode], { compact: true }) : '—'} />
                <Metric
                  label={m.depletionAge ? 'Runs short' : `End of plan (${plan.inputs.planningHorizonAge})`}
                  value={m.depletionAge ? `Age ${m.depletionAge}` : formatMoney(m.portfolioAtHorizon[mode], { compact: true })}
                  tone={m.depletionAge ? 'negative' : undefined}
                />
              </div>
              <Segmented
                label="View"
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: 'chart', label: 'Chart' },
                  { value: 'table', label: 'Table' },
                ]}
              />
            </div>
            <div className="px-2 pb-5 pt-4 sm:px-4">
              {view === 'chart' ? (
                <>
                  <FreedomChart analysis={analysis} mode={mode} height={440} overlays={overlays} showTarget={showTarget} band={band} />
                  <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-3">
                    <ChartLegend
                      items={[
                        { label: 'Accumulation', color: 'var(--chart-1)' },
                        { label: 'Withdrawal phase', color: 'var(--chart-2)' },
                        ...(showTarget ? [{ label: 'Freedom Target', color: 'var(--gold)', dashed: true }] : []),
                        { label: 'One-time event', color: 'var(--gold)', dot: true },
                        ...(band.length ? [{ label: 'Range of equity outcomes', color: 'var(--gold)', band: true }] : []),
                        ...overlays.map((o) => ({ label: o.name, color: o.color, dashed: true })),
                      ]}
                    />
                  </div>
                </>
              ) : (
                <div className="px-3">
                  <YearTable projection={analysis.projection} mode={mode} />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line px-5 py-4 sm:px-6">
              <div className="min-w-[220px]">
                <Switch checked={showTarget} onChange={setShowTarget} label="Show Freedom Target" />
              </div>
              {plan.inputs.equity.length > 0 && <EquityAssumptionPicker inputs={plan.inputs} onChange={updateInputs} />}
              {plan.scenarios.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-ink-2">Overlay scenarios:</span>
                  {plan.scenarios.map((s) => {
                    const on = overlayIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        aria-pressed={on}
                        onClick={() => setOverlayIds((ids) => (on ? ids.filter((i) => i !== s.id) : [...ids, s.id].slice(-2)))}
                        className={cx(
                          'rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                          on ? 'border-ink bg-ink text-bg dark:border-accent dark:bg-accent dark:text-accent-ink' : 'border-line text-ink-2 hover:border-line-strong',
                        )}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            <Card>
              <CardHeader title="Retirement income versus spending" subtitle="Where each year’s spending money comes from after full-time work ends." />
              <div className="px-2 pb-5 pt-4 sm:px-4">
                <IncomeSpendingChart projection={analysis.projection} mode={mode} />
                <div className="px-3 pt-3">
                  <ChartLegend
                    items={[
                      { label: 'Work income', color: 'var(--chart-3)' },
                      { label: 'Other income', color: 'var(--chart-1)' },
                      { label: 'From portfolio', color: 'var(--chart-2)' },
                      { label: 'Spending need', color: 'var(--ink)' },
                    ]}
                  />
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader title="Portfolio withdrawals" subtitle="Gross withdrawals (incl. any modeled tax) and the share of the portfolio they represent." />
              <div className="px-2 pb-5 pt-4 sm:px-4">
                <WithdrawalChart projection={analysis.projection} mode={mode} />
                <div className="px-3 pt-3">
                  <ChartLegend
                    items={[
                      { label: 'Withdrawal', color: 'var(--chart-2)' },
                      { label: 'Withdrawal rate', color: 'var(--chart-3)' },
                      { label: 'Target rate', color: 'var(--gold)', dashed: true },
                    ]}
                  />
                </div>
              </div>
            </Card>
          </div>

          {uiMode === 'advanced' && (
            <Card>
              <CardHeader
                title="Monte Carlo simulation"
                subtitle="Beta. A range of outcomes around your deterministic plan, using uneven returns."
              />
              <div className="px-5 pb-6 pt-4 sm:px-6">
                <MonteCarloPanel inputs={plan.inputs} />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Milestones" subtitle="Derived from the projection. Where a milestone cannot be established, it says so." />
            <div className="px-5 pb-6 pt-5 sm:px-6">
              <MilestoneList milestones={analysis.milestones} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Adjust" />
            <div className="px-5 pb-6 pt-5 sm:px-6">
              <ControlsPanel inputs={plan.inputs} onChange={updateInputs} dense={uiMode === 'simple'} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'negative' }) {
  return (
    <div>
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className={cx('tnum text-[20px] font-semibold tracking-[-0.02em]', tone === 'negative' ? 'text-negative' : 'text-ink')}>{value}</div>
    </div>
  );
}
