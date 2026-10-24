'use client';

import {
  LIMITS,
  netProceeds,
  newEquityHolding,
  OUTCOMES,
  TIMINGS,
  type EquityAnalysis,
  type EquityCase,
  type EquityHolding,
  type EquityKind,
  type EquityTiming,
  type PlanInputs,
} from '@/lib/engine';
import { formatMoney, formatPct } from '@/lib/format';
import { Badge, Button, InfoTip, NumberInput, Segmented, Select, Switch, TextInput, ToneIcon, cx } from '../ui';
import { Grid, ItemCard, Note, type EditorProps } from './Editors';

const KINDS: { value: EquityKind; label: string }[] = [
  { value: 'private-company', label: 'Private company shares' },
  { value: 'rsu', label: 'RSUs (not yet sold)' },
  { value: 'options', label: 'Stock options' },
  { value: 'carried-interest', label: 'Carried interest' },
  { value: 'business', label: 'Business ownership' },
  { value: 'other', label: 'Other illiquid stake' },
];

const OUTCOME_LABEL: Record<EquityCase, string> = {
  none: 'No payout',
  conservative: 'Conservative',
  base: 'Base',
  optimistic: 'Optimistic',
};
const TIMING_LABEL: Record<EquityTiming, string> = { earliest: 'Early', expected: 'Expected', latest: 'Late' };

/* ------------------------------------------------------------ Assumption */

export function EquityAssumptionPicker({ inputs, onChange }: EditorProps) {
  const a = inputs.equityAssumption;
  const set = (patch: Partial<PlanInputs['equityAssumption']>) =>
    onChange((p) => ({ ...p, equityAssumption: { ...p.equityAssumption, ...patch } }));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-[12.5px] font-medium text-ink-2">Plan assumes</span>
      <Segmented<EquityCase>
        label="Equity outcome used in the plan"
        size="sm"
        value={a.outcome}
        onChange={(outcome) => set({ outcome })}
        options={(['none', ...OUTCOMES] as EquityCase[]).map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))}
      />
      {a.outcome !== 'none' && (
        <Segmented<EquityTiming>
          label="Equity timing used in the plan"
          size="sm"
          value={a.timing}
          onChange={(timing) => set({ timing })}
          options={TIMINGS.map((t) => ({ value: t, label: TIMING_LABEL[t] }))}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Panel */

/** First-class view of illiquid wealth: what it is worth, when, and how much the plan leans on it. */
export function EquityPanel({ inputs, onChange, analysis }: EditorProps & { analysis: EquityAnalysis }) {
  if (!analysis.hasEquity) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="max-w-xl">
          <p className="text-[14px] font-medium text-ink">Do you hold equity that isn’t liquid yet?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            Vested private company shares, unsold RSUs, options, carried interest or a business stake. Add a range of outcomes and a timing window, and see how much your plan depends on it.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => onChange((p) => ({ ...p, equity: [newEquityHolding({ expectedAge: Math.min(p.retirementAge, p.currentAge + 4), earliestAge: p.currentAge + 2, latestAge: p.currentAge + 8 })], equityAssumption: { outcome: 'base', timing: 'expected' } }))}
        >
          + Add company equity
        </Button>
      </div>
    );
  }

  const ret = inputs.retirementAge;
  const a = inputs.equityAssumption;
  const none = analysis.grid[0];
  const be = analysis.breakeven;

  return (
    <div className="px-5 pb-6 pt-4 sm:px-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Fig label="Conservative" value={formatMoney(analysis.net.conservative, { compact: true })} sub="after tax" />
        <Fig label="Base" value={formatMoney(analysis.net.base, { compact: true })} sub="after tax" strong />
        <Fig label="Optimistic" value={formatMoney(analysis.net.optimistic, { compact: true })} sub="after tax" />
        <Fig
          label={<>Probability-weighted <InfoTip term="Probability-weighted value">Each holding’s chance of paying out × (25% conservative + 50% base + 25% optimistic), after tax. A way to size the bet, not an amount to spend.</InfoTip></>}
          value={formatMoney(analysis.expectedValue, { compact: true })}
          sub="after tax"
        />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[13.5px] font-semibold text-ink">Work-optional age by equity outcome</h3>
          <span className="text-[12px] text-ink-3">Tap a cell to plan around it · your target is {ret}</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tnum w-full min-w-[420px] text-[13px]">
            <thead>
              <tr className="bg-surface-2/60 text-[12px] text-ink-3">
                <th scope="col" className="px-3 py-2 text-left font-medium">Outcome</th>
                {TIMINGS.map((t) => (
                  <th key={t} scope="col" className="px-3 py-2 text-center font-medium">
                    {TIMING_LABEL[t]}
                    <span className="block text-[11px] font-normal">
                      {t === 'earliest' ? `age ${Math.min(...inputs.equity.map((h) => h.earliestAge))}` : t === 'latest' ? `age ${Math.max(...inputs.equity.map((h) => h.latestAge))}` : `age ${Math.min(...inputs.equity.map((h) => h.expectedAge))}`}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OUTCOMES.map((o) => (
                <tr key={o} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-ink-2">
                    {OUTCOME_LABEL[o]}
                    <span className="block text-[11.5px] font-normal text-ink-3">{formatMoney(analysis.net[o], { compact: true })} net</span>
                  </th>
                  {TIMINGS.map((t) => {
                    const c = analysis.grid.find((g) => g.outcome === o && g.timing === t)!;
                    const selected = a.outcome === o && a.timing === t;
                    return (
                      <td key={t} className="p-1">
                        <AgeCell
                          age={c.workOptional}
                          target={ret}
                          selected={selected}
                          onClick={() => onChange((p) => ({ ...p, equityAssumption: { outcome: o, timing: t } }))}
                          label={`${OUTCOME_LABEL[o]} outcome, ${TIMING_LABEL[t].toLowerCase()} timing`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-line bg-surface-2/40">
                <th scope="row" className="px-3 py-2 text-left font-medium text-ink-2">
                  Never pays out
                  <span className="block text-[11.5px] font-normal text-ink-3">$0</span>
                </th>
                <td colSpan={3} className="p-1">
                  <AgeCell
                    age={none.workOptional}
                    target={ret}
                    selected={a.outcome === 'none'}
                    onClick={() => onChange((p) => ({ ...p, equityAssumption: { ...p.equityAssumption, outcome: 'none' } }))}
                    label="No payout"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-ink-3">
          Each cell is the earliest age you could stop all paid work and still fund your spending through {inputs.planningHorizonAge}, in a steady-return projection.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Callout tone={be.status === 'not-needed' ? 'positive' : be.status === 'needed' ? (analysis.net.conservative >= be.netAmount ? 'positive' : 'caution') : be.status === 'insufficient' ? 'negative' : 'neutral'}>
          {be.status === 'not-needed' && <>Retiring at {ret}, your plan lasts through {inputs.planningHorizonAge} <strong>even if the equity never pays out</strong>.</>}
          {be.status === 'needed' && (
            <>
              To stop full-time work at {ret}, the plan needs <strong>at least {formatMoney(be.netAmount, { approx: true })} after tax</strong> from equity around age {be.byAge}.{' '}
              {analysis.net.conservative >= be.netAmount ? 'Your conservative case covers it.' : analysis.net.base >= be.netAmount ? 'Your base case covers it; the conservative case does not.' : 'Only the optimistic case covers it.'}
            </>
          )}
          {be.status === 'insufficient' && <>Equity alone cannot fund retiring at {ret} with your planned spending.</>}
        </Callout>
        <Callout tone={analysis.shareOfNetWorth >= 0.35 ? 'caution' : 'neutral'}>
          <span className="mb-1.5 block">
            Base-case equity is <strong>{formatPct(analysis.shareOfNetWorth, 0)}</strong> of your net worth (investable assets + equity + home equity).
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <span className={cx('block h-full rounded-full', analysis.shareOfNetWorth >= 0.35 ? 'bg-caution' : 'bg-[color:var(--gold)]')} style={{ width: `${Math.min(100, analysis.shareOfNetWorth * 100)}%` }} />
          </span>
        </Callout>
      </div>
    </div>
  );
}

function AgeCell({ age, target, selected, onClick, label }: { age: number | null; target: number; selected: boolean; onClick: () => void; label: string }) {
  const tone = age == null ? 'negative' : age <= target ? 'positive' : age <= target + 3 ? 'caution' : 'negative';
  const bg = { positive: 'bg-accent-soft text-accent', caution: 'bg-caution-soft text-caution', negative: 'bg-negative-soft text-negative' }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${label}: work optional ${age == null ? 'not reached' : `at ${age}`}`}
      className={cx(
        'flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[14px] font-semibold transition-shadow',
        bg,
        selected ? 'ring-2 ring-ink ring-offset-1 ring-offset-surface dark:ring-accent' : 'hover:ring-1 hover:ring-line-strong',
      )}
    >
      <ToneIcon tone={tone} className="h-3.5 w-3.5" />
      {age == null ? 'Not reached' : age}
      {selected && <span className="sr-only">(used in plan)</span>}
    </button>
  );
}

function Fig({ label, value, sub, strong }: { label: React.ReactNode; value: string; sub: string; strong?: boolean }) {
  return (
    <div>
      <div className="flex items-center text-[12px] text-ink-3">{label}</div>
      <div className={cx('tnum mt-0.5 text-[20px] font-semibold tracking-[-0.02em]', strong ? 'text-ink' : 'text-ink-2')}>{value}</div>
      <div className="text-[11px] text-ink-3">{sub}</div>
    </div>
  );
}

function Callout({ tone, children }: { tone: 'positive' | 'caution' | 'negative' | 'neutral'; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-line bg-surface-2/40 p-3.5 text-[13px] leading-relaxed text-ink-2">
      <ToneIcon tone={tone} className="mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------------- Editor */

export function EquityEditor({ inputs, onChange }: EditorProps) {
  const update = (id: string, patch: Partial<EquityHolding>) =>
    onChange((p) => ({ ...p, equity: p.equity.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  return (
    <div>
      <Note>
        Enter what each holding could sell for <strong>before tax</strong>, your expected tax on it, and when it might become cash. Equity never counts toward your investable assets until it pays out.
      </Note>
      <div className="space-y-3">
        {inputs.equity.map((h) => (
          <ItemCard key={h.id} title={h.label || 'Equity'} onRemove={() => onChange((p) => ({ ...p, equity: p.equity.filter((x) => x.id !== h.id) }))}>
            <Grid>
              <TextInput label="Name" value={h.label} onChange={(label) => update(h.id, { label })} />
              <Select label="Type" value={h.kind} onChange={(kind) => update(h.id, { kind })} options={KINDS} />
              <NumberInput hideLabel={false} label="Tax on proceeds" value={h.taxRate} format="percent" min={0} max={0.6} onChange={(taxRate) => update(h.id, { taxRate })} />
              <NumberInput hideLabel={false} label="Conservative value (pre-tax)" value={h.conservative} format="money" min={0} max={LIMITS.assets.max} onChange={(conservative) => update(h.id, { conservative })} />
              <NumberInput hideLabel={false} label="Base value (pre-tax)" value={h.base} format="money" min={0} max={LIMITS.assets.max} onChange={(base) => update(h.id, { base })} />
              <NumberInput hideLabel={false} label="Optimistic value (pre-tax)" value={h.optimistic} format="money" min={0} max={LIMITS.assets.max} onChange={(optimistic) => update(h.id, { optimistic })} />
              <NumberInput hideLabel={false} label="Earliest payout age" value={h.earliestAge} integer min={inputs.currentAge} max={inputs.planningHorizonAge} onChange={(earliestAge) => update(h.id, { earliestAge, expectedAge: Math.max(h.expectedAge, earliestAge), latestAge: Math.max(h.latestAge, earliestAge) })} />
              <NumberInput hideLabel={false} label="Expected payout age" value={h.expectedAge} integer min={inputs.currentAge} max={inputs.planningHorizonAge} onChange={(expectedAge) => update(h.id, { expectedAge, earliestAge: Math.min(h.earliestAge, expectedAge), latestAge: Math.max(h.latestAge, expectedAge) })} />
              <NumberInput hideLabel={false} label="Latest payout age" value={h.latestAge} integer min={inputs.currentAge} max={inputs.planningHorizonAge} onChange={(latestAge) => update(h.id, { latestAge, earliestAge: Math.min(h.earliestAge, latestAge), expectedAge: Math.min(h.expectedAge, latestAge) })} />
              <div>
                <NumberInput hideLabel={false} label="Chance it pays out at all" value={h.probability} format="percent" min={0} max={1} onChange={(probability) => update(h.id, { probability })} />
                <p className="mt-1 text-[11.5px] text-ink-3">Used in Monte Carlo and the probability-weighted value.</p>
              </div>
              <div>
                <NumberInput hideLabel={false} label="Paid over (years)" value={h.payoutYears} integer min={1} max={10} onChange={(payoutYears) => update(h.id, { payoutYears })} />
                <p className="mt-1 text-[11.5px] text-ink-3">1 = lump sum. More for staged buyouts or tender offers.</p>
              </div>
              <div className="flex items-end">
                <p className="tnum text-[12.5px] text-ink-2">
                  Base after tax: <strong className="text-ink">{formatMoney(netProceeds(h, 'base'))}</strong>
                </p>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Switch
                  checked={h.inflationAdjusted}
                  onChange={(inflationAdjusted) => update(h.id, { inflationAdjusted })}
                  label="Values are in today’s dollars"
                  description={h.inflationAdjusted ? 'They will be inflated to the payout year.' : 'Fixed future-dollar amounts (typical for a valuation or deal estimate).'}
                />
              </div>
            </Grid>
          </ItemCard>
        ))}
      </div>
      <Button
        size="sm"
        className="mt-3"
        onClick={() => onChange((p) => ({ ...p, equity: [...p.equity, newEquityHolding({ label: p.equity.length ? 'Another holding' : 'Company equity', expectedAge: Math.min(p.retirementAge, p.currentAge + 4), earliestAge: p.currentAge + 2, latestAge: p.currentAge + 8 })] }))}
      >
        + Add holding
      </Button>
      {inputs.equity.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <EquityAssumptionPicker inputs={inputs} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

export function EquityBadge({ inputs }: { inputs: PlanInputs }) {
  if (!inputs.equity.length) return null;
  const a = inputs.equityAssumption;
  return <Badge tone="gold">{a.outcome === 'none' ? 'No payout' : `${OUTCOME_LABEL[a.outcome]} · ${TIMING_LABEL[a.timing].toLowerCase()}`}</Badge>;
}
