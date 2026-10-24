import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { ASSISTANT_INSTRUCTIONS, buildBriefing } from '@/lib/assistant/briefing';
import { ASSISTANT_TOOLS, executeAssistantTool } from '@/lib/assistant/tools';
import { normalizeInputs } from '@/lib/engine/migrate';

export const runtime = 'nodejs';

const MODEL = 'claude-opus-5-5';
const MAX_ROUNDS = 6;
const MAX_TURNS = 20;
const MAX_CHARS = 4000;

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Plan assistant endpoint. The browser sends the conversation and the plan
 * inputs; this route builds a briefing from the engine, lets Claude call the
 * engine-backed tools, and returns the final answer. Nothing is stored.
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  let body: { messages?: ChatTurn[]; inputs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const turns = (Array.isArray(body.messages) ? body.messages : [])
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
    .slice(-MAX_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_CHARS) }));
  if (!turns.length || turns[turns.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  while (turns[0]?.role === 'assistant') turns.shift();

  const inputs = normalizeInputs(body.inputs);
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = turns;
  const tools: Anthropic.Beta.BetaTool[] = ASSISTANT_TOOLS.map((t) => ({ ...t }));

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        // Conversational answers: keep latency low.
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [
          { type: 'text', text: ASSISTANT_INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: buildBriefing(inputs) },
        ],
        tools,
        messages,
      });

      if (response.stop_reason === 'refusal') {
        return NextResponse.json({ error: 'refused' }, { status: 422 });
      }
      if (response.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: response.content });
        continue;
      }
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || !toolUses.length) {
        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return NextResponse.json({ text: text || 'I could not produce an answer. Try rephrasing the question.' });
      }

      messages.push({ role: 'assistant', content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) => {
        try {
          return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(executeAssistantTool(tu.name, tu.input, inputs)) };
        } catch (e) {
          return { type: 'tool_result', tool_use_id: tu.id, is_error: true, content: e instanceof Error ? e.message : 'Tool failed.' };
        }
      });
      messages.push({ role: 'user', content: results });
    }
    return NextResponse.json({ text: 'That took too many steps. Try a narrower question.' });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    if (error instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
    if (error instanceof Anthropic.APIError) return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
  }
}
