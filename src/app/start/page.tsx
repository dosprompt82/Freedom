'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { Button, NumberInput, cx, type NumberFormat } from '@/components/ui';
import { analyzePlan, defaultInputs, LIMITS, realReturn, type PlanInputs } from '@/lib/engine';
import { formatMoney, formatPct } from '@/lib/format';
import { GLOSSARY } from '@/lib/glossary';
import { useStore } from '@/lib/store';

interface Step {
  key: string;
  question: string;
  help: ReactNode;
  format: NumberFormat;
  get: (p: PlanInputs) => number;
  set: (p: PlanInputs, v: number) => PlanInputs;
  min: number;
  max: number;
  sliderMin: number;
  sliderMax: number;
  step: number;
  integer?: boolean;
  optional?: boolean;
  presets?: { label: string; value: number }[];
  unitLabel?: (v: number, p: PlanInputs) => ReactNode;
}

const STEPS: Step[] = [
  {
    key: 'age',
    question: 'How old are you today?',
    help: 'If you plan as a couple, use the age of whoever is younger — it keeps the plan conservative.',
    format: 'age',
    get: (p) => p.currentAge,
    set: (p, v) => ({ ...p, currentAge: v, retirementAge: Math.max(p.retirementAge, v) }),
    min: LIMITS.currentAge.min,
    max: 80,
    sliderMin: 25,
    sliderMax: 70,
    step: 1,
    integer: true,
  },
  {
    key: 'retire',
    question: 'When would you like work to become optional?',
    help: 'The age you would like to stop full-time work. You can still model consulting or part-time work later.',
    format: 'age',
    get: (p) => p.retirementAge,
    set: (p, v) => ({ ...p, retirementAge: v }),
    min: LIMITS.retirementAge.min,
    max: 85,
    sliderMin: 40,
    sliderMax: 75,
    step: 1,
    integer: true,
    presets: [
      { label: '50', value: 50 },
      { label: '55', value: 55 },
      { label: '60', value: 60 },
      { label: '65', value: 65 },
    ],
  },
  {
    key: 'assets',
    question: 'What are your investable assets today?',
    help: GLOSSARY.investable,
    format: 'money',
    get: (p) => p.assets.total,
    set: (p, v) => ({ ...p, assets: { ...p.assets, mode: 'total', total: v } }),
    min: 0,
    max: LIMITS.assets.max,
    sliderMin: 0,
    sliderMax: 10_000_000,
    step: 50_000,
    presets: [
      { label: '$500K', value: 500_000 },
      { label: '$1M', value: 1_000_000 },
      { label: '$2.5M', value: 2_500_000 },
      { label: '$5M', value: 5_000_000 },
    ],
  },
  {
    key: 'savings',
    question: 'How much does your household save each year?',
    help: GLOSSARY.savings,
    format: 'money',
    get: (p) => p.annualSavings,
    set: (p, v) => ({ ...p, annualSavings: v }),
    min: 0,
    max: LIMITS.annualSavings.max,
    sliderMin: 0,
    sliderMax: 500_000,
    step: 5_000,
    presets: [
      { label: '$50K', value: 50_000 },
      { label: '$100K', value: 100_000 },
      { label: '$200K', value: 200_000 },
      { label: '$300K', value: 300_000 },
    ],
  },
  {
    key: 'spending',
    question: 'What would you like to spend each year once work is optional?',
    help: (
      <>
        {GLOSSARY.spending} Many households spend less than they do today once commuting, saving and work costs fall away — and some spend more on travel early on.
      </>
    ),
    format: 'money',
    get: (p) => p.retirementSpending,
    set: (p, v) => ({ ...p, retirementSpending: v }),
    min: 0,
    max: LIMITS.retirementSpending.max,
    sliderMin: 40_000,
    sliderMax: 500_000,
    step: 5_000,
    presets: [
      { label: '$100K', value: 100_000 },
      { label: '$150K', value: 150_000 },
      { label: '$200K', value: 200_000 },
      { label: '$250K', value: 250_000 },
    ],
  },
  {
    key: 'return',
    question: 'What average annual return do you expect?',
    help: <>{GLOSSARY.nominalReturn} We suggest starting at 6% and stress-testing lower.</>,
    format: 'percent',
    get: (p) => p.nominalReturn,
    set: (p, v) => ({ ...p, nominalReturn: v }),
    min: LIMITS.nominalReturn.min,
    max: LIMITS.nominalReturn.max,
    sliderMin: 0.02,
    sliderMax: 0.1,
    step: 0.0025,
    optional: true,
    presets: [
      { label: '5% cautious', value: 0.05 },
      { label: '6% balanced', value: 0.06 },
      { label: '7% growth', value: 0.07 },
    ],
    unitLabel: (v, p) => <>Before inflation · {formatPct(realReturn(v, p.inflation), 2)} after {formatPct(p.inflation)} inflation</>,
  },
  {
    key: 'inflation',
    question: 'What inflation rate should we assume?',
    help: <>{GLOSSARY.inflation} The long-run U.S. average is roughly 2.5–3%.</>,
    format: 'percent',
    get: (p) => p.inflation,
    set: (p, v) => ({ ...p, inflation: v }),
    min: LIMITS.inflation.min,
    max: LIMITS.inflation.max,
    sliderMin: 0,
    sliderMax: 0.06,
    step: 0.0025,
    optional: true,
    presets: [
      { label: '2%', value: 0.02 },
      { label: '2.5%', value: 0.025 },
      { label: '3%', value: 0.03 },
      { label: '3.5%', value: 0.035 },
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const createPlan = useStore((s) => s.createPlan);
  const [inputs, setInputs] = useState<PlanInputs>(() => ({ ...defaultInputs(), retirementAge: 50 }));
  const [idx, setIdx] = useState(0);
  const done = idx >= STEPS.length;
  const step = STEPS[Math.min(idx, STEPS.length - 1)];

  const next = () => setIdx((i) => Math.min(i + 1, STEPS.length));
  const back = () => setIdx((i) => Math.max(0, i - 1));

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        // Let the number input commit on blur first.
        (document.activeElement as HTMLElement | null)?.blur?.();
        setTimeout(next, 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done]);

  const finish = () => {
    createPlan({ name: 'My Freedom Plan', inputs });
    router.push('/app');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <Link href="/" className="text-[13px] text-ink-2 hover:text-ink">
          Exit
        </Link>
      </header>
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8" aria-hidden>
        <div className="h-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${(Math.min(idx, STEPS.length) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-12 sm:px-8">
        {done ? (
          <Reveal inputs={inputs} onBack={back} onFinish={finish} />
        ) : (
          <div key={step.key} className="fa-rise">
            <p className="text-[13px] font-medium text-ink-3">
              Question {idx + 1} of {STEPS.length}
              {step.optional && ' · optional'}
            </p>
            <h1 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink sm:text-[38px]">{step.question}</h1>
            <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-ink-2">{step.help}</p>
            <StepInput step={step} inputs={inputs} onChange={setInputs} />
            <div className="mt-10 flex items-center justify-between">
              <Button variant="ghost" onClick={back} disabled={idx === 0}>
                ← Back
              </Button>
              <div className="flex items-center gap-2">
                {step.optional && (
                  <Button variant="ghost" onClick={next} title="Keep the suggested default">
                    Skip, use default
                  </Button>
                )}
                <Button variant="primary" size="lg" onClick={next}>
                  {idx === STEPS.length - 1 ? 'See my plan' : 'Continue'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="mx-auto w-full max-w-5xl px-5 pb-8 text-center text-[12px] text-ink-3 sm:px-8">
        No account, no email, no bank connections. Your answers stay in this browser.
      </footer>
    </div>
  );
}

function StepInput({ step, inputs, onChange }: { step: Step; inputs: PlanInputs; onChange: (p: PlanInputs) => void }) {
  const value = step.get(inputs);
  const set = (v: number) => onChange(step.set(inputs, v));
  const sliderMin = step.key === 'retire' ? Math.max(step.sliderMin, inputs.currentAge) : step.sliderMin;
  const min = step.key === 'retire' ? inputs.currentAge : step.min;
  const pct = Math.max(0, Math.min(100, ((value - sliderMin) / (step.sliderMax - sliderMin)) * 100));
  const big =
    step.format === 'money' ? formatMoney(value) : step.format === 'percent' ? formatPct(value, 2) : String(value);
  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="tnum text-[48px] font-semibold leading-none tracking-[-0.04em] text-ink sm:text-[56px]" aria-hidden>
          {big}
        </div>
        <NumberInput
          key={step.key}
          className="w-44"
          label={step.question}
          value={value}
          onChange={set}
          format={step.format}
          min={min}
          max={step.max}
          integer={step.integer}
        />
      </div>
      {step.unitLabel && <p className="mt-2 text-[13px] text-ink-3">{step.unitLabel(value, inputs)}</p>}
      <input
        type="range"
        className="fa-range mt-6"
        aria-label={step.question}
        min={sliderMin}
        max={step.sliderMax}
        step={step.step}
        value={Math.max(sliderMin, Math.min(step.sliderMax, value))}
        onChange={(e) => set(Number(e.target.value))}
        style={{ ['--fill' as string]: `${pct}%` }}
      />
      {step.presets && (
        <div className="mt-5 flex flex-wrap gap-2">
          {step.presets.map((p) => (
            <button
              key={p.label}
              onClick={() => set(Math.max(min, p.value))}
              className={cx(
                'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
                value === p.value ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      {step.key === 'retire' && value < inputs.currentAge && (
        <p className="mt-3 text-[12.5px] text-caution">That is earlier than your current age; the plan will treat you as retired now.</p>
      )}
    </div>
  );
}

function Reveal({ inputs, onBack, onFinish }: { inputs: PlanInputs; onBack: () => void; onFinish: () => void }) {
  const a = useMemo(() => analyzePlan(inputs), [inputs]);
  const m = a.metrics;
  const headline =
    a.workOptional == null
      ? 'Work isn’t optional yet under these assumptions — but you have levers.'
      : a.workOptional <= inputs.retirementAge
        ? `Work could become optional at ${a.workOptional}.`
        : `Work could become optional at ${a.workOptional} — a little later than ${inputs.retirementAge}.`;
  return (
    <div className="fa-rise">
      <p className="text-[13px] font-medium text-accent">Your first projection</p>
      <h1 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink sm:text-[38px]">{headline}</h1>
      <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
        Based on a single steady-return projection in today’s dollars. Next, you can explore the timeline, add consulting income or a liquidity event, and compare scenarios.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3">
        <RevealStat label={`Projected portfolio at ${inputs.retirementAge}`} value={formatMoney(m.portfolioAtRetirement.real, { compact: true })} />
        <RevealStat label="Illustrative Freedom Target" value={formatMoney(m.freedomTarget.real, { compact: true })} sub={`${formatMoney(inputs.retirementSpending, { compact: true })} ÷ ${formatPct(inputs.withdrawal.targetRate)}`} />
        <RevealStat
          label={m.fundingGap.real >= 0 ? 'Projected surplus' : 'Projected gap'}
          value={formatMoney(Math.abs(m.fundingGap.real), { compact: true })}
          tone={m.fundingGap.real >= 0 ? 'positive' : 'caution'}
        />
        <RevealStat
          label="Portfolio lasts"
          value={m.depletionAge == null ? `Through ${inputs.planningHorizonAge}` : `To age ${m.depletionAge}`}
          tone={m.depletionAge == null ? 'positive' : 'caution'}
        />
      </div>
      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Adjust answers
        </Button>
        <Button variant="primary" size="lg" onClick={onFinish}>
          Open my Freedom Plan
        </Button>
      </div>
    </div>
  );
}

function RevealStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'positive' | 'caution' }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="text-[12.5px] text-ink-3">{label}</div>
      <div className={cx('tnum mt-1.5 text-[26px] font-semibold tracking-[-0.03em]', tone === 'positive' ? 'text-accent' : tone === 'caution' ? 'text-caution' : 'text-ink')}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}
