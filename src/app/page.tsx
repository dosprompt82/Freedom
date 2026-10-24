'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { FreedomChart } from '@/components/charts/FreedomChart';
import { Logo } from '@/components/Logo';
import { Disclaimer } from '@/components/plan/common';
import { Button, ButtonLink, ToneIcon } from '@/components/ui';
import { analyzeWithInsights, samplePlanInputs } from '@/lib/engine';
import { formatMoney } from '@/lib/format';
import { useStore } from '@/lib/store';

export default function LandingPage() {
  const router = useRouter();
  const openSample = useStore((s) => s.openSample);
  const sample = useMemo(() => analyzeWithInsights(samplePlanInputs(2026)), []);
  const exploreSample = () => {
    openSample();
    router.push('/app');
  };
  const quotes = sample.insights.filter((i) => ['delay', 'spending', 'transition', 'equity'].includes(i.id)).slice(0, 3);

  return (
    <div className="overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav aria-label="Site" className="hidden items-center gap-7 text-[13.5px] text-ink-2 md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#scenarios" className="hover:text-ink">Scenario Lab</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <Link href="/methodology" className="hover:text-ink">Methodology</Link>
        </nav>
        <ButtonLink href="/start" variant="primary" size="sm">
          Get started
        </ButtonLink>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-20">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)] opacity-70" aria-hidden />
        <div className="relative max-w-3xl">
          <p className="fa-rise text-[13px] font-medium tracking-wide text-[color:var(--gold)]">Your money. Your time. Your next chapter.</p>
          <h1 className="fa-rise mt-4 text-[44px] font-semibold leading-[1.04] tracking-[-0.045em] text-ink sm:text-[68px]" style={{ animationDelay: '60ms' }}>
            When could work become optional?
          </h1>
          <p className="fa-rise mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2" style={{ animationDelay: '120ms' }}>
            Explore your financial future, compare possibilities, and discover the freedom your money could create.
          </p>
          <div className="fa-rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: '180ms' }}>
            <ButtonLink href="/start" variant="primary" size="lg">
              Build My Freedom Plan
            </ButtonLink>
            <Button size="lg" onClick={exploreSample}>
              Explore a Sample Plan
            </Button>
          </div>
          <p className="fa-rise mt-5 text-[12.5px] text-ink-3" style={{ animationDelay: '220ms' }}>
            About two minutes · No account or email · Nothing leaves your browser
          </p>
        </div>

        <div className="fa-rise relative mt-16 rounded-[28px] border border-line bg-surface p-3 shadow-float sm:p-5" style={{ animationDelay: '260ms' }}>
          <div className="flex flex-wrap items-start justify-between gap-4 px-3 pt-2">
            <div>
              <div className="text-[12.5px] text-ink-3">Sample household · age 44 · today&apos;s dollars</div>
              <div className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-ink">
                Work could become optional at {sample.workOptional ?? '—'}
              </div>
            </div>
            <div className="flex gap-6">
              <HeroStat label="Planned retirement" value={`Age ${sample.inputs.retirementAge}`} />
              <HeroStat label="Portfolio at 50" value={formatMoney(sample.metrics.portfolioAtRetirement.real, { compact: true })} />
              <HeroStat label="End of plan" value={formatMoney(sample.metrics.portfolioAtHorizon.real, { compact: true })} />
            </div>
          </div>
          <div className="mt-2">
            <FreedomChart analysis={sample} mode="real" height={300} />
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section id="how" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-3">
          <Pillar
            n="01"
            title="See where you stand"
            body="Answer eight short questions. See the earliest age work could become optional, and a year-by-year projection of how your money gets you there."
          />
          <Pillar
            n="02"
            title="Explore what if"
            body="Retire at 50 or 55. Consult for five years. Model an equity payout, a bigger home, a market downturn. Compare up to three futures side by side."
          />
          <Pillar
            n="03"
            title="Decide with clarity"
            body="Every number traces back to assumptions you can see and change. Plain-English insights explain what actually moves your plan."
          />
        </div>
      </section>

      {/* Scenario lab */}
      <section id="scenarios" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-[13px] font-medium text-accent">What If? Scenario Lab</p>
            <h2 className="mt-3 text-[34px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[42px]">
              Freedom isn’t one number. It’s a set of choices.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ink-2">
              Retirement doesn’t have to mean never working again. It might mean consulting, going part-time, or simply having the ability to say no. Freedom at 50 models the transitions real professionals make — bonuses, equity, a home sale, college — without pretending to know the future.
            </p>
            <ul className="mt-7 space-y-2.5 text-[14px] text-ink-2">
              {['Multiple employment phases with after-tax income', 'Company equity as a range of outcomes and timings', 'Deterministic downturn stress tests', 'Today’s or future dollars, always labeled'].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <ToneIcon tone="positive" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-[12.5px] text-ink-3">Live insights computed from the sample plan:</p>
            {quotes.map((q, i) => (
              <figure key={q.id} className="fa-rise rounded-2xl border border-line bg-surface p-5 shadow-card" style={{ animationDelay: `${i * 80}ms` }}>
                <figcaption className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <ToneIcon tone={q.tone} />
                  {q.title}
                </figcaption>
                <blockquote className="mt-2 text-[14px] leading-relaxed text-ink-2">{q.body}</blockquote>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <div className="grid gap-8 rounded-[28px] bg-[color:var(--ink)] px-8 py-14 text-[color:var(--bg)] sm:px-14 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.03em]">Private by design.</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed opacity-75">
              No account. No bank logins. No data sent to a server. Your plan is calculated and stored in your browser, and you can export or delete it any time.
            </p>
          </div>
          <ul className="space-y-3 text-[14px] opacity-90">
            <li>— Works with a single total or account-level detail</li>
            <li>— Home equity is never counted as spendable unless you plan a sale</li>
            <li>— Private company equity counts only when it pays out</li>
            <li>— Transparent methodology you can read in full</li>
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="text-[34px] font-semibold tracking-[-0.035em] text-ink">Simple pricing</h2>
            <p className="mt-3 text-[15px] text-ink-2">
              During the early-access preview, every feature is unlocked. No card required.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <PriceCard
              name="Essentials"
              price="Free"
              features={['Guided onboarding', 'Freedom Timeline and milestones', 'Your work-optional age', 'One saved plan']}
              cta={<ButtonLink href="/start" size="md">Start free</ButtonLink>}
            />
            <PriceCard
              name="Freedom Plus"
              price="$99"
              per="/ year"
              highlight
              features={['Scenario Lab with three-way comparison', 'Employment phases, equity, real estate and events', 'Monte Carlo simulation (beta)', 'Unlimited plans, checkpoints, printable report']}
              cta={<ButtonLink href="/start" variant="primary" size="md">Included in early access</ButtonLink>}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-ink">Questions</h2>
        <dl className="mt-8 divide-y divide-line">
          {[
            ['Is this financial advice?', 'No. Freedom at 50 is an educational planning tool. It shows the consequences of the assumptions you enter, and it cannot know what markets, taxes or your life will do.'],
            ['What is the “work-optional age”?', 'The earliest age at which you could stop all paid work and still fund your planned spending through your planning horizon, in a single projection with steady returns. It is an estimate, not a guarantee.'],
            ['Does it handle taxes?', 'Partly, by design. You enter after-tax savings, income and event amounts, and can set an effective tax rate on withdrawals. It does not compute tax brackets or account-specific rules.'],
            ['Where is my data stored?', 'Only in your browser’s local storage. Export a file to back it up or move it to another device.'],
          ].map(([q, a]) => (
            <div key={q} className="py-5">
              <dt className="text-[15px] font-medium text-ink">{q}</dt>
              <dd className="mt-2 text-[14px] leading-relaxed text-ink-2">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Logo />
            <div className="flex gap-6 text-[13px] text-ink-2">
              <Link href="/methodology" className="hover:text-ink">Methodology</Link>
              <Link href="/app" className="hover:text-ink">Open app</Link>
            </div>
          </div>
          <Disclaimer className="mt-6 max-w-3xl" />
        </div>
      </footer>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[11.5px] text-ink-3">{label}</div>
      <div className="tnum text-[17px] font-semibold tracking-[-0.02em] text-ink">{value}</div>
    </div>
  );
}

function Pillar({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="tnum text-[13px] font-medium text-[color:var(--gold)]">{n}</div>
      <h3 className="mt-3 text-[19px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

function PriceCard({
  name,
  price,
  per,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  per?: string;
  features: string[];
  cta: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-3xl border p-8 ${highlight ? 'border-ink bg-bg shadow-float dark:border-accent' : 'border-line bg-bg'}`}>
      <div className="text-[14px] font-medium text-ink-2">{name}</div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="tnum text-[40px] font-semibold tracking-[-0.04em] text-ink">{price}</span>
        {per && <span className="text-[14px] text-ink-3">{per}</span>}
      </div>
      <ul className="mt-6 space-y-2.5 text-[14px] text-ink-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <ToneIcon tone="positive" className="mt-0.5" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-8">{cta}</div>
    </div>
  );
}
