import { admin, getUserFromAuthHeader } from '../_shared/supabase.ts';
import { generateSummary } from '../_shared/claude.ts';
import { aggregate } from '../_shared/engine/aggregation.ts';
import { checkAndRecord, recordUsage } from '../_shared/ratelimit.ts';
import type { AISummaryRequest, AISummaryResponse } from '../_shared/types.ts';

const MODEL = 'claude-sonnet-4-6';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'internal' }, 405);
  const user = await getUserFromAuthHeader(req);
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => null) as AISummaryRequest | null;
  if (!body?.matchId) return json({ ok: false, error: 'internal' }, 400);

  // 1. Load match (scoped to user)
  const { data: match } = await admin
    .from('matches')
    .select('*')
    .eq('id', body.matchId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!match) return json({ ok: false, error: 'not_found' }, 404);

  // 2. Cache hit?
  const { data: cached } = await admin
    .from('ai_summaries')
    .select('payload')
    .eq('match_id', match.id)
    .maybeSingle();
  if (cached) {
    const usage = await checkAndRecord(user.id, 'ai_summary');
    return json<AISummaryResponse>({
      ok: true,
      cached: true,
      payload: cached.payload,
      usage: { used: usage.used, limit: usage.limit },
    });
  }

  // 3. Rate-limit check (does NOT burn until generation succeeds)
  const gate = await checkAndRecord(user.id, 'ai_summary');
  if (!gate.allowed) {
    return json<AISummaryResponse>({
      ok: false, error: 'rate_limit',
      resets_at: gate.resets_at,
      usage: { used: gate.used, limit: gate.limit },
    }, 429);
  }

  // 4. Aggregate
  const { data: events } = await admin
    .from('events')
    .select('*')
    .eq('match_id', match.id)
    .order('seq');
  const stats = aggregate(
    (events ?? []).map((e) => ({
      seq: e.seq,
      ts: Date.parse(e.ts),
      winner: e.winner_team,
      byPos: e.by_pos,
      byPlayer: e.by_player,
      result: e.result,
      shot: e.shot ?? undefined,
      error: e.error_kind ?? undefined,
    })),
    { tl: match.p_tl, tr: match.p_tr, bl: match.p_bl, br: match.p_br },
  );

  // 5. Call Claude (validation happens inside generateSummary)
  let payload;
  try {
    payload = await generateSummary(stats);
  } catch (err) {
    console.error('claude/parse failed', err);
    return json({ ok: false, error: 'internal' }, 502);
  }

  // 6. Cache + log
  await admin.from('ai_summaries').insert({
    match_id: match.id, model: MODEL, payload,
  });
  await recordUsage(user.id, 'ai_summary');

  return json<AISummaryResponse>({
    ok: true,
    cached: false,
    payload,
    usage: { used: gate.used + 1, limit: gate.limit },
  });
});

function json<T>(body: T, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
