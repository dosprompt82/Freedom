'use client';

import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import {
  balanceSeries,
  displayYear,
  workPhaseWindows,
  type DollarMode,
  type PlanAnalysis,
  type Projection,
} from '@/lib/engine';
import { formatMoney } from '@/lib/format';
import { useReducedMotion } from '@/lib/hooks';

export interface Overlay {
  id: string;
  name: string;
  color: string;
  projection: Projection;
  dashed?: boolean;
}

interface Props {
  analysis: PlanAnalysis;
  mode: DollarMode;
  height?: number;
  overlays?: Overlay[];
  compact?: boolean;
  showTarget?: boolean;
  animate?: boolean;
}

type Row = {
  age: number;
  year: number;
  acc: number | null;
  ret: number | null;
  value: number;
  target: number;
  [k: string]: number | null;
};

/** Round up to a 1/2/2.5/5 × 10^k step so axis ticks land on clean values. */
function niceCeil(v: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * mag >= v / 4)! * mag;
  return Math.ceil(v / step) * step;
}

const axisMoney = (v: number) => formatMoney(v, { compact: true });

export function FreedomChart({ analysis, mode, height = 380, overlays = [], compact, showTarget = true, animate = true }: Props) {
  const reduced = useReducedMotion();
  const { projection, metrics, inputs } = analysis;
  const retAge = inputs.retirementAge;

  const data = useMemo<Row[]>(() => {
    const series = balanceSeries(projection, mode);
    const overlaySeries = overlays.map((o) => ({ id: o.id, pts: new Map(balanceSeries(o.projection, mode).map((p) => [p.age, p.value])) }));
    return series.map((p) => {
      const row: Row = {
        age: p.age,
        year: p.year,
        value: p.value,
        acc: p.age <= retAge ? p.value : null,
        ret: p.age >= retAge ? p.value : null,
        target:
          mode === 'real'
            ? projection.freedomTargetReal
            : projection.freedomTargetReal * Math.pow(1 + inputs.inflation, p.age - inputs.currentAge),
      };
      for (const o of overlaySeries) row[`o_${o.id}`] = o.pts.get(p.age) ?? null;
      return row;
    });
  }, [projection, mode, overlays, retAge, inputs.inflation, inputs.currentAge]);

  const phases = workPhaseWindows(inputs);
  const eventDots = projection.years
    .filter((y) => y.events.some((e) => e.kind !== 'downturn'))
    .map((y) => ({ age: y.age, value: mode === 'real' ? y.beginBalance / y.priceStart : y.beginBalance, labels: y.events.map((e) => e.label) }));
  const downturns = projection.years.filter((y) => y.events.some((e) => e.kind === 'downturn'));

  const maxY = Math.max(
    ...data.map((d) => Math.max(d.value, showTarget && d.age <= retAge + 5 ? d.target : 0, ...overlays.map((o) => (d[`o_${o.id}`] as number) ?? 0))),
    1,
  );
  const lastAge = data[data.length - 1]?.age ?? inputs.planningHorizonAge;
  const ticks: number[] = [];
  const firstTick = Math.ceil(inputs.currentAge / 5) * 5;
  for (let a = firstTick; a <= lastAge; a += 5) ticks.push(a);

  const summary = `Projected portfolio from age ${inputs.currentAge} to ${lastAge} in ${mode === 'real' ? "today's" : 'future'} dollars. ${formatMoney(metrics.portfolioAtRetirement[mode], { compact: true })} at retirement age ${retAge}; ${metrics.depletionAge ? `runs short at ${metrics.depletionAge}` : `${formatMoney(metrics.portfolioAtHorizon[mode], { compact: true })} at the end of the plan`}.`;

  const anim = animate && !reduced;
  return (
    <div role="img" aria-label={summary} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: compact ? 8 : 28, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fa-acc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fa-ret" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="age"
            type="number"
            domain={[inputs.currentAge, lastAge]}
            ticks={ticks}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={axisMoney}
            width={64}
            tickLine={false}
            axisLine={false}
            domain={[0, niceCeil(maxY * 1.05)]}
            tickCount={5}
          />

          {!compact &&
            phases.map((w) => (
              <ReferenceArea
                key={w.phase.id}
                x1={w.start}
                x2={Math.min(w.end, lastAge)}
                fill="var(--chart-3)"
                fillOpacity={0.07}
                stroke="none"
                label={{ value: w.phase.label, position: 'insideBottom', fill: 'var(--ink-3)', fontSize: 11, offset: 10 }}
              />
            ))}

          {showTarget && (
            <Line
              dataKey="target"
              stroke="var(--gold)"
              strokeDasharray="4 4"
              strokeWidth={1.25}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              name="Freedom Target"
            />
          )}

          <Area
            type="monotone"
            dataKey="acc"
            stroke="var(--chart-1)"
            strokeWidth={2.25}
            fill="url(#fa-acc)"
            connectNulls={false}
            isAnimationActive={anim}
            animationDuration={500}
            name="Accumulation"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
          />
          <Area
            type="monotone"
            dataKey="ret"
            stroke="var(--chart-2)"
            strokeWidth={2.25}
            fill="url(#fa-ret)"
            connectNulls={false}
            isAnimationActive={anim}
            animationDuration={500}
            name="Withdrawal phase"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
          />

          {overlays.map((o) => (
            <Line
              key={o.id}
              dataKey={`o_${o.id}`}
              stroke={o.color}
              strokeWidth={2}
              strokeDasharray={o.dashed ? '6 4' : undefined}
              dot={false}
              isAnimationActive={anim}
              animationDuration={500}
              name={o.name}
            />
          ))}

          <ReferenceLine
            x={inputs.currentAge}
            stroke="var(--ink-3)"
            strokeOpacity={0.5}
          />
          {retAge <= lastAge && (
            <ReferenceLine
              x={retAge}
              stroke="var(--ink-2)"
              strokeDasharray="2 3"
              label={compact ? undefined : { value: `Work ends · ${retAge}`, position: 'top', fill: 'var(--ink-2)', fontSize: 11 }}
            />
          )}
          {metrics.depletionAge != null && (
            <ReferenceLine
              x={metrics.depletionAge}
              stroke="var(--negative)"
              strokeDasharray="3 3"
              label={compact ? undefined : { value: `Runs short · ${metrics.depletionAge}`, position: 'insideTopRight', fill: 'var(--negative)', fontSize: 11 }}
            />
          )}
          {!compact &&
            downturns.map((y) => (
              <ReferenceLine key={`dt-${y.age}`} x={y.age} stroke="var(--caution)" strokeOpacity={0.6} strokeDasharray="1 3" />
            ))}
          {!compact &&
            eventDots.map((d) => (
              <ReferenceDot
                key={`ev-${d.age}`}
                x={d.age}
                y={d.value}
                r={4.5}
                fill="var(--surface)"
                stroke="var(--gold)"
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            ))}

          <Tooltip
            content={<ChartTooltip projection={projection} mode={mode} overlays={overlays} />}
            cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  label,
  payload,
  projection,
  mode,
  overlays,
}: TooltipProps<number, string> & { projection: Projection; mode: DollarMode; overlays: Overlay[] }) {
  if (!active || label == null) return null;
  const age = Number(label);
  const row = projection.years.find((y) => y.age === age);
  const last = projection.years[projection.years.length - 1];
  const f = (n: number) => formatMoney(n);
  const unit = mode === 'real' ? "Today's dollars" : 'Future dollars';

  const overlayVals = overlays
    .map((o) => ({ o, v: payload?.find((p) => p.dataKey === `o_${o.id}`)?.value }))
    .filter((x) => x.v != null);

  if (!row) {
    if (!last) return null;
    const end = mode === 'real' ? last.endBalance / last.priceEnd : last.endBalance;
    return (
      <TooltipShell title={`End of plan · age ${age}`} sub={`${last.year + 1} · ${unit}`}>
        <TRow label="Ending portfolio" value={f(end)} strong />
        {overlayVals.map(({ o, v }) => (
          <TRow key={o.id} label={o.name} value={f(v as number)} swatch={o.color} />
        ))}
      </TooltipShell>
    );
  }
  const d = displayYear(row, mode);
  const phaseLabel = row.phase === 'accumulation' ? 'Working full-time' : row.phase === 'transition' ? 'Transition work' : 'Retired';
  return (
    <TooltipShell title={`Age ${age}`} sub={`${row.year} · ${phaseLabel} · ${unit}`}>
      <TRow label="Beginning portfolio" value={f(d.begin)} />
      {d.contributions > 0 && <TRow label={row.phase === 'accumulation' ? 'Contributions' : 'Income surplus invested'} value={`+${f(d.contributions)}`} />}
      <TRow label={mode === 'real' ? 'Investment returns (after inflation)' : 'Investment returns'} value={`${d.returns >= 0 ? '+' : ''}${f(d.returns)}`} />
      {d.withdrawal > 0 && <TRow label="Withdrawals" value={`−${f(d.withdrawal)}`} />}
      {d.income > 0 && <TRow label="Income (not from portfolio)" value={f(d.income)} muted />}
      {d.events.map((e, idx) => (
        <TRow key={idx} label={e.label} value={e.kind === 'downturn' ? `${Math.round(row.returnRate * 100)}% return` : `${e.amount >= 0 ? '+' : '−'}${f(Math.abs(e.amount))}`} accent />
      ))}
      {d.unfunded > 0 && <TRow label="Unfunded spending" value={f(d.unfunded)} negative />}
      <div className="my-1.5 border-t border-line" />
      <TRow label="Ending portfolio" value={f(d.end)} strong />
      {overlayVals.length > 0 && <div className="my-1.5 border-t border-line" />}
      {overlayVals.map(({ o, v }) => (
        <TRow key={o.id} label={`${o.name} (start of year)`} value={f(v as number)} swatch={o.color} />
      ))}
    </TooltipShell>
  );
}

function TooltipShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[260px] rounded-xl border border-line bg-surface/95 p-3 shadow-float backdrop-blur">
      <div className="text-[13px] font-semibold text-ink">{title}</div>
      <div className="mb-2 text-[11.5px] text-ink-3">{sub}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function TRow({
  label,
  value,
  strong,
  muted,
  accent,
  negative,
  swatch,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  accent?: boolean;
  negative?: boolean;
  swatch?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 text-[12.5px]">
      <span className={`flex items-center gap-1.5 ${muted ? 'text-ink-3' : accent ? 'text-[color:var(--gold)]' : negative ? 'text-negative' : 'text-ink-2'}`}>
        {swatch && <span className="inline-block h-0.5 w-3 rounded" style={{ background: swatch }} />}
        {label}
      </span>
      <span className={`tnum ${strong ? 'font-semibold text-ink' : negative ? 'text-negative' : 'text-ink'}`}>{value}</span>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean; dot?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.dot ? (
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: i.color }} />
          ) : (
            <span
              className="inline-block h-0 w-4"
              style={{ borderTop: `2px ${i.dashed ? 'dashed' : 'solid'} ${i.color}` }}
            />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}
