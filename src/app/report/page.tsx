'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ChartLegend, FreedomChart } from '@/components/charts/FreedomChart';
import { LogoMark } from '@/components/Logo';
import { MethodologyContent } from '@/components/MethodologyContent';
import { AssumptionsTable } from '@/components/plan/Assumptions';
import { Disclaimer } from '@/components/plan/common';
import { Button, ButtonLink, ToneIcon } from '@/components/ui';
import { analyzePlan, analyzeWithInsights, balanceAtAge, comparisonInsights, investableAssets, type Insight } from '@/lib/engine';
import { formatMoney, formatPct } from '@/lib/format';
import { useHydrated } from '@/lib/hooks';
import { BASE_ID, useActivePlan } from '@/lib/store';

export default function ReportPage() {
  const hydrated = useHydrated();
  const plan = useActivePlan();

  if (!hydrated) return <div className="p-10 text-[13px] text-ink-3">Preparing report…</div>;
  if (!plan)
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="text-ink-2">No plan to report on yet.</p>
        <ButtonLink href="/start" variant="primary" className="mt-6">
          Build My Freedom Plan
        </ButtonLink>
      </div>
    );
  return <Report />;
}

function Report() {
  const plan = useActivePlan()!;
  const a = useMemo(() => analyzeWithInsights(plan.inputs), [plan.inputs]);
  const { inputs, metrics: m } = a;

  const compared = useMemo(() => {
    const entries = [
      { id: BASE_ID, name: 'Current plan', inputs: plan.inputs },
      ...plan.scenarios.map((s) => ({ id: s.id, name: s.name, inputs: s.inputs })),
    ];
    const ids = plan.compare.length > 1 ? plan.compare : [BASE_ID, ...plan.scenarios.slice(0, 2).map((s) => s.id)];
    return ids
      .map((id) => entries.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ ...e, analysis: analyzePlan(e.inputs) }));
  }, [plan]);

  const tradeoffs: Insight[] = useMemo(() => {
    if (compared.length < 2) return [];
    const row = (c: (typeof compared)[number]) => ({ id: c.id, name: c.name, metrics: c.analysis.metrics, workOptional: c.analysis.workOptional });
    return compared.slice(1).flatMap((c) => comparisonInsights(row(compared[0]), row(c)));
  }, [compared]);

  const risks = a.insights.filter((i) => i.tone === 'caution' || i.tone === 'negative');
  const endAge = inputs.planningHorizonAge + 1;
  const checkpoints = new Set<number>([inputs.currentAge, endAge]);
  for (let age = Math.ceil((inputs.currentAge + 1) / 5) * 5; age < endAge; age += 5) checkpoints.add(age);
  if (inputs.retirementAge <= inputs.planningHorizonAge) checkpoints.add(inputs.retirementAge);
  const checkpointAges = [...checkpoints].sort((x, y) => x - y);

  const date = new Date().toLocaleDateString(undefined, { dateStyle: 'long' });

  return (
    <div className="bg-bg">
      <div className="no-print sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[800px] items-center justify-between px-5 py-3">
          <Link href="/app/plan" className="text-[13px] text-ink-2 hover:text-ink">
            ← Back to My Plan
          </Link>
          <Button variant="primary" size="sm" onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        </div>
      </div>

      <article className="mx-auto max-w-[760px] px-5 py-10 print:max-w-none print:px-0 print:py-0">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <div className="flex items-center gap-2 text-[12px] text-ink-3">
              <LogoMark className="h-5 w-5" /> Freedom at 50 · Plan report
            </div>
            <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-ink">{plan.name}</h1>
            <p className="mt-1 text-[13px] text-ink-3">Prepared {date} · figures in today’s dollars unless noted</p>
          </div>
        </header>

        <Section title="Executive summary">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fig label="Work-optional age" value={a.workOptional == null ? 'Not reached' : String(a.workOptional)} />
            <Fig label="Planned retirement" value={`Age ${inputs.retirementAge}`} />
            <Fig label={`Portfolio at ${inputs.retirementAge}`} value={formatMoney(m.portfolioAtRetirement.real, { compact: true })} />
            <Fig label="Portfolio lasts" value={m.depletionAge == null ? `Through ${inputs.planningHorizonAge}` : `To ${m.depletionAge}`} />
          </div>
          <ul className="mt-5 space-y-2">
            {a.insights.slice(0, 4).map((i) => (
              <li key={i.id} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
                <ToneIcon tone={i.tone} className="mt-0.5" />
                <span>{i.body}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Key assumptions">
          <AssumptionsTable inputs={inputs} />
        </Section>

        <Section title="Retirement timeline" breakBefore>
          <ol className="space-y-2">
            {a.milestones.map((ms) => (
              <li key={ms.id} className="print-avoid grid grid-cols-[88px_1fr] gap-3 text-[13px]">
                <span className="tnum font-semibold text-ink">{ms.age == null ? 'n/a' : `Age ${ms.age}`}</span>
                <span>
                  <span className="font-medium text-ink">{ms.label}</span>
                  <span className="block text-[12px] text-ink-3">{ms.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Portfolio projection" breakBefore>
          <div className="print-avoid">
            <FreedomChart analysis={a} mode="real" height={280} animate={false} />
            <div className="mt-2">
              <ChartLegend
                items={[
                  { label: 'Accumulation', color: 'var(--chart-1)' },
                  { label: 'Withdrawal phase', color: 'var(--chart-2)' },
                  ...(a.workOptional != null && a.workOptional !== inputs.retirementAge ? [{ label: 'Work-optional age', color: 'var(--gold)' }] : []),
                ]}
              />
            </div>
          </div>
          <table className="tnum mt-5 w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="py-1.5 font-medium">Age</th>
                <th className="py-1.5 font-medium">Year</th>
                <th className="py-1.5 text-right font-medium">Today’s dollars</th>
                <th className="py-1.5 text-right font-medium">Future dollars</th>
              </tr>
            </thead>
            <tbody>
              {checkpointAges.map((age) => {
                const r = balanceAtAge(a.projection, age, 'real');
                const n = balanceAtAge(a.projection, age, 'nominal');
                if (r == null || n == null) return null;
                return (
                  <tr key={age} className="border-b border-line/60">
                    <td className="py-1.5 text-ink">{age === endAge ? `End of plan (age ${inputs.planningHorizonAge})` : age}{age === inputs.retirementAge ? ' · full-time work ends' : ''}</td>
                    <td className="py-1.5 text-ink-3">{inputs.startYear + age - inputs.currentAge}</td>
                    <td className="py-1.5 text-right text-ink">{formatMoney(r)}</td>
                    <td className="py-1.5 text-right text-ink-2">{formatMoney(n)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11.5px] text-ink-3">
            Starting investable assets {formatMoney(investableAssets(inputs.assets))}. Return {formatPct(inputs.nominalReturn, 2)} nominal, inflation {formatPct(inputs.inflation, 2)}.
          </p>
        </Section>

        {compared.length > 1 && (
          <Section title="Scenario comparison" breakBefore>
            <table className="tnum w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-1.5 text-left font-medium text-ink-3" />
                  {compared.map((c) => (
                    <th key={c.id} className="py-1.5 text-right font-semibold text-ink">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Full-time work ends', (c: (typeof compared)[number]) => `Age ${c.inputs.retirementAge}`],
                  ['Portfolio at retirement', (c: (typeof compared)[number]) => formatMoney(c.analysis.metrics.portfolioAtRetirement.real, { compact: true })],
                  ['Portfolio at 65', (c: (typeof compared)[number]) => (c.analysis.metrics.portfolioAt65 ? formatMoney(c.analysis.metrics.portfolioAt65.real, { compact: true }) : '—')],
                  ['Portfolio at 80', (c: (typeof compared)[number]) => (c.analysis.metrics.portfolioAt80 ? formatMoney(c.analysis.metrics.portfolioAt80.real, { compact: true }) : '—')],
                  ['End of plan', (c: (typeof compared)[number]) => formatMoney(c.analysis.metrics.portfolioAtHorizon.real, { compact: true })],
                  ['Years worked', (c: (typeof compared)[number]) => String(c.analysis.metrics.totalYearsWorked)],
                  ['Work-optional age', (c: (typeof compared)[number]) => (c.analysis.workOptional == null ? 'Not reached' : String(c.analysis.workOptional))],
                  ['Depletion', (c: (typeof compared)[number]) => (c.analysis.metrics.depletionAge == null ? 'None' : `Age ${c.analysis.metrics.depletionAge}`)],
                ].map(([label, get]) => (
                  <tr key={label as string} className="border-b border-line/60">
                    <td className="py-1.5 text-ink-2">{label as string}</td>
                    {compared.map((c) => (
                      <td key={c.id} className="py-1.5 text-right text-ink">{(get as (c: (typeof compared)[number]) => string)(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {tradeoffs.length > 0 && (
              <ul className="mt-4 space-y-2">
                {tradeoffs.map((t) => (
                  <li key={t.id} className="flex gap-2 text-[13px] text-ink-2">
                    <ToneIcon tone={t.tone} className="mt-0.5" />
                    <span>
                      <span className="font-medium text-ink">{t.title}.</span> {t.body}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        <Section title="Major risks and uncertainties">
          <ul className="space-y-2">
            {risks.map((r) => (
              <li key={r.id} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
                <ToneIcon tone={r.tone} className="mt-0.5" />
                <span>
                  <span className="font-medium text-ink">{r.title}.</span> {r.body}
                </span>
              </li>
            ))}
            {[
              'Investment returns vary from year to year; this projection assumes a steady average unless a stress test is applied. Poor returns early in retirement are especially damaging.',
              'Inflation, tax law, healthcare costs and longevity are uncertain and can change spending needs materially.',
              'Future income, equity payouts and property values are estimates and may not materialize as entered.',
            ].map((t) => (
              <li key={t} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
                <ToneIcon tone="neutral" className="mt-0.5" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Methodology" breakBefore>
          <MethodologyContent compact />
        </Section>

        <Section title="Disclaimer">
          <Disclaimer className="!text-[12px]" />
        </Section>
      </article>
    </div>
  );
}

function Section({ title, children, breakBefore }: { title: string; children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <section className={`mt-10 ${breakBefore ? 'print-break print:mt-0' : ''}`}>
      <h2 className="mb-4 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[color:var(--gold)]">{title}</h2>
      {children}
    </section>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="text-[11.5px] text-ink-3">{label}</div>
      <div className="tnum mt-1 text-[19px] font-semibold tracking-[-0.02em] text-ink">{value}</div>
    </div>
  );
}
