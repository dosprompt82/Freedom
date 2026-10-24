'use client';

import { useState, useTransition } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { runMonteCarlo, type MonteCarloResult, type PlanInputs } from '@/lib/engine';
import { formatMoney, formatPct } from '@/lib/format';
import { GLOSSARY } from '@/lib/glossary';
import { Badge, Button, InfoTip, NumberInput } from '../ui';

export function MonteCarloPanel({ inputs }: { inputs: PlanInputs }) {
  const [vol, setVol] = useState(0.14);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [ranFor, setRanFor] = useState<string>('');
  const [pending, start] = useTransition();
  const key = JSON.stringify(inputs) + vol;
  const stale = result && ranFor !== key;

  const run = () =>
    start(() => {
      setResult(runMonteCarlo(inputs, { paths: 2000, volatility: vol, seed: 50 }));
      setRanFor(key);
    });

  const data = result?.bands.map((b) => ({ age: b.age, band: [b.p10, b.p90], mid: [b.p25, b.p75], p50: b.p50 }));
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <NumberInput hideLabel={false} label="Annual volatility" value={vol} onChange={setVol} format="percent" min={0} max={0.4} className="w-40" />
        <Button variant="primary" size="md" onClick={run} disabled={pending}>
          {pending ? 'Simulating…' : result ? 'Re-run 2,000 paths' : 'Run 2,000 paths'}
        </Button>
        {stale && <Badge tone="caution">Assumptions changed — re-run</Badge>}
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
        {GLOSSARY.monteCarlo} Each path draws independent annual returns (lognormal, mean {formatPct(inputs.nominalReturn)} nominal, volatility {formatPct(vol)}) with inflation held at {formatPct(inputs.inflation)}. It ignores fat tails, momentum, and links between inflation and returns. Seeded, so results are reproducible. The median path usually ends below the steady projection, because uneven returns compound at less than their average.
      </p>
      {result && data && (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <div className="text-[12px] text-ink-3">
                Paths funding spending through {inputs.planningHorizonAge}
                <InfoTip term="Success rate">Share of the 2,000 simulated paths in which the portfolio never ran short of planned spending. It describes these assumptions, not a real-world probability.</InfoTip>
              </div>
              <div className="tnum text-[28px] font-semibold tracking-[-0.03em] text-ink">{formatPct(result.successRate, 0)}</div>
            </div>
            {result.medianDepletionAge && (
              <div className="text-[13px] text-ink-2">Median path runs short at {result.medianDepletionAge}</div>
            )}
          </div>
          <div style={{ height: 260 }} role="img" aria-label={`Monte Carlo percentile bands. ${formatPct(result.successRate, 0)} of paths fund spending through the horizon.`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="age" tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                <YAxis tickFormatter={(v) => formatMoney(v, { compact: true })} width={64} tickLine={false} axisLine={false} />
                <Area dataKey="band" stroke="none" fill="var(--chart-1)" fillOpacity={0.12} name="10th–90th percentile" isAnimationActive={false} />
                <Area dataKey="mid" stroke="none" fill="var(--chart-1)" fillOpacity={0.22} name="25th–75th percentile" isAnimationActive={false} />
                <Line dataKey="p50" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Median" isAnimationActive={false} />
                <Tooltip
                  formatter={(v: number | number[]) => (Array.isArray(v) ? `${formatMoney(v[0], { compact: true })} – ${formatMoney(v[1], { compact: true })}` : formatMoney(v, { compact: true }))}
                  labelFormatter={(l) => `Age ${l} · today's dollars`}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12.5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
