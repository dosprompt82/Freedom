'use client';

import { useState } from 'react';
import { displayYear, type DollarMode, type Insight, type Milestone, type Projection } from '@/lib/engine';
import { formatMoney, formatPct } from '@/lib/format';
import { Button, ToneIcon, cx } from '../ui';

export function InsightList({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = limit && !expanded ? insights.slice(0, limit) : insights;
  return (
    <div>
      <ul className="divide-y divide-line">
        {shown.map((i, idx) => (
          <li key={i.id} className="fa-rise flex gap-3 py-3.5 first:pt-0" style={{ animationDelay: `${idx * 30}ms` }}>
            <ToneIcon tone={i.tone} className="mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-ink">{i.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{i.body}</p>
            </div>
          </li>
        ))}
      </ul>
      {limit && insights.length > limit && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)} className="mt-1 -ml-3">
          {expanded ? 'Show fewer' : `Show ${insights.length - limit} more`}
        </Button>
      )}
    </div>
  );
}

const toneDot: Record<Milestone['tone'], string> = {
  positive: 'bg-accent',
  neutral: 'bg-ink-3',
  caution: 'bg-caution',
  negative: 'bg-negative',
};

export function MilestoneList({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="relative ml-1.5 border-l border-line">
      {milestones.map((m) => (
        <li key={m.id} className="relative pb-5 pl-6 last:pb-0">
          <span
            className={cx('absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface', toneDot[m.tone])}
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="tnum text-[13px] font-semibold text-ink">
              {m.age == null ? 'Not established' : `Age ${m.age}`}
            </span>
            {m.year != null && <span className="tnum text-[12px] text-ink-3">{m.year}</span>}
            <span className="sr-only">({m.tone})</span>
          </div>
          <p className="text-[13.5px] font-medium text-ink-2">{m.label}</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{m.detail}</p>
        </li>
      ))}
    </ol>
  );
}

/** Full year-by-year cash-flow table — the accessible equivalent of the chart. */
export function YearTable({ projection, mode }: { projection: Projection; mode: DollarMode }) {
  const f = (n: number) => (Math.abs(n) < 0.5 ? '—' : formatMoney(n, { compact: true }));
  return (
    <div className="overflow-x-auto">
      <table className="tnum w-full min-w-[860px] text-right text-[12.5px]">
        <caption className="sr-only">
          Year-by-year projection in {mode === 'real' ? "today's" : 'future'} dollars
        </caption>
        <thead>
          <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-ink-3">
            <th scope="col" className="py-2 pr-3 text-left font-medium">Age</th>
            <th scope="col" className="py-2 pr-3 text-left font-medium">Year</th>
            <th scope="col" className="py-2 pr-3 font-medium">Beginning</th>
            <th scope="col" className="py-2 pr-3 font-medium">Contributions</th>
            <th scope="col" className="py-2 pr-3 font-medium">Returns</th>
            <th scope="col" className="py-2 pr-3 font-medium">Income</th>
            <th scope="col" className="py-2 pr-3 font-medium">Spending</th>
            <th scope="col" className="py-2 pr-3 font-medium">Withdrawals</th>
            <th scope="col" className="py-2 pr-3 font-medium">Events</th>
            <th scope="col" className="py-2 pr-3 font-medium">Ending</th>
            <th scope="col" className="py-2 font-medium">Return</th>
          </tr>
        </thead>
        <tbody>
          {projection.years.map((y) => {
            const d = displayYear(y, mode);
            const ev = d.events.filter((e) => e.kind !== 'downturn' && e.kind !== 'equity-forfeited').reduce((s, e) => s + e.amount, 0);
            return (
              <tr
                key={y.age}
                className={cx(
                  'border-b border-line/60',
                  y.phase === 'transition' && 'bg-surface-2/50',
                  y.unfunded > 0.5 && 'text-negative',
                )}
              >
                <th scope="row" className="py-1.5 pr-3 text-left font-medium text-ink">{y.age}</th>
                <td className="py-1.5 pr-3 text-left text-ink-3">{y.year}</td>
                <td className="py-1.5 pr-3">{f(d.begin)}</td>
                <td className="py-1.5 pr-3">{f(d.contributions)}</td>
                <td className="py-1.5 pr-3">{f(d.returns)}</td>
                <td className="py-1.5 pr-3">{f(d.income)}</td>
                <td className="py-1.5 pr-3">{f(d.spending + d.housing)}</td>
                <td className="py-1.5 pr-3">{f(d.withdrawal)}</td>
                <td className="py-1.5 pr-3" title={d.events.map((e) => e.label).join(', ')}>{f(ev)}</td>
                <td className="py-1.5 pr-3 font-medium text-ink">{f(d.end)}</td>
                <td className={cx('py-1.5', y.returnRate < 0 ? 'text-caution' : 'text-ink-3')}>{formatPct(y.returnRate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
