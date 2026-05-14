# Agent D · AI UI (Generate AI Report button + AISummaryView)

You enable the "Generate AI Report" button on the post-match screen and render the structured coaching report that Agent A's Edge Function returns. You are the final consumer in the dependency chain — A produces the data, B provides the authenticated `supabase` client, you call the endpoint and draw the result.

## Slice of the architecture you own

```
PostMatchScreen  (you edit)
   │
   │ user taps "Generate AI Report"
   ▼
src/api/aiSummary.ts  (you own — thin wrapper)
   │
   │ supabase.functions.invoke('generate-ai-summary', { body })
   ▼
Agent A's Edge Function  ───► Claude API
   │
   ▼
{ ok: true, cached, payload, usage } | { ok: false, error: ... }
   │
   ▼
<AISummaryView payload={...} />  (you own — renders the report)
```

## File ownership

| Type | Path | Action |
|------|------|--------|
| Owns | `src/components/AISummaryView.tsx` | Create |
| Owns | `src/api/aiSummary.ts` | Create |
| Owns | `app/match/[id]/post.tsx` | **Modify** (enable button, add states, render summary) |
| Reads | `src/api/supabase.ts` | From Agent B |
| Reads | `src/engine/types.ts` | For `Position` etc. |
| Reads | `src/theme/tokens.ts`, `src/components/SectionTitle.tsx`, `src/components/Chip.tsx`, `src/components/Button.tsx` | Reuse design primitives |
| Do not touch | `supabase/**`, `src/auth/**`, `src/sync/**`, `src/store/**`, `src/hooks/**`, `app/_layout.tsx`, `app/setup.tsx`, `app/match/[id]/live.tsx`, `app/match/[id]/breakdown/[pos].tsx` | Agents A / B / C own these |

> **Note on `live.tsx` / `breakdown/[pos].tsx`**: those two routes use `Number(params.id)` because the Phase-1 SQLite PKs were INTEGER. Agent C is changing PKs to UUID (TEXT) and removes the casts in those two files. You only need to remove the `Number(params.id)` cast in **your** file (`post.tsx`).

## Branch

Create `phase2-ai-ui` from `padel-mvp`. PR back into `padel-mvp` when done.

## Contracts you consume

**`src/api/supabase.ts`** (owner: B). If missing on your branch, write this stub:

```ts
// src/api/supabase.ts — TEMPORARY STUB. Owner: Agent B.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export const supabase: SupabaseClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder',
);
```

**Edge Function I/O** (owner: A). Vendor these types into your `src/api/aiSummary.ts`. They are the contract; do not rename fields.

```ts
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

## Step 1 — API wrapper

`src/api/aiSummary.ts`:

```ts
import { supabase } from './supabase';

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

export async function generateAISummary(matchId: string): Promise<AISummaryResponse> {
  const { data, error } = await supabase.functions.invoke<AISummaryResponse>(
    'generate-ai-summary',
    { body: { matchId } satisfies AISummaryRequest },
  );
  if (error) {
    // supabase-js returns FunctionsHttpError for non-2xx; surface a normalized error.
    const ctx = (error as any).context;
    if (ctx?.status === 429 && ctx?.json) return ctx.json as AISummaryResponse;
    return { ok: false, error: 'internal' };
  }
  return data!;
}
```

## Step 2 — `<AISummaryView>` component

`src/components/AISummaryView.tsx` — render the four sections of the payload in the navy theme. Reuse `SectionTitle` and the existing post-match card styling. Sketch:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { SectionTitle } from '@/src/components/SectionTitle';
import { Chip } from '@/src/components/Chip';
import { colors, fonts } from '@/src/theme/tokens';
import type { AISummaryPayload } from '@/src/api/aiSummary';

const POSITION_LABELS = {
  tl: 'TOP · LEFT', tr: 'TOP · RIGHT', bl: 'BOTTOM · LEFT', br: 'BOTTOM · RIGHT',
} as const;

interface Props {
  payload: AISummaryPayload;
  cached: boolean;
  positions: Record<'tl'|'tr'|'bl'|'br', string>;
}

export function AISummaryView({ payload, cached, positions }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>AI COACHING REPORT</Text>
        {cached ? <Chip label="CACHED" kind="set" small /> : <Chip label="FRESH" kind="default" small />}
      </View>

      <View style={styles.card}>
        <Text style={styles.body}>{payload.summary}</Text>
      </View>

      <SectionTitle index="A" title="Tactical Read" />
      <View style={styles.card}>
        <Text style={styles.body}>{payload.tactics}</Text>
      </View>

      <SectionTitle index="B" title="Per-Player" />
      <View style={styles.playerGrid}>
        {(['tl','tr','bl','br'] as const).map((pos) => (
          <View key={pos} style={styles.playerCard}>
            <Text style={styles.playerName}>{positions[pos] || '—'}</Text>
            <Text style={styles.playerPos}>{POSITION_LABELS[pos]}</Text>
            <Text style={styles.tag}>STRENGTHS</Text>
            {payload.players[pos].strengths.map((s, i) => (
              <Text key={i} style={styles.bullet}>· {s}</Text>
            ))}
            <Text style={[styles.tag, { marginTop: 8 }]}>WEAKNESSES</Text>
            {payload.players[pos].weaknesses.map((w, i) => (
              <Text key={i} style={styles.bullet}>· {w}</Text>
            ))}
          </View>
        ))}
      </View>

      <SectionTitle index="C" title="Key Patterns" />
      <View style={styles.card}>
        {payload.patterns.map((p, i) => (
          <Text key={i} style={[styles.body, i > 0 && { marginTop: 6 }]}>· {p}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.accent, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft, padding: 14 },
  body: { color: colors.ink, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  playerCard: { width: '48%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft, padding: 12 },
  playerName: { color: colors.ink, fontFamily: fonts.extrabold, fontSize: 14 },
  playerPos:  { color: colors.ink3, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.4, marginTop: 2, marginBottom: 8 },
  tag:        { color: colors.ink3, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.4, marginBottom: 4 },
  bullet:     { color: colors.ink2, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
});
```

## Step 3 — Wire `post.tsx`

`app/match/[id]/post.tsx` currently renders the disabled "Generate AI Report" pseudo-button. Replace that block with a state machine:

```ts
type AIState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; cached: boolean; payload: AISummaryPayload; usage: { used: number; limit: number } }
  | { kind: 'quota';  resets_at: string; usage: { used: number; limit: number } }
  | { kind: 'error';  message: string };
```

Component-level state:

```tsx
const [ai, setAi] = useState<AIState>({ kind: 'idle' });

async function generate() {
  setAi({ kind: 'loading' });
  const res = await generateAISummary(String(params.id));
  if (res.ok) {
    setAi({ kind: 'loaded', cached: res.cached, payload: res.payload, usage: res.usage });
  } else if (res.error === 'rate_limit') {
    setAi({ kind: 'quota', resets_at: res.resets_at, usage: res.usage });
  } else {
    setAi({ kind: 'error', message: res.error });
  }
}
```

Render:

- **idle**: enabled `<Pressable>` with label "GENERATE AI REPORT" + subtitle "Tactical breakdown · 30 sec". Below the button, a usage chip if we know quota (from a previous response in this session) — `"X of 3 this month"`. On press: `generate()`.
- **loading**: same button styled as "GENERATING…" + a small ActivityIndicator. Disabled.
- **loaded**: hide the button, render `<AISummaryView payload={ai.payload} cached={ai.cached} positions={state.config.positions} />`.
- **quota**: render a card "MONTHLY LIMIT REACHED · resets {date}" with the used/limit chip. No button.
- **error**: render a card "Couldn't generate ({message}). Try again." with a retry Pressable.

Use the existing `colors`/`fonts` tokens — match the dashed-border treatment of the Phase-1 stub when in `idle`, switch to solid `colors.accent` for the primary action.

**Also in this file** — remove the `Number(params.id)` cast. Replace `const matchId = useMemo(() => Number(params.id), [params.id])` with `const matchId = String(params.id ?? '')`. Update all call sites that pass `matchId` to expect a string (the `getMatch`, `getEvents`, `finishMatch` calls from `@/src/store/*` now accept strings after Agent C's PR).

Until Agent C's PR is merged, your local typecheck may complain about the string/number mismatch. Two options:
- (a) Cast at the boundary: `getMatch(matchId as unknown as number)` — ugly but isolated, easy to clean up after C merges.
- (b) Don't touch the cast in this PR, and file a follow-up to remove it after C merges.

Recommended: (a). Leave a `// TODO(phase2-sync): remove cast after C merges` comment.

## Step 4 — Loading shimmer (optional polish)

While `ai.kind === 'loading'`, render a skeleton block where `<AISummaryView>` will appear so the page doesn't jump. Use a subtle pulse via Reanimated (already in Phase 1's deps). Skip if it adds too much to your scope.

## Out of scope

- Anything in `supabase/**`, `src/auth/**`, `src/sync/**`, `src/store/**`, `src/hooks/**`.
- Other routes (`live.tsx`, `breakdown/[pos].tsx`, `setup.tsx`, `_layout.tsx`).
- Stripe / paid tier / advanced analytics.

## Verification (solo)

1. `tsc --noEmit` + `expo lint` clean.
2. **UI without backend** (sub on stub `supabase`): in dev, you can hard-code a mock `AISummaryResponse` in a feature flag to verify the `<AISummaryView>` renders correctly with seeded data. Remove before PR.
3. **End-to-end** (requires Agent A's Edge Function deployed + Agent B's auth merged so you can sign in):
   - Complete a match.
   - Tap "Generate AI Report" → loading → loaded with all sections populated.
   - Tap again (re-enter Post screen): cached chip shown.
   - Run 3 reports total, then on the 4th completed match: button → quota state shown with correct reset date.
4. **Offline / error**: airplane mode → tap Generate → error state shown gracefully (no crash).

## Hand-off note

After this PR is merged, the disabled stub from Phase 1 is gone and the AI Report button is fully functional against Agent A's Edge Function. Future work (Phase 3): paid tier flips the quota gate and unlocks advanced analytics; both can hang off the same `aiSummary.ts` API surface.
