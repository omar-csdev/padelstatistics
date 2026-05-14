# Agent A · Backend (Supabase + AI Edge Function)

You are implementing the **backend slice** of PadelStatistics Phase 2. The repo already contains a working React Native app (`padel-mvp` branch, Phase 1 shipped) with a deterministic scoring engine at `src/engine/`. Your job is to stand up Supabase as the canonical store and an Edge Function that turns aggregated match stats into a structured AI coaching report. **You do not touch any app code.**

## Slice of the architecture you own

```
React Native app  ──HTTPS──►  Supabase Postgres   (matches, events, ai_summaries, usage_log)
                  ──HTTPS──►  Edge Function: generate-ai-summary
                                    │
                                    ▼
                              Anthropic Claude API  (claude-sonnet-4-6)
```

The app keeps writing to local SQLite first (Phase 1 behaviour); Agent C wires the outbox that pushes events to your tables. Agent D wires the UI button that calls your Edge Function. You don't depend on either — you just need a working DB + endpoint.

## File ownership

| Type | Path | Action |
|------|------|--------|
| Owns | `supabase/**` | Create from scratch |
| Owns | `SETUP.md` | Create at repo root |
| Reads | `src/engine/types.ts`, `src/engine/scoring.ts`, `src/engine/flags.ts`, `src/engine/aggregation.ts` | Vendor verbatim into `supabase/functions/_shared/engine/` |
| Do not touch | `src/**`, `app/**`, `package.json`, `.env.example` | Agent B / C / D own these |

## Branch

Create `phase2-backend` from `padel-mvp`. PR back into `padel-mvp` when done.

## Contracts you expose

Other agents and you both depend on these shapes. They are normative — do not rename fields.

```ts
// Edge Function request/response. Vendored by Agent D into src/api/aiSummary.ts.
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
```

Database tables and columns are listed below — Agent C's outbox writes into them, so column names are also normative.

## Step 1 — Supabase project scaffold

Use the Supabase CLI: `npx supabase init` at repo root. This creates `supabase/config.toml`. Set:

```toml
[functions.generate-ai-summary]
verify_jwt = true
```

## Step 2 — Migration

Write `supabase/migrations/20260514000000_init.sql`:

```sql
create extension if not exists "pgcrypto";

create table public.matches (
  id           uuid primary key,                                    -- client-generated UUID
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null check (status in ('in_progress','finished')),
  team_a_name  text not null,
  team_b_name  text not null,
  p_tl text not null, p_tr text not null, p_bl text not null, p_br text not null,
  best_of      int  not null check (best_of in (3,5)),
  scoring      text not null check (scoring in ('advantage','golden')),
  first_server text not null check (first_server in ('top','bot'))
);

create table public.events (
  id          uuid primary key,
  match_id    uuid not null references public.matches(id) on delete cascade,
  seq         int  not null,
  ts          timestamptz not null,
  winner_team text not null check (winner_team in ('top','bot')),
  by_pos      text not null check (by_pos in ('tl','tr','bl','br')),
  by_player   text not null,
  result      text not null check (result in ('won','lost')),
  shot        text,
  error_kind  text,
  unique (match_id, seq)
);
create index events_match_seq_idx on public.events (match_id, seq);

create table public.ai_summaries (
  match_id   uuid primary key references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  model      text not null,
  payload    jsonb not null
);

create table public.usage_log (
  id      bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    text not null,                                            -- 'ai_summary'
  ts      timestamptz not null default now()
);
create index usage_log_user_kind_ts_idx on public.usage_log (user_id, kind, ts);

-- Row-level security
alter table public.matches       enable row level security;
alter table public.events        enable row level security;
alter table public.ai_summaries  enable row level security;
alter table public.usage_log     enable row level security;

create policy own_matches on public.matches
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy own_events on public.events
  for all
  using (exists (select 1 from public.matches m where m.id = events.match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.matches m where m.id = events.match_id and m.user_id = auth.uid()));

create policy own_ai_summaries on public.ai_summaries
  for all
  using (exists (select 1 from public.matches m where m.id = ai_summaries.match_id and m.user_id = auth.uid()));

create policy own_usage on public.usage_log
  for select
  using (auth.uid() = user_id);
```

The Edge Function will use the service role key and bypass RLS — RLS is only for direct app-to-db traffic from `supabase-js`.

## Step 3 — Vendor the scoring engine

Copy the four engine files into `supabase/functions/_shared/engine/`:

- `supabase/functions/_shared/engine/types.ts`     ← copy of `src/engine/types.ts`
- `supabase/functions/_shared/engine/scoring.ts`   ← copy of `src/engine/scoring.ts`
- `supabase/functions/_shared/engine/flags.ts`     ← copy of `src/engine/flags.ts`
- `supabase/functions/_shared/engine/aggregation.ts` ← copy of `src/engine/aggregation.ts`

These are pure TS with no React or Node imports. They run as-is on Deno. Do **not** modify the logic — drift between client and server engines breaks parity. The only allowed edits are import-path fixes if any (the engine uses relative imports already).

Add a top-of-file banner to each vendored copy:

```ts
// VENDORED from src/engine/* — do not edit here.
// Keep byte-identical to the canonical version in the RN app.
```

## Step 4 — Shared helpers

Create `supabase/functions/_shared/supabase.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function getUserFromAuthHeader(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return data.user;
}
```

Create `supabase/functions/_shared/claude.ts` — uses the Anthropic SDK with **prompt caching** on the system prompt:

```ts
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.40';
import type { MatchStats } from './engine/aggregation.ts';   // adjust if your aggregation file exports the type differently
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

  const text = resp.content.map(b => b.type === 'text' ? b.text : '').join('').trim();
  // Strip accidental ```json fences if model emits them despite instruction.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const parsed = JSON.parse(cleaned) as AISummaryPayload;
  validatePayload(parsed);
  return parsed;
}

function validatePayload(p: any): asserts p is AISummaryPayload {
  if (typeof p?.summary !== 'string') throw new Error('payload.summary missing');
  if (typeof p?.tactics !== 'string') throw new Error('payload.tactics missing');
  for (const pos of ['tl','tr','bl','br']) {
    const x = p?.players?.[pos];
    if (!x || !Array.isArray(x.strengths) || !Array.isArray(x.weaknesses)) {
      throw new Error(`payload.players.${pos} malformed`);
    }
  }
  if (!Array.isArray(p?.patterns)) throw new Error('payload.patterns missing');
}
```

Create `supabase/functions/_shared/types.ts` — re-export the wire types listed in **Contracts you expose**.

Create `supabase/functions/_shared/ratelimit.ts`:

```ts
import { admin } from './supabase.ts';
const FREE_TIER_LIMIT = 3;

export async function checkAndRecord(userId: string, kind: 'ai_summary') {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await admin
    .from('usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)
    .gte('ts', monthStart.toISOString());
  if (error) throw error;
  const used = count ?? 0;
  if (used >= FREE_TIER_LIMIT) {
    const next = new Date(monthStart);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { allowed: false as const, used, limit: FREE_TIER_LIMIT, resets_at: next.toISOString() };
  }
  return { allowed: true as const, used, limit: FREE_TIER_LIMIT };
}

export async function recordUsage(userId: string, kind: 'ai_summary') {
  const { error } = await admin.from('usage_log').insert({ user_id: userId, kind });
  if (error) throw error;
}
```

## Step 5 — Edge Function

`supabase/functions/generate-ai-summary/index.ts`:

```ts
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
    (events ?? []).map(e => ({
      seq: e.seq, ts: Date.parse(e.ts), winner: e.winner_team, byPos: e.by_pos,
      byPlayer: e.by_player, result: e.result, shot: e.shot ?? undefined,
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
    ok: true, cached: false, payload,
    usage: { used: gate.used + 1, limit: gate.limit },
  });
});

function json<T>(body: T, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
```

## Step 6 — `SETUP.md` at repo root

Document the manual steps the user must run once:

```markdown
# Supabase setup (one-time)

1. Create a project at https://supabase.com/dashboard.
2. Copy URL + anon key. Add to `.env`:
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
3. `npx supabase link --project-ref <ref>`
4. `npx supabase db push`  (applies migrations)
5. Set Edge Function secrets in dashboard → Functions → Secrets:
   - ANTHROPIC_API_KEY
   - SUPABASE_URL                (auto-set)
   - SUPABASE_SERVICE_ROLE_KEY   (auto-set)
6. `npx supabase functions deploy generate-ai-summary`
7. (Auth) Dashboard → Authentication → Providers: enable Email, Apple, Google as desired.
   Add the Expo redirect URL (printed by `npx expo start`) to allowed redirect URLs.
```

## Out of scope

- Any `src/**` or `app/**` change — Agents B/C/D own those.
- Stripe / paid tier.
- Auth provider config — that's a manual dashboard step in `SETUP.md`, not code.

## Verification (solo)

1. **Static**: `npx supabase functions serve generate-ai-summary --env-file .env.local` runs without import errors. Local Postgres: `npx supabase start && npx supabase db push` succeeds.
2. **Deno typecheck**: `deno check supabase/functions/generate-ai-summary/index.ts` clean.
3. **End-to-end smoke** (requires real `ANTHROPIC_API_KEY` in `.env.local`):
   - Create a row in `matches` with `auth.uid()` as `user_id`. Insert a few events.
   - `curl -X POST http://127.0.0.1:54321/functions/v1/generate-ai-summary -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" -d '{"matchId":"<uuid>"}'`
   - Expect 200 with `{ ok: true, cached: false, payload: { summary, tactics, players, patterns } }`.
   - Second call → `{ cached: true }`.
   - Burn 3 calls → 4th returns 429 `rate_limit`.
4. **RLS**: With User A's JWT, try `select * from matches where id = '<User B match id>'` → empty.

## Hand-off note

After this PR is merged:
- Agent D (AI UI) can vendor `supabase/functions/_shared/types.ts` into `src/api/aiSummary.ts` and call the Edge Function with `supabase.functions.invoke('generate-ai-summary', { body: { matchId } })`.
- Agent C (Sync) can push rows to `matches` and `events`; RLS is already enforced.
