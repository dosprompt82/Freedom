'use client';

import Link from 'next/link';
import { ChartLegend, FreedomChart } from '@/components/charts/FreedomChart';
import { ControlsPanel } from '@/components/plan/ControlsPanel';
import { IssuesBanner, PageHeader, SampleBadge, Disclaimer } from '@/components/plan/common';
import {
  AssetsEditor,
  BasicsEditor,
  DownturnEditor,
  EventsEditor,
  IncomeStreamsEditor,
  RealEstateEditor,
  StrategyEditor,
  WorkPhasesEditor,
} from '@/components/plan/Editors';
import { EquityBadge, EquityEditor, EquityPanel } from '@/components/plan/Equity';
import { InsightList } from '@/components/plan/Insights';
import { KpiCards } from '@/components/plan/KpiCards';
import { Badge, Card, CardHeader, Disclosure, Stat } from '@/components/ui';
import { equityBand, investableAssets } from '@/lib/engine';
import { useMemo, useState } from 'react';
import { LifeEventsCard } from '@/components/plan/LifeEvents';
import { formatMoney } from '@/lib/format';
import { useAnalysis } from '@/lib/hooks';
import { useActivePlan, useStore } from '@/lib/store';

export default function FinancialPicturePage() {
  const plan = useActivePlan()!;
  const updateInputs = useStore((s) => s.updateInputs);
  const mode = useStore((s) => s.dollarMode);
  const uiMode = useStore((s) => s.uiMode);
  const setUiMode = useStore((s) => s.setUiMode);
  const analysis = useAnalysis(plan.inputs);
  const { inputs } = plan;
  const [openSection, setOpenSection] = useState<'income' | 'events' | 'home' | null>(null);
  const openAndScroll = (section: 'income' | 'events' | 'home') => {
    setOpenSection(section);
    setTimeout(() => document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const band = useMemo(() => equityBand(analysis.inputs, mode), [analysis.inputs, mode]);
  const unit = mode === 'real' ? "today's dollars" : 'future dollars';

  return (
    <div>
      <PageHeader
        eyebrow={<span className="flex items-center gap-2">{plan.name} <SampleBadge isSample={plan.isSample} /></span>}
        title="My Financial Picture"
        subtitle="Where you stand today, where your current path leads, and what the numbers are telling you. Every figure updates as you adjust."
      />
      <IssuesBanner issues={analysis.issues} />

      <KpiCards analysis={analysis} mode={mode} equity={analysis.equity} />

      <Card className="mt-5">
        <CardHeader
          title="Company equity and liquidity"
          subtitle="Wealth you own but can’t spend yet. Modeled as a range of outcomes and timings, never as cash until it pays out."
          action={<EquityBadge inputs={inputs} />}
        />
        <EquityPanel inputs={inputs} onChange={updateInputs} analysis={analysis.equity} />
        {inputs.equity.length > 0 && (
          <div className="border-t border-line">
            <Disclosure title="Edit equity holdings" subtitle={`${inputs.equity.length} holding${inputs.equity.length === 1 ? '' : 's'} · values, tax, timing window, probability`}>
              <EquityEditor inputs={inputs} onChange={updateInputs} />
            </Disclosure>
          </div>
        )}
      </Card>

      <LifeEventsCard inputs={inputs} onChange={updateInputs} onOpen={openAndScroll} />

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title="Your path to work-optional"
              subtitle={`Projected investable assets by age, ${unit}.`}
              action={
                <Link href="/app/timeline" className="text-[13px] font-medium text-accent hover:underline">
                  Open timeline →
                </Link>
              }
            />
            <div className="px-2 pb-4 pt-2 sm:px-4">
              <FreedomChart analysis={analysis} mode={mode} height={320} band={band} />
              <div className="px-3 pt-2">
                <ChartLegend
                  items={[
                    { label: 'Accumulation', color: 'var(--chart-1)' },
                    { label: 'Withdrawal phase', color: 'var(--chart-2)' },
                    ...(analysis.workOptional != null && analysis.workOptional !== analysis.inputs.retirementAge ? [{ label: 'Work-optional age', color: 'var(--gold)' }] : []),
                    { label: 'One-time event', color: 'var(--gold)', dot: true },
                    ...(band.length ? [{ label: 'Range of equity outcomes', color: 'var(--gold)', band: true }] : []),
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="What Your Numbers Are Telling You" subtitle="Observations computed from your plan by re-running the model with one assumption changed. Nothing here is a guarantee." />
            <div className="px-5 pb-5 pt-4 sm:px-6">
              <InsightList insights={analysis.insights} limit={6} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="xl:sticky xl:top-20">
            <CardHeader title="Adjust your assumptions" subtitle="Drag to explore, or type an exact value." />
            <div className="px-5 pb-6 pt-5 sm:px-6">
              <ControlsPanel inputs={inputs} onChange={updateInputs} dense={uiMode === 'simple'} />
              {uiMode === 'simple' && (
                <button onClick={() => setUiMode('advanced')} className="mt-5 text-[12.5px] font-medium text-accent hover:underline">
                  Show inflation →
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Your details"
          subtitle="Edit anything without restarting. Only add what changes a decision."
          action={<Badge tone={uiMode === 'advanced' ? 'positive' : 'neutral'}>{uiMode === 'advanced' ? 'Advanced mode' : 'Simple mode'}</Badge>}
        />
        <div className="mt-4 grid grid-cols-2 gap-5 border-y border-line px-5 py-4 sm:grid-cols-4 sm:px-6">
          <Stat label="Current age" value={inputs.currentAge} />
          <Stat label="Planned retirement age" value={inputs.retirementAge} />
          <Stat label="Investable assets" value={formatMoney(investableAssets(inputs.assets), { compact: true })} sub="Today" />
          <Stat label="Annual savings" value={formatMoney(inputs.annualSavings, { compact: true })} sub="Today's dollars" />
        </div>
        <div>
          <Disclosure id="section-income" open={openSection === 'income'} onOpenChange={(o) => setOpenSection(o ? 'income' : null)} title="Social Security, pensions and other income" subtitle="Income after full-time work ends" badge={inputs.incomeStreams.length ? <Badge>{inputs.incomeStreams.length}</Badge> : undefined}>
            <IncomeStreamsEditor inputs={inputs} onChange={updateInputs} />
          </Disclosure>
          <Disclosure id="section-events" open={openSection === 'events'} onOpenChange={(o) => setOpenSection(o ? 'events' : null)} title="Big one-time costs and windfalls" subtitle="College, home purchases, inheritances, gifts" badge={inputs.events.length ? <Badge>{inputs.events.length}</Badge> : undefined}>
            <EventsEditor inputs={inputs} onChange={updateInputs} />
          </Disclosure>
          <Disclosure id="section-home" open={openSection === 'home'} onOpenChange={(o) => setOpenSection(o ? 'home' : null)} title="Home and real estate" subtitle="Value, mortgage, carrying costs, planned sale" badge={inputs.properties.length ? <Badge>{inputs.properties.length}</Badge> : undefined}>
            <RealEstateEditor inputs={inputs} onChange={updateInputs} />
          </Disclosure>
          <Disclosure title="Age and horizon" subtitle="Current age, planning horizon, savings growth" defaultOpen={false}>
            <BasicsEditor inputs={inputs} onChange={updateInputs} />
          </Disclosure>
          <Disclosure title="Investable assets" subtitle="A single total, or by account type">
            <AssetsEditor inputs={inputs} onChange={updateInputs} />
          </Disclosure>
          {uiMode === 'advanced' ? (
            <>
              <Disclosure title="Withdrawal strategy" subtitle={inputs.withdrawal.strategy === 'fixed-real' ? 'Fixed real spending' : 'Percentage of portfolio'}>
                <StrategyEditor inputs={inputs} onChange={updateInputs} />
              </Disclosure>
              <Disclosure title="Work after full-time" subtitle="Consulting, part-time and other employment phases" badge={inputs.workPhases.length ? <Badge>{inputs.workPhases.length}</Badge> : undefined}>
                <WorkPhasesEditor inputs={inputs} onChange={updateInputs} />
              </Disclosure>
              <Disclosure title="Market downturn stress test" subtitle="A one-time decline at a chosen age" badge={inputs.downturn.enabled ? <Badge tone="caution">On</Badge> : undefined}>
                <DownturnEditor inputs={inputs} onChange={updateInputs} />
              </Disclosure>
            </>
          ) : (
            <div className="border-t border-line px-5 py-4 text-[13px] text-ink-2 sm:px-6">
              Multiple work phases, withdrawal strategy and market stress tests live in{' '}
              <button onClick={() => setUiMode('advanced')} className="font-medium text-accent hover:underline">
                Advanced mode
              </button>
              .
            </div>
          )}
        </div>
      </Card>
      <Disclaimer className="mt-8 max-w-3xl" />
    </div>
  );
}
