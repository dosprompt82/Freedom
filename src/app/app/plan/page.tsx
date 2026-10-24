'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { AssumptionsTable } from '@/components/plan/Assumptions';
import { PageHeader, SampleBadge } from '@/components/plan/common';
import { Badge, Button, ButtonLink, Card, CardHeader, TextInput, cx } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useAnalysis } from '@/lib/hooks';
import { exportPlanFile, parsePlanFile, useActivePlan, useStore } from '@/lib/store';

function when(t: number) {
  return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MyPlanPage() {
  const plan = useActivePlan()!;
  const store = useStore();
  const analysis = useAnalysis(plan.inputs);
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (tone: 'ok' | 'err', text: string) => {
    setMessage({ tone, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const exportJson = () => {
    const blob = new Blob([exportPlanFile(plan)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'freedom-plan'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('ok', 'Plan exported. Keep the file somewhere private — it contains your financial assumptions.');
  };

  const importJson = async (file: File) => {
    try {
      const parsed = parsePlanFile(await file.text());
      store.importPlan(parsed);
      flash('ok', `Imported “${parsed.name}”.`);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Could not import that file.');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={<SampleBadge isSample={plan.isSample} />}
        title="My Plan"
        subtitle="Save checkpoints, keep multiple plans, export a private copy, and print a clean report. Everything is stored only in this browser."
        actions={
          <>
            <ButtonLink href="/report" variant="primary">
              Printable report
            </ButtonLink>
            <Button onClick={exportJson}>Export</Button>
            <Button onClick={() => fileRef.current?.click()}>Import</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Import plan file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = '';
              }}
            />
          </>
        }
      />
      {message && (
        <div role="status" className={cx('fa-rise mb-5 rounded-xl px-4 py-3 text-[13px]', message.tone === 'ok' ? 'bg-accent-soft text-ink' : 'bg-negative-soft text-negative')}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Current plan" subtitle={`Last changed ${when(plan.updatedAt)} · changes save automatically`} />
            <div className="space-y-5 px-5 pb-6 pt-4 sm:px-6">
              <TextInput label="Plan name" value={plan.name} onChange={(n) => store.renamePlan(plan.id, n)} hideLabel={false} className="max-w-md" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Summary label="Work-optional" value={analysis.workOptional == null ? 'Not reached' : `Age ${analysis.workOptional}`} sub="Estimate" />
                <Summary label="Planned retirement" value={`Age ${plan.inputs.retirementAge}`} sub="Full-time work ends" />
                <Summary label="At retirement" value={formatMoney(analysis.metrics.portfolioAtRetirement.real, { compact: true })} />
                <Summary label="Portfolio lasts" value={analysis.metrics.depletionAge == null ? `Through ${plan.inputs.planningHorizonAge}` : `To ${analysis.metrics.depletionAge}`} sub="Single projection" />
              </div>
              <div className="flex flex-wrap gap-2 border-t border-line pt-5">
                <Button size="sm" onClick={() => { store.duplicatePlan(plan.id); flash('ok', 'Duplicated. You are now editing the copy.'); }}>
                  Duplicate plan
                </Button>
                {confirmDelete === plan.id ? (
                  <>
                    <Button size="sm" variant="danger" onClick={() => { store.deletePlan(plan.id); setConfirmDelete(null); }}>
                      Confirm delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setConfirmDelete(plan.id)}>
                    Delete plan
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Saved checkpoints" subtitle="Snapshot the plan and its scenarios before you experiment. Restore any time." />
            <div className="px-5 pb-6 pt-4 sm:px-6">
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  store.saveVersion(label);
                  setLabel('');
                  flash('ok', 'Checkpoint saved.');
                }}
              >
                <TextInput label="Checkpoint name" placeholder="e.g. Before bonus decision" value={label} onChange={setLabel} className="min-w-[240px] flex-1" />
                <Button type="submit" variant="primary">
                  Save checkpoint
                </Button>
              </form>
              {plan.versions.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {plan.versions.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-medium text-ink">{v.label}</div>
                        <div className="text-[12px] text-ink-3">
                          {when(v.savedAt)} · {v.scenarios.length} scenario{v.scenarios.length === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => { store.restoreVersion(v.id); flash('ok', `Restored “${v.label}”.`); }}>
                          Restore
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => store.deleteVersion(v.id)} aria-label={`Delete checkpoint ${v.label}`}>
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[13px] text-ink-3">No checkpoints yet.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Assumptions used"
              subtitle="Every projection is traceable to these inputs."
              action={<Link href="/app" className="text-[13px] font-medium text-accent hover:underline">Edit →</Link>}
            />
            <div className="px-5 pb-5 pt-2 sm:px-6">
              <AssumptionsTable inputs={plan.inputs} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="All plans" subtitle="Stored privately in this browser." />
            <ul className="mt-3 px-2 pb-3">
              {store.plans.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => store.setActivePlan(p.id)}
                    aria-current={p.id === plan.id}
                    className={cx('flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left', p.id === plan.id ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                      <span className="block text-[12px] text-ink-3">Updated {when(p.updatedAt)}</span>
                    </span>
                    {p.id === plan.id ? <Badge tone="positive">Active</Badge> : p.isSample ? <Badge tone="gold">Sample</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 border-t border-line px-5 py-4 sm:px-6">
              <ButtonLink href="/start" size="sm">
                + New plan
              </ButtonLink>
              {!store.plans.some((p) => p.isSample) && (
                <Button size="sm" variant="ghost" onClick={() => store.openSample()}>
                  Add sample plan
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Saved scenarios"
              action={<Link href="/app/scenarios" className="text-[13px] font-medium text-accent hover:underline">Open lab →</Link>}
            />
            <div className="px-5 pb-5 pt-3 sm:px-6">
              {plan.scenarios.length ? (
                <ul className="space-y-2">
                  {plan.scenarios.map((s) => (
                    <li key={s.id} className="text-[13px]">
                      <span className="font-medium text-ink">{s.name}</span>
                      <span className="block text-[12px] text-ink-3">{s.description}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-3">No scenarios yet. Create one in the Scenario Lab.</p>
              )}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-[14px] font-semibold text-ink">Your data stays with you</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              Freedom at 50 needs no account and never connects to your financial institutions. Plans are saved in this browser’s local storage. Clearing site data removes them, so export a copy of anything you want to keep.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value, sub = "Today's dollars" }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="tnum mt-0.5 text-[17px] font-semibold text-ink">{value}</div>
      <div className="text-[11px] text-ink-3">{sub}</div>
    </div>
  );
}
