// Wire types for the generate-ai-summary Edge Function.
// Vendored by Agent D into src/api/aiSummary.ts on the app side — keep field names normative.

export type AISummaryRequest = { matchId: string };

export type AISummaryPayload = {
  summary: string;
  tactics: string;
  players: Record<'tl' | 'tr' | 'bl' | 'br', { strengths: string[]; weaknesses: string[] }>;
  patterns: string[];
};

export type AISummaryResponse =
  | { ok: true;  cached: boolean; payload: AISummaryPayload; usage: { used: number; limit: number } }
  | { ok: false; error: 'rate_limit'; resets_at: string; usage: { used: number; limit: number } }
  | { ok: false; error: 'not_found' | 'unauthorized' | 'internal' };
