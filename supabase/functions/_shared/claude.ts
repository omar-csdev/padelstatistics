import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.40';
import type { MatchStats } from './engine/types.ts';
import type { AISummaryPayload } from './types.ts';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM_PROMPT = `You are a padel coaching analyst.
You receive a JSON object of MATCH STATISTICS that have ALREADY been aggregated.
Your job is to TRANSLATE the stats into a concise, structured coaching report —
never recompute or invent numbers.

Output STRICT JSON matching this TypeScript type:

type Out = {
  summary: string;            // 2-3 sentences, plain English
  tactics: string;            // 2-3 sentences on tactical reading
  players: {
    tl: { strengths: string[]; weaknesses: string[] };
    tr: { strengths: string[]; weaknesses: string[] };
    bl: { strengths: string[]; weaknesses: string[] };
    br: { strengths: string[]; weaknesses: string[] };
  };
  patterns: string[];         // 2-5 short bullet observations
};

Rules:
- Reference numbers from the stats; do not invent.
- Strengths/weaknesses: 1-3 short bullets each, courtside-coach tone.
- Keep total output under ~400 words.
- Return ONLY the JSON, no prose, no markdown fences.`;

export async function generateSummary(stats: MatchStats): Promise<AISummaryPayload> {
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      { role: 'user', content: JSON.stringify(stats, null, 2) },
    ],
  });

  const text = resp.content.map((b: { type: string; text?: string }) => b.type === 'text' ? (b.text ?? '') : '').join('').trim();
  // Strip accidental ```json fences if model emits them despite instruction.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const parsed = JSON.parse(cleaned) as AISummaryPayload;
  validatePayload(parsed);
  return parsed;
}

function validatePayload(p: any): asserts p is AISummaryPayload {
  if (typeof p?.summary !== 'string') throw new Error('payload.summary missing');
  if (typeof p?.tactics !== 'string') throw new Error('payload.tactics missing');
  for (const pos of ['tl', 'tr', 'bl', 'br']) {
    const x = p?.players?.[pos];
    if (!x || !Array.isArray(x.strengths) || !Array.isArray(x.weaknesses)) {
      throw new Error(`payload.players.${pos} malformed`);
    }
  }
  if (!Array.isArray(p?.patterns)) throw new Error('payload.patterns missing');
}
