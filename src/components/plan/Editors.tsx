'use client';

import type { ReactNode } from 'react';
import {
  investableAssets,
  LIMITS,
  newEvent,
  newIncomeStream,
  newProperty,
  newWorkPhase,
  type EquityCase,
  type EventCategory,
  type IncomeStream,
  type OneTimeEvent,
  type PlanInputs,
  type Property,
  type WorkPhase,
} from '@/lib/engine';
import { formatMoney } from '@/lib/format';
import { GLOSSARY } from '@/lib/glossary';
import { Button, InfoTip, NumberInput, Segmented, Select, Switch, TextInput } from '../ui';

export interface EditorProps {
  inputs: PlanInputs;
  onChange: (fn: (p: PlanInputs) => PlanInputs) => void;
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function ItemCard({ children, onRemove, title }: { children: ReactNode; onRemove: () => void; title: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink">{title}</span>
        <Button variant="danger" size="sm" onClick={onRemove} aria-label={`Remove ${title}`}>
          Remove
        </Button>
      </div>
      {children}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-[12.5px] leading-relaxed text-ink-3">{children}</p>;
}

/* ------------------------------------------------------------------ Basics */

export function BasicsEditor({ inputs, onChange }: EditorProps) {
  const set = <K extends keyof PlanInputs>(k: K, v: PlanInputs[K]) => onChange((p) => ({ ...p, [k]: v }));
  return (
    <Grid>
      <NumberInput hideLabel={false} label="Current age" value={inputs.currentAge} integer min={LIMITS.currentAge.min} max={Math.min(LIMITS.currentAge.max, inputs.planningHorizonAge - 1)} onChange={(v) => onChange((p) => ({ ...p, currentAge: v, retirementAge: Math.max(p.retirementAge, v) }))} />
      <NumberInput hideLabel={false} label="Planning horizon (age)" value={inputs.planningHorizonAge} integer min={Math.max(LIMITS.planningHorizonAge.min, inputs.currentAge + 1)} max={LIMITS.planningHorizonAge.max} onChange={(v) => set('planningHorizonAge', v)} />
      <NumberInput hideLabel={false} label="Calendar year at current age" value={inputs.startYear} integer min={2000} max={2100} onChange={(v) => set('startYear', v)} />
      <NumberInput hideLabel={false} label="Savings growth above inflation" value={inputs.savingsRealGrowth} format="percent" min={LIMITS.savingsRealGrowth.min} max={LIMITS.savingsRealGrowth.max} onChange={(v) => set('savingsRealGrowth', v)} />
      <div>
        <NumberInput
          hideLabel={false}
          label="Full-time take-home pay (optional)"
          value={inputs.fullTimeNetIncome ?? 0}
          format="money"
          min={0}
          max={20_000_000}
          onChange={(v) => set('fullTimeNetIncome', v > 0 ? v : null)}
        />
        <p className="mt-1 text-[11.5px] text-ink-3">Used only to total lifetime earnings. Savings stay as entered.</p>
      </div>
    </Grid>
  );
}

/* ------------------------------------------------------------------ Assets */

export function AssetsEditor({ inputs, onChange }: EditorProps) {
  const a = inputs.assets;
  const setA = (patch: Partial<PlanInputs['assets']>) => onChange((p) => ({ ...p, assets: { ...p.assets, ...patch } }));
  const fields: { key: keyof Omit<PlanInputs['assets'], 'mode' | 'total'>; label: string }[] = [
    { key: 'taxable', label: 'Taxable investments' },
    { key: 'traditional', label: 'Traditional retirement (401k, IRA)' },
    { key: 'roth', label: 'Roth accounts' },
    { key: 'cash', label: 'Cash & equivalents' },
    { key: 'other', label: 'Other liquid investments' },
  ];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Asset entry mode"
          value={a.mode}
          onChange={(mode) => setA(mode === 'detailed' && a.taxable + a.traditional + a.roth + a.cash + a.other === 0 ? { mode, taxable: a.total } : { mode, total: mode === 'total' ? investableAssets(a) : a.total })}
          options={[
            { value: 'total', label: 'Single total' },
            { value: 'detailed', label: 'By account type' },
          ]}
          size="sm"
        />
        <span className="tnum text-[13px] text-ink-2">
          Investable total <strong className="font-semibold text-ink">{formatMoney(investableAssets(a))}</strong>
        </span>
      </div>
      <Note>
        Only liquid investments. Home equity and private company stock are modeled separately and are never counted as spendable until a sale or payout is modeled. All accounts share one return assumption; taxes on withdrawals use the effective rate in Withdrawal strategy.
      </Note>
      {a.mode === 'total' ? (
        <div className="max-w-xs">
          <NumberInput hideLabel={false} label="Investable assets" value={a.total} format="money" min={0} max={LIMITS.assets.max} onChange={(v) => setA({ total: v })} />
        </div>
      ) : (
        <Grid>
          {fields.map((f) => (
            <NumberInput key={f.key} hideLabel={false} label={f.label} value={a[f.key]} format="money" min={0} max={LIMITS.assets.max} onChange={(v) => setA({ [f.key]: v })} />
          ))}
        </Grid>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Strategy */

export function StrategyEditor({ inputs, onChange }: EditorProps) {
  const w = inputs.withdrawal;
  const setW = (patch: Partial<PlanInputs['withdrawal']>) => onChange((p) => ({ ...p, withdrawal: { ...p.withdrawal, ...patch } }));
  return (
    <div className="space-y-4">
      <Segmented
        label="Withdrawal strategy"
        value={w.strategy}
        onChange={(strategy) => setW({ strategy })}
        options={[
          { value: 'fixed-real', label: 'Fixed real spending' },
          { value: 'percentage', label: 'Percentage of portfolio' },
        ]}
        size="sm"
      />
      <Note>{w.strategy === 'fixed-real' ? GLOSSARY.fixedReal : GLOSSARY.percentage}</Note>
      <Grid>
        {w.strategy === 'percentage' && (
          <NumberInput hideLabel={false} label="Annual withdrawal (% of portfolio)" value={w.percentageRate} format="percent" min={LIMITS.percentageRate.min} max={LIMITS.percentageRate.max} onChange={(v) => setW({ percentageRate: v })} />
        )}
        <NumberInput hideLabel={false} label="Target withdrawal rate (for Freedom Target)" value={w.targetRate} format="percent" min={LIMITS.targetRate.min} max={LIMITS.targetRate.max} onChange={(v) => setW({ targetRate: v })} />
        <div>
          <NumberInput hideLabel={false} label="Effective tax rate on withdrawals" value={w.taxRate} format="percent" min={LIMITS.taxRate.min} max={LIMITS.taxRate.max} onChange={(v) => setW({ taxRate: v })} />
          <p className="mt-1 text-[11.5px] text-ink-3">0% means your spending target already includes taxes.</p>
        </div>
      </Grid>
    </div>
  );
}

/* ------------------------------------------------------------- Work phases */

export function WorkPhasesEditor({ inputs, onChange }: EditorProps) {
  const update = (id: string, patch: Partial<WorkPhase>) =>
    onChange((p) => ({ ...p, workPhases: p.workPhases.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
  return (
    <div>
      <Note>
        Model consulting, part-time or board work after full-time work ends at {inputs.retirementAge}. Enter after-tax take-home pay in today’s dollars. Income covers spending first; anything left over is invested. Phases are ignored before full-time work ends, because your savings already reflect your earnings — no double counting.
      </Note>
      <div className="space-y-3">
        {inputs.workPhases.map((w) => (
          <ItemCard key={w.id} title={w.label || 'Work phase'} onRemove={() => onChange((p) => ({ ...p, workPhases: p.workPhases.filter((x) => x.id !== w.id) }))}>
            <Grid>
              <TextInput label="Name" value={w.label} onChange={(label) => update(w.id, { label })} />
              <Select
                label="Starts"
                value={w.anchor}
                onChange={(anchor) => update(w.id, { anchor, startAge: anchor === 'age' ? Math.max(w.startAge, inputs.retirementAge) : w.startAge })}
                options={[
                  { value: 'retirement', label: 'When full-time work ends' },
                  { value: 'age', label: 'At a specific age' },
                ]}
              />
              {w.anchor === 'age' && (
                <NumberInput hideLabel={false} label="Start age" value={w.startAge} integer min={inputs.currentAge} max={inputs.planningHorizonAge} onChange={(startAge) => update(w.id, { startAge })} />
              )}
              <NumberInput hideLabel={false} label="Years" value={w.years} integer min={1} max={50} onChange={(years) => update(w.id, { years })} />
              <NumberInput hideLabel={false} label="After-tax income per year" value={w.annualNetIncome} format="money" min={0} max={LIMITS.workIncome.max} onChange={(annualNetIncome) => update(w.id, { annualNetIncome })} />
              <NumberInput hideLabel={false} label="Income growth above inflation" value={w.incomeRealGrowth} format="percent" min={-0.2} max={0.2} onChange={(incomeRealGrowth) => update(w.id, { incomeRealGrowth })} />
              <div>
                <NumberInput hideLabel={false} label="Spending during phase (optional)" value={w.spendingOverride ?? 0} format="money" min={0} max={LIMITS.retirementSpending.max} onChange={(v) => update(w.id, { spendingOverride: v > 0 ? v : null })} />
                <p className="mt-1 text-[11.5px] text-ink-3">Leave at $0 to use your retirement spending.</p>
              </div>
            </Grid>
          </ItemCard>
        ))}
      </div>
      <Button size="sm" className="mt-3" onClick={() => onChange((p) => ({ ...p, workPhases: [...p.workPhases, newWorkPhase({ anchor: p.workPhases.length ? 'age' : 'retirement', startAge: p.retirementAge + 5 * p.workPhases.length })] }))}>
        + Add work phase
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------ Other income */

export function IncomeStreamsEditor({ inputs, onChange }: EditorProps) {
  const update = (id: string, patch: Partial<IncomeStream>) =>
    onChange((p) => ({ ...p, incomeStreams: p.incomeStreams.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  return (
    <div>
      <Note>Pensions, Social Security, annuities or rental income received after full-time work ends. Enter after-tax amounts.</Note>
      <div className="space-y-3">
        {inputs.incomeStreams.map((s) => (
          <ItemCard key={s.id} title={s.label || 'Income'} onRemove={() => onChange((p) => ({ ...p, incomeStreams: p.incomeStreams.filter((x) => x.id !== s.id) }))}>
            <Grid>
              <TextInput label="Name" value={s.label} onChange={(label) => update(s.id, { label })} />
              <NumberInput hideLabel={false} label="Starts at age" value={s.startAge} integer min={inputs.currentAge} max={LIMITS.planningHorizonAge.max} onChange={(startAge) => update(s.id, { startAge })} />
              <NumberInput hideLabel={false} label="Ends at age (200 = for life)" value={s.endAge} integer min={s.startAge + 1} max={200} onChange={(endAge) => update(s.id, { endAge })} />
              <NumberInput hideLabel={false} label="After-tax amount per year" value={s.annualAmount} format="money" min={0} max={LIMITS.workIncome.max} onChange={(annualAmount) => update(s.id, { annualAmount })} />
              <div className="sm:col-span-2">
                <Switch checked={s.inflationAdjusted} onChange={(inflationAdjusted) => update(s.id, { inflationAdjusted })} label="Rises with inflation" description={s.inflationAdjusted ? 'Amount is in today’s dollars.' : 'Fixed future-dollar amount (loses purchasing power).'} />
              </div>
            </Grid>
          </ItemCard>
        ))}
      </div>
      <Button size="sm" className="mt-3" onClick={() => onChange((p) => ({ ...p, incomeStreams: [...p.incomeStreams, newIncomeStream()] }))}>
        + Add income
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------- Events */

const CATEGORY_OPTIONS: { value: EventCategory; label: string; sign: 1 | -1 }[] = [
  { value: 'equity', label: 'Equity payout', sign: 1 },
  { value: 'inheritance', label: 'Inheritance', sign: 1 },
  { value: 'home-sale', label: 'Home sale', sign: 1 },
  { value: 'business-sale', label: 'Business sale', sign: 1 },
  { value: 'home-purchase', label: 'Home purchase', sign: -1 },
  { value: 'college', label: 'College expense', sign: -1 },
  { value: 'medical', label: 'Major medical expense', sign: -1 },
  { value: 'gift', label: 'Charitable gift', sign: -1 },
  { value: 'other', label: 'Other', sign: 1 },
];

export function EventsEditor({ inputs, onChange }: EditorProps) {
  const update = (id: string, patch: Partial<OneTimeEvent>) =>
    onChange((p) => ({ ...p, events: p.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  return (
    <div>
      <Note>
        One-time money in or out. Enter net, after-tax amounts <InfoTip term="Net after tax">{GLOSSARY.netAfterTax}</InfoTip>. Money in arrives at year end; money out leaves at the start of the year.
      </Note>
      <div className="space-y-3">
        {inputs.events.map((e) => {
          const inflow = e.amount >= 0;
          return (
            <ItemCard key={e.id} title={e.label || 'Event'} onRemove={() => onChange((p) => ({ ...p, events: p.events.filter((x) => x.id !== e.id) }))}>
              <Grid>
                <TextInput label="Name" value={e.label} onChange={(label) => update(e.id, { label })} />
                <Select
                  label="Type"
                  value={e.category}
                  onChange={(category) => {
                    const sign = CATEGORY_OPTIONS.find((c) => c.value === category)?.sign ?? 1;
                    update(e.id, { category, amount: Math.abs(e.amount) * sign });
                  }}
                  options={CATEGORY_OPTIONS.map(({ value, label }) => ({ value, label }))}
                />
                <NumberInput hideLabel={false} label="At age" value={e.age} integer min={inputs.currentAge} max={inputs.planningHorizonAge} onChange={(age) => update(e.id, { age })} />
                <div>
                  <span className="mb-1 block text-[13px] text-ink-2">Direction</span>
                  <Segmented
                    label="Cash flow direction"
                    value={inflow ? 'in' : 'out'}
                    onChange={(d) => update(e.id, { amount: Math.abs(e.amount) * (d === 'in' ? 1 : -1) })}
                    options={[
                      { value: 'in', label: 'Money in' },
                      { value: 'out', label: 'Money out' },
                    ]}
                    size="sm"
                  />
                </div>
                <NumberInput hideLabel={false} label="Net amount" value={Math.abs(e.amount)} format="money" min={0} max={LIMITS.assets.max} onChange={(v) => update(e.id, { amount: inflow ? v : -v })} />
                <TextInput label="Tax assumption (note)" value={e.taxNote} placeholder="e.g. after 37% federal + state" onChange={(taxNote) => update(e.id, { taxNote })} />
                <div className="sm:col-span-2 lg:col-span-3">
                  <Switch checked={e.inflationAdjusted} onChange={(inflationAdjusted) => update(e.id, { inflationAdjusted })} label="Amount is in today’s dollars" description={e.inflationAdjusted ? 'It will be inflated to the year it happens.' : 'Treated as a fixed future-dollar amount.'} />
                </div>
              </Grid>
            </ItemCard>
          );
        })}
      </div>
      <Button size="sm" className="mt-3" onClick={() => onChange((p) => ({ ...p, events: [...p.events, newEvent({ age: Math.min(p.currentAge + 5, p.planningHorizonAge) })] }))}>
        + Add event
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------- Equity */

export function EquityEditor({ inputs, onChange }: EditorProps) {
  const pe = inputs.privateEquity;
  const setPe = (patch: Partial<PlanInputs['privateEquity']>) => onChange((p) => ({ ...p, privateEquity: { ...p.privateEquity, ...patch } }));
  return (
    <div className="space-y-4">
      <Switch checked={pe.enabled} onChange={(enabled) => setPe({ enabled, selectedCase: enabled && pe.selectedCase === 'none' ? 'base' : pe.selectedCase })} label="Model a private equity liquidity event" description="Private company equity is never counted as spendable before the payout year." />
      {pe.enabled && (
        <>
          <Grid>
            <TextInput label="Name" value={pe.label} onChange={(label) => setPe({ label })} />
            <NumberInput hideLabel={false} label="Expected at age" value={pe.age} integer min={inputs.currentAge} max={inputs.planningHorizonAge} onChange={(age) => setPe({ age })} />
            <div />
            <NumberInput hideLabel={false} label="Conservative net payout" value={pe.conservative} format="money" min={0} max={LIMITS.assets.max} onChange={(conservative) => setPe({ conservative })} />
            <NumberInput hideLabel={false} label="Base net payout" value={pe.base} format="money" min={0} max={LIMITS.assets.max} onChange={(base) => setPe({ base })} />
            <NumberInput hideLabel={false} label="Optimistic net payout" value={pe.optimistic} format="money" min={0} max={LIMITS.assets.max} onChange={(optimistic) => setPe({ optimistic })} />
          </Grid>
          <div>
            <span className="mb-1.5 block text-[13px] text-ink-2">Case used in this plan</span>
            <Segmented<EquityCase>
              label="Equity case"
              value={pe.selectedCase}
              onChange={(selectedCase) => setPe({ selectedCase })}
              options={[
                { value: 'none', label: 'No payout' },
                { value: 'conservative', label: 'Conservative' },
                { value: 'base', label: 'Base' },
                { value: 'optimistic', label: 'Optimistic' },
              ]}
              size="sm"
            />
          </div>
          <Switch checked={pe.inflationAdjusted} onChange={(inflationAdjusted) => setPe({ inflationAdjusted })} label="Amounts are in today’s dollars" description={pe.inflationAdjusted ? 'Payouts will be inflated to the payout year.' : 'Payouts are fixed future-dollar amounts (typical for deal estimates).'} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Real estate */

export function RealEstateEditor({ inputs, onChange }: EditorProps) {
  const update = (id: string, patch: Partial<Property>) =>
    onChange((p) => ({ ...p, properties: p.properties.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const updateSale = (id: string, patch: Partial<Property['sale']>) =>
    onChange((p) => ({ ...p, properties: p.properties.map((x) => (x.id === id ? { ...x, sale: { ...x.sale, ...patch } } : x)) }));
  return (
    <div>
      <Note>
        Home equity is not treated as spendable. A property affects your portfolio only when you model a sale (proceeds are added once, at year end) or choose to pay its costs from the portfolio in retirement.
      </Note>
      <div className="space-y-3">
        {inputs.properties.map((h) => (
          <ItemCard key={h.id} title={h.label || 'Property'} onRemove={() => onChange((p) => ({ ...p, properties: p.properties.filter((x) => x.id !== h.id) }))}>
            <Grid>
              <TextInput label="Name" value={h.label} onChange={(label) => update(h.id, { label })} />
              <NumberInput hideLabel={false} label="Estimated value" value={h.currentValue} format="money" min={0} max={LIMITS.assets.max} onChange={(currentValue) => update(h.id, { currentValue })} />
              <NumberInput hideLabel={false} label="Appreciation per year" value={h.appreciation} format="percent" min={-0.1} max={0.15} onChange={(appreciation) => update(h.id, { appreciation })} />
              <NumberInput hideLabel={false} label="Mortgage balance" value={h.mortgageBalance} format="money" min={0} max={LIMITS.assets.max} onChange={(mortgageBalance) => update(h.id, { mortgageBalance })} />
              <NumberInput hideLabel={false} label="Mortgage rate" value={h.mortgageRate} format="percent" min={0} max={0.2} onChange={(mortgageRate) => update(h.id, { mortgageRate })} />
              <NumberInput hideLabel={false} label="Annual mortgage payment (P&I)" value={h.annualMortgagePayment} format="money" min={0} max={10_000_000} onChange={(annualMortgagePayment) => update(h.id, { annualMortgagePayment })} />
              <NumberInput hideLabel={false} label="Annual carrying costs" value={h.annualCarryingCosts} format="money" min={0} max={5_000_000} onChange={(annualCarryingCosts) => update(h.id, { annualCarryingCosts })} />
              <div className="sm:col-span-2">
                <Switch
                  checked={h.costsSeparateFromSpending}
                  onChange={(costsSeparateFromSpending) => update(h.id, { costsSeparateFromSpending })}
                  label="Pay these costs on top of retirement spending"
                  description={
                    h.costsSeparateFromSpending
                      ? 'After full-time work, mortgage payments and carrying costs are paid from the portfolio, and carrying costs are added to the Freedom Target.'
                      : 'Costs are assumed to be inside your retirement spending target (avoids double counting).'
                  }
                />
              </div>
            </Grid>
            <div className="mt-4 border-t border-line pt-4">
              <Switch checked={h.sale.enabled} onChange={(enabled) => updateSale(h.id, { enabled })} label="Plan to sell" description="Net proceeds are added to investable assets in the sale year." />
              {h.sale.enabled && (
                <div className="mt-3">
                  <Grid>
                    <NumberInput hideLabel={false} label="Sell at age" value={h.sale.age} integer min={inputs.currentAge} max={inputs.planningHorizonAge} onChange={(age) => updateSale(h.id, { age })} />
                    <NumberInput hideLabel={false} label="Selling costs" value={h.sale.sellingCostRate} format="percent" min={0} max={0.2} onChange={(sellingCostRate) => updateSale(h.id, { sellingCostRate })} />
                    <div>
                      <NumberInput hideLabel={false} label="Net proceeds override (optional)" value={h.sale.netProceedsOverride ?? 0} format="money" min={0} max={LIMITS.assets.max} onChange={(v) => updateSale(h.id, { netProceedsOverride: v > 0 ? v : null })} />
                      <p className="mt-1 text-[11.5px] text-ink-3">Future dollars, after costs, mortgage and taxes. $0 = estimate from value.</p>
                    </div>
                  </Grid>
                  <p className="mt-2 text-[12px] text-ink-3">Buying a replacement home? Add it as a “Home purchase” event.</p>
                </div>
              )}
            </div>
          </ItemCard>
        ))}
      </div>
      <Button size="sm" className="mt-3" onClick={() => onChange((p) => ({ ...p, properties: [...p.properties, newProperty({ label: p.properties.length ? 'Second home' : 'Primary home', isPrimaryResidence: !p.properties.length })] }))}>
        + Add property
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------- Downturn */

export function DownturnEditor({ inputs, onChange }: EditorProps) {
  const d = inputs.downturn;
  const setD = (patch: Partial<PlanInputs['downturn']>) => onChange((p) => ({ ...p, downturn: { ...p.downturn, ...patch } }));
  return (
    <div className="space-y-4">
      <Switch
        checked={d.enabled}
        onChange={(enabled) => setD({ enabled, age: enabled ? inputs.retirementAge : d.age })}
        label="Stress-test a market downturn"
        description="A deterministic “what if” — one assumed bad year. It is not a forecast or a probability."
      />
      {d.enabled && (
        <Grid>
          <NumberInput hideLabel={false} label="Downturn at age" value={d.age} integer min={inputs.currentAge} max={inputs.planningHorizonAge} onChange={(age) => setD({ age })} />
          <NumberInput hideLabel={false} label="Portfolio decline" value={d.decline} format="percent" min={0} max={0.8} onChange={(decline) => setD({ decline })} />
          <NumberInput hideLabel={false} label="Return in following years" value={d.recoveryReturn} format="percent" min={-0.2} max={0.3} onChange={(recoveryReturn) => setD({ recoveryReturn })} />
          <NumberInput hideLabel={false} label="Years at that return" value={d.recoveryYears} integer min={0} max={30} onChange={(recoveryYears) => setD({ recoveryYears })} />
        </Grid>
      )}
    </div>
  );
}
