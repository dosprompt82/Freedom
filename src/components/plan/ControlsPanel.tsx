'use client';

import { useMemo } from 'react';
import { LIMITS, newWorkPhase, phaseSummaries, projectPlan, realReturn, type PlanInputs } from '@/lib/engine';
import { formatMoney, formatPct } from '@/lib/format';
import { GLOSSARY } from '@/lib/glossary';
import { InfoTip, Segmented, SliderField } from '../ui';

interface Props {
  inputs: PlanInputs;
  onChange: (fn: (p: PlanInputs) => PlanInputs) => void;
  /** Show the full set (inflation, withdrawal rate) or only the essentials. */
  dense?: boolean;
}

/** The primary "what if I…" levers. All values update the model immediately. */
export function ControlsPanel({ inputs, onChange, dense }: Props) {
  const quick = inputs.workPhases.find((p) => p.anchor === 'retirement');
  const set = <K extends keyof PlanInputs>(key: K, v: PlanInputs[K]) => onChange((p) => ({ ...p, [key]: v }));

  const need = useMemo(() => {
    if (!quick?.coversSpending) return null;
    return phaseSummaries(projectPlan(inputs)).find((x) => x.phaseId === quick.id) ?? null;
  }, [inputs, quick]);

  const setConsulting = (mode: 'none' | 'covers' | 'income') =>
    onChange((p) => {
      const existing = p.workPhases.find((w) => w.anchor === 'retirement');
      if (mode === 'none') return { ...p, workPhases: p.workPhases.filter((w) => w !== existing) };
      const coversSpending = mode === 'covers';
      if (existing) return { ...p, workPhases: p.workPhases.map((w) => (w === existing ? { ...w, coversSpending } : w)) };
      return {
        ...p,
        workPhases: [...p.workPhases, newWorkPhase({ label: 'Consulting', annualNetIncome: 120_000, years: 5, coversSpending })],
      };
    });

  const setPartTime = (income: number) =>
    onChange((p) => {
      const existing = p.workPhases.find((w) => w.anchor === 'retirement');
      if (income <= 0) return { ...p, workPhases: p.workPhases.filter((w) => w !== existing) };
      if (existing) return { ...p, workPhases: p.workPhases.map((w) => (w === existing ? { ...w, annualNetIncome: income } : w)) };
      return { ...p, workPhases: [...p.workPhases, newWorkPhase({ label: 'Part-time work', annualNetIncome: income, years: 5 })] };
    });
  const setPartTimeYears = (years: number) =>
    onChange((p) => ({
      ...p,
      workPhases: p.workPhases.map((w) => (w.anchor === 'retirement' && w === p.workPhases.find((x) => x.anchor === 'retirement') ? { ...w, years } : w)),
    }));

  const minRet = inputs.currentAge;
  return (
    <div className="space-y-6">
      <SliderField
        label="Retirement age"
        ariaLabel="Target retirement age"
        value={inputs.retirementAge}
        onChange={(v) => set('retirementAge', v)}
        min={minRet}
        max={Math.min(80, inputs.planningHorizonAge)}
        hardMax={Math.min(LIMITS.retirementAge.max, inputs.planningHorizonAge)}
        step={1}
        integer
        format="age"
        hint="When full-time work and annual savings stop."
      />
      <SliderField
        label={<>Annual savings <InfoTip term="Annual savings">{GLOSSARY.savings}</InfoTip></>}
        ariaLabel="Annual household savings"
        value={inputs.annualSavings}
        onChange={(v) => set('annualSavings', v)}
        min={0}
        max={600_000}
        hardMax={LIMITS.annualSavings.max}
        step={5_000}
        format="money"
      />
      <SliderField
        label={<>Retirement spending <InfoTip term="Retirement spending">{GLOSSARY.spending}</InfoTip></>}
        ariaLabel="Annual retirement spending in today's dollars"
        value={inputs.retirementSpending}
        onChange={(v) => set('retirementSpending', v)}
        min={40_000}
        max={600_000}
        hardMin={0}
        hardMax={LIMITS.retirementSpending.max}
        step={5_000}
        format="money"
        hint="Per year, after tax, in today’s dollars."
      />
      <SliderField
        label={<>Investment return <InfoTip term="Nominal return">{GLOSSARY.nominalReturn}</InfoTip></>}
        ariaLabel="Expected nominal annual investment return"
        value={inputs.nominalReturn}
        onChange={(v) => set('nominalReturn', v)}
        min={0.02}
        max={0.1}
        hardMin={LIMITS.nominalReturn.min}
        hardMax={LIMITS.nominalReturn.max}
        step={0.0025}
        format="percent"
        hint={<>Nominal. Real return {formatPct(realReturn(inputs.nominalReturn, inputs.inflation), 2)} <InfoTip term="Real return">{GLOSSARY.realReturn}</InfoTip></>}
      />
      <div className="space-y-4 rounded-xl border border-line bg-surface-2/40 p-3.5">
        <div>
          <div className="mb-2 text-[13px] font-medium text-ink-2">Consulting after full-time work</div>
          <Segmented
            label="Consulting after full-time work"
            size="sm"
            value={!quick ? 'none' : quick.coversSpending ? 'covers' : 'income'}
            onChange={setConsulting}
            options={[
              { value: 'none', label: 'None' },
              { value: 'covers', label: 'Covers expenses' },
              { value: 'income', label: 'Set income' },
            ]}
          />
        </div>
        {quick && !quick.coversSpending && (
          <SliderField
            label="Consulting income"
            ariaLabel="Annual after-tax consulting income"
            value={quick.annualNetIncome}
            onChange={setPartTime}
            min={0}
            max={400_000}
            hardMax={LIMITS.workIncome.max}
            step={5_000}
            format="money"
            hint={`After tax, today’s dollars, starting at ${inputs.retirementAge}.`}
          />
        )}
        {quick && (
          <SliderField
            label="Consulting years"
            ariaLabel="Years of consulting"
            value={quick.years}
            onChange={setPartTimeYears}
            min={1}
            max={20}
            hardMax={40}
            step={1}
            integer
            format="years"
            hint={
              quick.coversSpending && need ? (
                <>
                  Ages {need.start}–{need.end - 1}. Needs about <strong className="text-ink">{formatMoney(need.avgIncomeReal, { approx: true })}/yr</strong> after tax so the portfolio is never touched.
                </>
              ) : undefined
            }
          />
        )}
      </div>
      {!dense && (
        <>
          <SliderField
            label={<>Inflation <InfoTip term="Inflation">{GLOSSARY.inflation}</InfoTip></>}
            ariaLabel="Annual inflation"
            value={inputs.inflation}
            onChange={(v) => set('inflation', v)}
            min={0}
            max={0.06}
            hardMin={LIMITS.inflation.min}
            hardMax={LIMITS.inflation.max}
            step={0.0025}
            format="percent"
          />
          <SliderField
            label={<>Withdrawal-rate assumption <InfoTip term="Withdrawal rate">{GLOSSARY.withdrawalRate}</InfoTip></>}
            ariaLabel="Initial withdrawal rate used for the Freedom Target"
            value={inputs.withdrawal.targetRate}
            onChange={(v) => onChange((p) => ({ ...p, withdrawal: { ...p.withdrawal, targetRate: v } }))}
            min={0.025}
            max={0.06}
            hardMin={LIMITS.targetRate.min}
            hardMax={LIMITS.targetRate.max}
            step={0.0025}
            format="percent"
            hint="Sizes the Freedom Target only. It is not a safe-spending guarantee."
          />
        </>
      )}
    </div>
  );
}
