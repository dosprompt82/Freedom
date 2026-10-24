'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CompareChart } from '@/components/charts/OtherCharts';
import { ChartLegend } from '@/components/charts/FreedomChart';
import { ControlsPanel } from '@/components/plan/ControlsPanel';
import { PageHeader, SampleBadge } from '@/components/plan/common';
import {
  DownturnEditor,
  EventsEditor,
  RealEstateEditor,
  StrategyEditor,
  WorkPhasesEditor,
} from '@/components/plan/Editors';
import { EquityEditor } from '@/components/plan/Equity';
import { InsightList } from '@/components/plan/Insights';
import { Badge, Button, Card, CardHeader, Disclosure, TextInput, cx } from '@/components/ui';
import {
  analyzePlan,
  comparisonInsights,
  SCENARIO_TEMPLATES,
  type DollarMode,
  type PlanAnalysis,
  type PlanInputs,
} from '@/lib/engine';
import { formatMoney } from '@/lib/format';
import { BASE_ID, MAX_COMPARE, SCENARIO_COLORS, useActivePlan, useStore, type Plan } from '@/lib/store';

interface Entry {
  id: string;
  name: string;
  description: string;
  inputs: PlanInputs;
}

function entriesFor(plan: Plan): Entry[] {
  return [
    { id: BASE_ID, name: 'Current plan', description: 'Your baseline from My Financial Picture.', inputs: plan.inputs },
    ...plan.scenarios.map((s) => ({ id: s.id, name: s.name, description: s.description, inputs: s.inputs })),
  ];
}

export default function ScenarioLabPage() {
  const plan = useActivePlan()!;
  const store = useStore();
  const mode = store.dollarMode;
  const [selected, setSelected] = useState<string>(plan.scenarios[0]?.id ?? BASE_ID);
  const entries = entriesFor(plan);
  const deferredPlan = useDeferredValue(plan);

  useEffect(() => {
    if (!entries.some((e) => e.id === selected)) setSelected(BASE_ID);
  }, [entries, selected]);

  const compared = useMemo(() => {
    const all = entriesFor(deferredPlan);
    return deferredPlan.compare
      .map((id) => all.find((e) => e.id === id))
      .filter((e): e is Entry => !!e)
      .map((e, idx) => ({ ...e, color: SCENARIO_COLORS[idx % SCENARIO_COLORS.length], analysis: analyzePlan(e.inputs) }));
  }, [deferredPlan]);

  const insights = useMemo(() => {
    if (compared.length < 2) return [];
    const [base, ...rest] = compared;
    const row = (c: (typeof compared)[number]) => ({ id: c.id, name: c.name, metrics: c.analysis.metrics, workOptional: c.analysis.workOptional, targetAge: c.analysis.targetAge });
    return rest.flatMap((c) => comparisonInsights(row(base), row(c)));
  }, [compared]);

  const sel = entries.find((e) => e.id === selected) ?? entries[0];
  const updateSel = (fn: (p: PlanInputs) => PlanInputs) =>
    sel.id === BASE_ID ? store.updateInputs(fn) : store.updateScenario(sel.id, fn);

  return (
    <div>
      <PageHeader
        eyebrow={<span className="flex items-center gap-2">{plan.name} <SampleBadge isSample={plan.isSample} /></span>}
        title="What If? Scenario Lab"
        subtitle="Explore alternative futures side by side. Compare up to three, and see the tradeoffs in plain English."
        actions={<NewScenarioMenu onCreate={(id) => id && setSelected(id)} />}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader title="Scenarios" subtitle={`Tick up to ${MAX_COMPARE} to compare.`} />
          <ul className="mt-3 px-2 pb-3">
            {entries.map((e) => {
              const cmpIdx = plan.compare.indexOf(e.id);
              const inCompare = cmpIdx >= 0;
              const full = !inCompare && plan.compare.length >= MAX_COMPARE;
              return (
                <li key={e.id}>
                  <div
                    className={cx(
                      'group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors',
                      selected === e.id ? 'bg-surface-2' : 'hover:bg-surface-2/60',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={inCompare}
                      disabled={full}
                      onChange={() => store.toggleCompare(e.id)}
                      aria-label={`Compare ${e.name}`}
                      title={full ? `You can compare up to ${MAX_COMPARE}` : 'Compare'}
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                    <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(e.id)} aria-current={selected === e.id}>
                      <span className="flex items-center gap-2">
                        {inCompare && (
                          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: SCENARIO_COLORS[cmpIdx % SCENARIO_COLORS.length] }} aria-hidden />
                        )}
                        <span className="truncate text-[13.5px] font-medium text-ink">{e.name}</span>
                      </span>
                      <span className="block truncate text-[12px] text-ink-3">{e.description}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Comparison" subtitle={`Projected portfolio by age, ${mode === 'real' ? "today's" : 'future'} dollars.`} />
            <div className="px-2 pb-5 pt-4 sm:px-4">
              {compared.length ? (
                <>
                  <CompareChart series={compared.map((c, i) => ({ id: c.id, name: c.name, color: c.color, projection: c.analysis.projection, dashed: i > 0 }))} mode={mode} />
                  <div className="px-3 pt-3">
                    <ChartLegend items={compared.map((c, i) => ({ label: c.name, color: c.color, dashed: i > 0 }))} />
                  </div>
                </>
              ) : (
                <p className="px-3 py-12 text-center text-[13px] text-ink-3">Tick a scenario on the left to compare.</p>
              )}
            </div>
            {compared.length > 0 && <CompareTable compared={compared} mode={mode} />}
          </Card>

          {insights.length > 0 && (
            <Card>
              <CardHeader title="Major tradeoffs" subtitle={`Each scenario compared with ${compared[0].name}, computed from the model.`} />
              <div className="px-5 pb-5 pt-4 sm:px-6">
                <InsightList insights={insights} />
              </div>
            </Card>
          )}

          <ScenarioEditor key={sel.id} entry={sel} onChange={updateSel} onSelect={setSelected} />
        </div>
      </div>
    </div>
  );
}

function CompareTable({ compared, mode }: { compared: (Entry & { color: string; analysis: PlanAnalysis })[]; mode: DollarMode }) {
  const f = (n: number | undefined | null) => (n == null ? '—' : formatMoney(n, { compact: true }));
  const rows: { label: string; get: (a: PlanAnalysis) => React.ReactNode }[] = [
    { label: 'Full-time work ends', get: (a) => `Age ${a.inputs.retirementAge}` },
    {
      label: 'Equity assumed',
      get: (a) => (a.inputs.equity.length ? (a.inputs.equityAssumption.outcome === 'none' ? 'No payout' : `${a.inputs.equityAssumption.outcome}, ${a.inputs.equityAssumption.timing}`) : '—'),
    },
    { label: 'Portfolio at retirement', get: (a) => f(a.metrics.portfolioAtRetirement[mode]) },
    { label: 'Portfolio at 65', get: (a) => f(a.metrics.portfolioAt65?.[mode]) },
    { label: 'Portfolio at 80', get: (a) => f(a.metrics.portfolioAt80?.[mode]) },
    { label: `Portfolio at end of plan`, get: (a) => f(a.metrics.portfolioAtHorizon[mode]) },
    { label: 'Freedom Target', get: (a) => f(a.metrics.freedomTarget[mode]) },
    {
      label: 'Funding gap / surplus',
      get: (a) => {
        const g = a.metrics.fundingGap[mode];
        return <span className={g >= 0 ? 'text-accent' : 'text-caution'}>{g >= 0 ? '+' : '−'}{f(Math.abs(g))}</span>;
      },
    },
    { label: 'Total years worked', get: (a) => `${a.metrics.totalYearsWorked}${a.metrics.transitionYears ? ` (${a.metrics.transitionYears} part-time)` : ''}` },
    {
      label: 'Earned income from now (today’s $)',
      get: (a) => (a.metrics.totalEarnedIncomeReal == null ? <span className="text-ink-3" title="Add full-time take-home pay under Age and horizon">{f(a.metrics.transitionIncomeReal)}*</span> : f(a.metrics.totalEarnedIncomeReal)),
    },
    { label: 'Work-optional age', get: (a) => (a.workOptional == null ? 'Not reached' : `Age ${a.workOptional}`) },
    {
      label: 'Portfolio depletion',
      get: (a) => (a.metrics.depletionAge == null ? <span className="text-accent">Lasts to {a.inputs.planningHorizonAge}</span> : <span className="text-negative">Age {a.metrics.depletionAge}</span>),
    },
  ];
  return (
    <div className="overflow-x-auto border-t border-line">
      <table className="tnum w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="px-5 py-3 text-left text-[12px] font-medium text-ink-3 sm:px-6">
              <span className="sr-only">Metric</span>
            </th>
            {compared.map((c) => (
              <th key={c.id} scope="col" className="px-4 py-3 text-right text-[12.5px] font-semibold text-ink">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
                  {c.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line/60 last:border-0">
              <th scope="row" className="px-5 py-2.5 text-left font-normal text-ink-2 sm:px-6">{r.label}</th>
              {compared.map((c) => (
                <td key={c.id} className="px-4 py-2.5 text-right text-ink">{r.get(c.analysis)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {compared.some((c) => c.analysis.metrics.totalEarnedIncomeReal == null) && (
        <p className="px-5 pb-4 pt-2 text-[11.5px] text-ink-3 sm:px-6">* Part-time income only. Add your full-time take-home pay (Financial Picture → Age and horizon) to include full-time earnings.</p>
      )}
    </div>
  );
}

function NewScenarioMenu({ onCreate }: { onCreate: (id: string | null) => void }) {
  const addScenario = useStore((s) => s.addScenario);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const create = (opts: { templateId?: string; fromId?: string }) => {
    onCreate(addScenario(opts));
    setOpen(false);
  };
  return (
    <div ref={ref} className="relative">
      <Button variant="primary" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        + New scenario
      </Button>
      {open && (
        <div role="menu" className="fa-rise absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-2xl border border-line bg-surface shadow-float">
          <button role="menuitem" onClick={() => create({ fromId: BASE_ID })} className="block w-full border-b border-line px-4 py-3 text-left hover:bg-surface-2">
            <span className="block text-[13.5px] font-medium text-ink">Blank copy of current plan</span>
            <span className="block text-[12px] text-ink-3">Start from your baseline and change anything.</span>
          </button>
          <div className="max-h-[360px] overflow-y-auto py-1">
            <div className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-ink-3">Start from a template</div>
            {SCENARIO_TEMPLATES.map((t) => (
              <button key={t.id} role="menuitem" onClick={() => create({ templateId: t.id })} className="block w-full px-4 py-2 text-left hover:bg-surface-2">
                <span className="block text-[13px] font-medium text-ink">{t.name}</span>
                <span className="block text-[12px] text-ink-3">{t.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioEditor({ entry, onChange, onSelect }: { entry: Entry; onChange: (fn: (p: PlanInputs) => PlanInputs) => void; onSelect: (id: string) => void }) {
  const store = useStore();
  const uiMode = store.uiMode;
  const isBase = entry.id === BASE_ID;
  const [confirm, setConfirm] = useState(false);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-[12px] text-ink-3">
            Editing {isBase ? <Badge>Baseline</Badge> : <Badge tone="gold">Scenario</Badge>}
          </div>
          {isBase ? (
            <h2 className="text-[17px] font-semibold text-ink">Current plan</h2>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <TextInput label="Scenario name" value={entry.name} onChange={(name) => store.renameScenario(entry.id, name)} />
              <TextInput label="Description" value={entry.description} onChange={(d) => store.renameScenario(entry.id, entry.name, d)} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 sm:mt-5">
          <Button size="sm" onClick={() => { const id = store.addScenario({ fromId: entry.id }); if (id) onSelect(id); }}>
            Duplicate
          </Button>
          {!isBase &&
            (confirm ? (
              <>
                <Button size="sm" variant="danger" onClick={() => { store.deleteScenario(entry.id); onSelect(BASE_ID); }}>
                  Confirm delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>
                Delete
              </Button>
            ))}
        </div>
      </div>
      <div className="max-w-2xl px-5 pb-6 pt-5 sm:px-6">
        <ControlsPanel inputs={entry.inputs} onChange={onChange} />
      </div>
      {uiMode === 'advanced' && (
        <div className="border-t border-line">
          <Disclosure title="Withdrawal strategy"><StrategyEditor inputs={entry.inputs} onChange={onChange} /></Disclosure>
          <Disclosure title="Work after full-time"><WorkPhasesEditor inputs={entry.inputs} onChange={onChange} /></Disclosure>
          <Disclosure title="One-time events"><EventsEditor inputs={entry.inputs} onChange={onChange} /></Disclosure>
          <Disclosure title="Company equity"><EquityEditor inputs={entry.inputs} onChange={onChange} /></Disclosure>
          <Disclosure title="Real estate"><RealEstateEditor inputs={entry.inputs} onChange={onChange} /></Disclosure>
          <Disclosure title="Market downturn"><DownturnEditor inputs={entry.inputs} onChange={onChange} /></Disclosure>
        </div>
      )}
    </Card>
  );
}
