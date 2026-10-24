'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { askAssistant, AssistantError, detectBackend, errorCopy, type AssistantBackend, type ChatTurn } from '@/lib/assistant/client';
import { workOptionalAge, type PlanInputs } from '@/lib/engine';
import { Button, cx } from './ui';

function suggestions(inputs: PlanInputs): string[] {
  const out: string[] = [];
  const wo = workOptionalAge(inputs);
  out.push(wo == null ? 'Why doesn’t work become optional in my plan?' : `Why is my work-optional age ${wo}?`);
  if (inputs.equity.length) out.push('What if my equity pays out two years late?');
  if (inputs.workPhases.some((w) => w.coversSpending)) out.push('How much does my consulting need to earn?');
  else out.push(`What if I retire at ${Math.max(inputs.currentAge, inputs.retirementAge - 2)}?`);
  out.push('What is the biggest risk in my plan?');
  return out.slice(0, 4);
}

/** Render the assistant's plain-text answer: paragraphs and "- " bullets. */
function AnswerText({ text }: { text: string }) {
  const blocks = text.replace(/\*\*(.+?)\*\*/g, '$1').split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-4">
              {lines.map((l, k) => (
                <li key={k}>{l.replace(/^\s*[-•]\s+/, '')}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {b}
          </p>
        );
      })}
    </div>
  );
}

export function PlanAssistant({ inputs, planId }: { inputs: PlanInputs; planId: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backend, setBackend] = useState<AssistantBackend | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prompts = useMemo(() => suggestions(inputs), [inputs]);

  useEffect(() => {
    detectBackend().then(setBackend);
  }, []);

  // A different plan starts a fresh conversation.
  useEffect(() => {
    ctl.current?.abort();
    setTurns([]);
    setError(null);
  }, [planId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, streaming, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const next: ChatTurn[] = [...turns, { role: 'user', content: q }];
    setTurns(next);
    setDraft('');
    setError(null);
    setBusy(true);
    setStreaming('');
    const c = new AbortController();
    ctl.current = c;
    try {
      const text = await askAssistant(next, inputs, { signal: c.signal, onText: setStreaming });
      setTurns((t) => [...t, { role: 'assistant', content: text }]);
    } catch (e) {
      const err = e instanceof AssistantError ? e : new AssistantError('upstream_error');
      if (err.partial) setTurns((t) => [...t, { role: 'assistant', content: `${err.partial} …` }]);
      if (err.code !== 'cancelled') setError(errorCopy(err.code));
    } finally {
      setBusy(false);
      setStreaming(null);
      ctl.current = null;
    }
  };

  if (backend === 'unavailable') return null;

  return (
    <div className="no-print">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-50 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-[13.5px] font-medium text-bg shadow-float transition-transform hover:-translate-y-0.5 dark:bg-accent dark:text-accent-ink"
          style={{ right: 'max(20px, env(safe-area-inset-right, 0px))', bottom: 'max(20px, env(safe-area-inset-bottom, 0px))' }}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M4 4h12v9H8l-4 3z" strokeLinejoin="round" />
          </svg>
          Ask about your plan
        </button>
      )}
      {open && (
        <section
          role="dialog"
          aria-label="Plan assistant"
          className="fa-rise fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float"
          style={{
            right: 'max(16px, env(safe-area-inset-right, 0px))',
            bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
            width: 'min(420px, calc(100vw - 32px))',
            height: 'min(620px, calc(100vh - 96px))',
          }}
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">Ask about your plan</h2>
              <p className="text-[11.5px] leading-snug text-ink-3">
                Answers come from your plan’s numbers. Educational, not financial advice.
              </p>
            </div>
            <div className="flex items-center gap-1">
              {turns.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { ctl.current?.abort(); setTurns([]); setError(null); }}>
                  Clear
                </Button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {turns.length === 0 && !busy && (
              <div>
                <p className="text-[13px] leading-relaxed text-ink-2">
                  Ask why a number is what it is, or try a what-if. The assistant can rerun your projection with changed assumptions.
                </p>
                <div className="mt-3 flex flex-col items-start gap-2">
                  {prompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="rounded-xl border border-line px-3 py-2 text-left text-[13px] text-ink hover:border-accent hover:text-accent"
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-[11.5px] leading-relaxed text-ink-3">
                  {backend === 'claude-viewer'
                    ? 'Uses your Claude account; your plan’s numbers are sent with each question.'
                    : 'Your question and plan numbers are sent to Claude to answer. Nothing is stored.'}
                </p>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={cx('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cx(
                    'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed',
                    t.role === 'user' ? 'bg-ink text-bg dark:bg-accent dark:text-accent-ink' : 'bg-surface-2 text-ink',
                  )}
                >
                  {t.role === 'assistant' ? <AnswerText text={t.content} /> : t.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
                  {streaming ? <AnswerText text={streaming} /> : <span className="animate-pulse text-ink-3">Working through your numbers…</span>}
                </div>
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-caution-soft px-3 py-2 text-[12.5px] text-ink">
                {error}
              </p>
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <label htmlFor="assistant-input" className="sr-only">
              Your question
            </label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder="e.g. What if I spend $20K less?"
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-accent"
            />
            {busy ? (
              <Button type="button" onClick={() => ctl.current?.abort()}>
                Stop
              </Button>
            ) : (
              <Button type="submit" variant="primary" disabled={!draft.trim()}>
                Ask
              </Button>
            )}
          </form>
        </section>
      )}
    </div>
  );
}
