'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { balanceSeries, displayYear, type DollarMode, type Projection } from '@/lib/engine';
import { formatMoney, formatPct } from '@/lib/format';
import { useReducedMotion } from '@/lib/hooks';

const axisMoney = (v: number) => formatMoney(v, { compact: true });

function ticksFor(from: number, to: number) {
  const out: number[] = [];
  for (let a = Math.ceil(from / 5) * 5; a <= to; a += 5) out.push(a);
  return out;
}

function SimpleTooltip({ active, label, payload, unit }: TooltipProps<number, string> & { unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[220px] rounded-xl border border-line bg-surface/95 p-3 shadow-float backdrop-blur">
      <div className="text-[13px] font-semibold text-ink">Age {label}</div>
      <div className="mb-2 text-[11.5px] text-ink-3">{unit}</div>
      <div className="space-y-1">
        {payload
          .filter((p) => p.value != null)
          .map((p) => (
            <div key={String(p.dataKey)} className="flex items-center justify-between gap-6 text-[12.5px]">
              <span className="flex items-center gap-1.5 text-ink-2">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
                {p.name}
              </span>
              <span className="tnum text-ink">
                {String(p.dataKey) === 'rate' ? formatPct(p.value as number) : formatMoney(p.value as number)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

/** After full-time work: where each year's spending money comes from, against the spending need. */
export function IncomeSpendingChart({ projection, mode, height = 280 }: { projection: Projection; mode: DollarMode; height?: number }) {
  const reduced = useReducedMotion();
  const rows = projection.years
    .filter((y) => y.phase !== 'accumulation')
    .map((y) => {
      const d = displayYear(y, mode);
      return {
        age: y.age,
        portfolio: Math.max(0, d.withdrawal - d.withdrawalTax),
        work: d.workIncome,
        other: d.otherIncome,
        need: d.spending + d.housing,
      };
    });
  if (!rows.length) return <EmptyChart height={height} text="No retirement years fall inside the planning horizon." />;
  const unit = mode === 'real' ? "Today's dollars" : 'Future dollars';
  return (
    <div role="img" aria-label="Annual spending need compared with income sources after full-time work ends." style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="age" tickLine={false} axisLine={{ stroke: 'var(--border)' }} ticks={ticksFor(rows[0].age, rows[rows.length - 1].age)} type="number" domain={['dataMin - 0.5', 'dataMax + 0.5']} />
          <YAxis tickFormatter={axisMoney} width={60} tickLine={false} axisLine={false} />
          <Bar dataKey="work" stackId="s" fill="var(--chart-3)" name="Work income" isAnimationActive={!reduced} />
          <Bar dataKey="other" stackId="s" fill="var(--chart-1)" name="Other income" isAnimationActive={!reduced} />
          <Bar dataKey="portfolio" stackId="s" fill="var(--chart-2)" name="From portfolio (after tax)" radius={[2, 2, 0, 0]} isAnimationActive={!reduced} />
          <Line dataKey="need" stroke="var(--ink)" strokeWidth={1.5} dot={false} name="Spending need" type="stepAfter" isAnimationActive={false} />
          <Tooltip content={<SimpleTooltip unit={unit} />} cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gross withdrawals and the withdrawal rate they imply. */
export function WithdrawalChart({ projection, mode, height = 260 }: { projection: Projection; mode: DollarMode; height?: number }) {
  const reduced = useReducedMotion();
  const rows = projection.years
    .filter((y) => y.phase !== 'accumulation')
    .map((y) => {
      const d = displayYear(y, mode);
      return { age: y.age, withdrawal: d.withdrawal, rate: y.beginBalance > 0 ? y.withdrawal / y.beginBalance : null };
    });
  if (!rows.length) return <EmptyChart height={height} text="No withdrawal years fall inside the planning horizon." />;
  const maxRate = Math.max(0.06, ...rows.map((r) => (r.rate != null && r.rate < 1 ? r.rate : 0)));
  const unit = mode === 'real' ? "Today's dollars" : 'Future dollars';
  return (
    <div role="img" aria-label="Annual portfolio withdrawals and withdrawal rate after full-time work ends." style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="age" tickLine={false} axisLine={{ stroke: 'var(--border)' }} ticks={ticksFor(rows[0].age, rows[rows.length - 1].age)} type="number" domain={['dataMin - 0.5', 'dataMax + 0.5']} />
          <YAxis yAxisId="m" tickFormatter={axisMoney} width={60} tickLine={false} axisLine={false} />
          <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => formatPct(v, 0)} width={40} tickLine={false} axisLine={false} domain={[0, Math.min(1, Math.ceil(maxRate * 100) / 100)]} />
          <Bar yAxisId="m" dataKey="withdrawal" fill="var(--chart-2)" name="Withdrawal" radius={[2, 2, 0, 0]} isAnimationActive={!reduced} />
          <Line yAxisId="r" dataKey="rate" stroke="var(--chart-3)" strokeWidth={1.75} dot={false} name="Withdrawal rate" isAnimationActive={false} connectNulls={false} />
          <Tooltip content={<SimpleTooltip unit={unit} />} cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Overlaid balance lines for scenario comparison. */
export function CompareChart({
  series,
  mode,
  height = 340,
}: {
  series: { id: string; name: string; color: string; projection: Projection; dashed?: boolean }[];
  mode: DollarMode;
  height?: number;
}) {
  const reduced = useReducedMotion();
  const byAge = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const p of balanceSeries(s.projection, mode)) {
      const row = byAge.get(p.age) ?? { age: p.age };
      row[s.id] = p.value;
      byAge.set(p.age, row);
    }
  }
  const data = [...byAge.values()].sort((a, b) => a.age - b.age);
  if (!data.length) return <EmptyChart height={height} text="Nothing to compare yet." />;
  const unit = mode === 'real' ? "Today's dollars" : 'Future dollars';
  return (
    <div role="img" aria-label={`Projected portfolio for ${series.map((s) => s.name).join(', ')}.`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="age" type="number" domain={['dataMin', 'dataMax']} ticks={ticksFor(data[0].age, data[data.length - 1].age)} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
          <YAxis tickFormatter={axisMoney} width={64} tickLine={false} axisLine={false} />
          {series.map((s) => (
            <Line
              key={s.id}
              dataKey={s.id}
              name={s.name}
              stroke={s.color}
              strokeWidth={2.25}
              strokeDasharray={s.dashed ? '6 4' : undefined}
              dot={false}
              isAnimationActive={!reduced}
              animationDuration={450}
            />
          ))}
          <Tooltip content={<SimpleTooltip unit={unit} />} cursor={{ stroke: 'var(--border-strong)' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EmptyChart({ height, text }: { height: number; text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-line text-[13px] text-ink-3" style={{ height }}>
      {text}
    </div>
  );
}
