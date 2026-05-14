import { supabase } from './supabase';

export type AISummaryRequest = { matchId: string };

export type AISummaryPayload = {
  summary: string;
  tactics: string;
  players: Record<'tl' | 'tr' | 'bl' | 'br', { strengths: string[]; weaknesses: string[] }>;
  patterns: string[];
};

export type AISummaryResponse =
  | { ok: true; cached: boolean; payload: AISummaryPayload; usage: { used: number; limit: number } }
  | { ok: false; error: 'rate_limit'; resets_at: string; usage: { used: number; limit: number } }
  | { ok: false; error: 'not_found' | 'unauthorized' | 'internal' };

export async function generateAISummary(matchId: string): Promise<AISummaryResponse> {
  const { data, error } = await supabase.functions.invoke<AISummaryResponse>(
    'generate-ai-summary',
    { body: { matchId } satisfies AISummaryRequest },
  );
  if (error) {
    const ctx = (error as { context?: { status?: number; json?: AISummaryResponse } }).context;
    if (ctx?.status === 429 && ctx.json) return ctx.json;
    return { ok: false, error: 'internal' };
  }
  return data!;
}
