'use client';

import { newEvent, newIncomeStream, newProperty, type PlanInputs } from '@/lib/engine';
import { formatMoney } from '@/lib/format';
import { Card, CardHeader } from '../ui';
import type { EditorProps } from './Editors';

type Section = 'income' | 'events' | 'home';

/**
 * Income that starts later and big one-time money moves change when work can
 * stop, so they sit on the main page with one-tap starting points instead of
 * behind Advanced mode.
 */
export function LifeEventsCard({ inputs, onChange, onOpen }: EditorProps & { onOpen: (s: Section) => void }) {
  const add = (section: Section, fn: (p: PlanInputs) => PlanInputs) => {
    onChange(fn);
    onOpen(section);
  };
  const soon = Math.min(inputs.currentAge + 5, inputs.planningHorizonAge);

  const quick: { label: string; section: Section; fn: (p: PlanInputs) => PlanInputs }[] = [
    {
      label: 'Social Security',
      section: 'income',
      fn: (p) => ({ ...p, incomeStreams: [...p.incomeStreams, newIncomeStream({ label: 'Social Security', startAge: 67, annualAmount: 40_000 })] }),
    },
    {
      label: 'Pension',
      section: 'income',
      fn: (p) => ({ ...p, incomeStreams: [...p.incomeStreams, newIncomeStream({ label: 'Pension', startAge: 65, annualAmount: 30_000, inflationAdjusted: false })] }),
    },
    {
      label: 'College',
      section: 'events',
      fn: (p) => ({ ...p, events: [...p.events, newEvent({ label: 'College', category: 'college', age: soon, amount: -150_000 })] }),
    },
    {
      label: 'Home sale',
      section: 'home',
      fn: (p) =>
        p.properties.length
          ? { ...p, properties: p.properties.map((h, i) => (i === 0 ? { ...h, sale: { ...h.sale, enabled: true } } : h)) }
          : { ...p, properties: [newProperty({ sale: { enabled: true, age: Math.max(p.retirementAge, 60), sellingCostRate: 0.06, netProceedsOverride: null } })] },
    },
    {
      label: 'Home purchase',
      section: 'events',
      fn: (p) => ({ ...p, events: [...p.events, newEvent({ label: 'Home purchase', category: 'home-purchase', age: soon, amount: -500_000 })] }),
    },
    {
      label: 'Inheritance',
      section: 'events',
      fn: (p) => ({ ...p, events: [...p.events, newEvent({ label: 'Inheritance', category: 'inheritance', age: Math.min(inputs.currentAge + 15, inputs.planningHorizonAge), amount: 500_000, inflationAdjusted: false })] }),
    },
  ];

  const included: { text: string; section: Section }[] = [
    ...inputs.incomeStreams.map((s) => ({ text: `${s.label} · ${formatMoney(s.annualAmount, { compact: true })}/yr from ${s.startAge}`, section: 'income' as const })),
    ...inputs.events.map((e) => ({ text: `${e.label} · ${e.amount >= 0 ? '+' : '−'}${formatMoney(Math.abs(e.amount), { compact: true })} at ${e.age}`, section: 'events' as const })),
    ...inputs.properties.map((h) => ({ text: `${h.label}${h.sale.enabled ? ` · sold at ${h.sale.age}` : ' · not sold'}`, section: 'home' as const })),
  ];

  return (
    <Card className="mt-5">
      <CardHeader
        title="Income and big moments"
        subtitle="Social Security, pensions, college, a home sale or purchase, an inheritance. Each one shifts when work can become optional."
      />
      <div className="space-y-4 px-5 pb-5 pt-4 sm:px-6">
        {included.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Included in your plan">
            {included.map((i, k) => (
              <li key={k}>
                <button
                  onClick={() => onOpen(i.section)}
                  className="tnum rounded-full border border-line bg-surface-2/60 px-3 py-1 text-[12.5px] text-ink hover:border-line-strong"
                >
                  {i.text}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-3">Nothing added yet, so your plan assumes no Social Security, no college costs and no home sale.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-medium text-ink-2">Add:</span>
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => add(q.section, q.fn)}
              className="rounded-full border border-dashed border-line-strong px-3 py-1 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent"
            >
              + {q.label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-ink-3">Each starts with a typical amount and opens below so you can set your own numbers.</p>
      </div>
    </Card>
  );
}
