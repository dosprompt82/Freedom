'use client';

import type { PlanInputs } from '../engine';
import { ASSISTANT_INSTRUCTIONS, buildBriefing } from './briefing';
import { ASSISTANT_TOOLS, executeAssistantTool } from './tools';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type AssistantBackend = 'claude-viewer' | 'server' | 'unavailable';

export class AssistantError extends Error {
  constructor(
    public code: string,
    public partial?: string,
  ) {
    super(code);
  }
}

let samplePromise: Promise<ClaudeSampleFn | null> | null = null;
function getSample(): Promise<ClaudeSampleFn | null> {
  if (typeof window === 'undefined' || !window.claude?.use) return Promise.resolve(null);
  samplePromise ??= window.claude.use('sample').catch(() => null);
  return samplePromise;
}

/** Which way the assistant can reach Claude here: the viewer's own account, the app server, or neither. */
export async function detectBackend(): Promise<AssistantBackend> {
  if (await getSample()) return 'claude-viewer';
  if (typeof window !== 'undefined' && window.claude) return 'unavailable'; // inside a viewer without sampling
  return 'server';
}

/** Ask about the plan. Streams through `onText` where the backend supports it. */
export async function askAssistant(
  turns: ChatTurn[],
  inputs: PlanInputs,
  opts: { onText?: (text: string) => void; signal?: AbortSignal } = {},
): Promise<string> {
  const recent = turns.slice(-16);
  const sample = await getSample();

  if (sample) {
    const limits = await sample.limits().catch(() => null);
    const tools: ClaudeSampleTool[] | undefined = limits?.tools
      ? ASSISTANT_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.input_schema,
          execute: (input) => executeAssistantTool(t.name, input, inputs),
        }))
      : undefined;
    const lead = `${ASSISTANT_INSTRUCTIONS}${tools ? '' : '\n\n(No tools are available in this view: answer only from the snapshot, and say when a what-if would need the app’s sliders.)'}\n\n${buildBriefing(inputs)}`;
    try {
      const { text } = await sample([{ role: 'user', content: lead }, ...recent], {
        cache: false,
        signal: opts.signal,
        tools,
        onText: ({ text }) => opts.onText?.(text),
      });
      return text;
    } catch (e) {
      const err = e as { code?: string; text?: string };
      throw new AssistantError(err.code ?? 'upstream_error', err.text);
    }
  }

  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: recent, inputs }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AssistantError('cancelled');
    throw new AssistantError('upstream_error');
  }
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok || !data.text) throw new AssistantError(data.error ?? (res.status === 404 ? 'not_configured' : 'upstream_error'));
  opts.onText?.(data.text);
  return data.text;
}

export function errorCopy(code: string): string {
  switch (code) {
    case 'not_granted':
    case 'sampling_disabled':
      return 'The assistant needs permission to use Claude. Allow it when asked, or check this page’s permissions.';
    case 'not_configured':
      return 'The assistant isn’t set up on this server yet. It needs an Anthropic API key (ANTHROPIC_API_KEY).';
    case 'rate_limited':
      return 'Too many questions in a short time. Wait a moment, then try again.';
    case 'refused':
      return 'Claude declined that question. Try asking it a different way.';
    case 'session_expired':
      return 'Your Claude session expired. Sign in again, then retry.';
    default:
      return 'Something went wrong reaching Claude. Try again.';
  }
}
