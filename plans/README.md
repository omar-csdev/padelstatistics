# Phase 2 — parallel agent plans

Phase 2 (Backend + AI + Auth) is split into **four agent-ready plan files**. Fire each in its own Claude Code session; they're designed not to collide on shared files.

| Plan | Agent role | Owns |
|------|-----------|------|
| [`phase2-backend.md`](./phase2-backend.md) | **A · Backend** — Supabase project, schema, RLS, Edge Function `generate-ai-summary` | `supabase/**`, `SETUP.md` |
| [`phase2-auth.md`](./phase2-auth.md) | **B · Auth** — `supabase-js` client, `AuthProvider`, sign-in screen, `_layout` gate | `src/api/supabase.ts`, `src/auth/**`, `app/(auth)/**`, `app/_layout.tsx`, `.env.example` |
| [`phase2-sync.md`](./phase2-sync.md) | **C · Sync** — UUID PKs, outbox queue, `useSync`, `<SyncBoundary>`, wire writes | `src/sync/**`, `src/store/**`, `src/hooks/useMatch.ts`, `app/setup.tsx`, `app/match/[id]/live.tsx`, `app/match/[id]/breakdown/[pos].tsx` |
| [`phase2-ai-ui.md`](./phase2-ai-ui.md) | **D · AI UI** — Generate AI Report button, `<AISummaryView>`, post-match wiring | `src/components/AISummaryView.tsx`, `src/api/aiSummary.ts`, `app/match/[id]/post.tsx` |

> `app/match/[id]/live.tsx` and `breakdown/[pos].tsx` go to **C** because their only Phase-2 edit is stripping the `Number(params.id)` cast — a UUID-schema concern. `post.tsx` stays with D (it gets a full AI-button rewrite).

## Dependency graph

```
                     ┌──────────────────────────┐
                     │  A · Backend             │
                     │  (supabase/**)           │
                     │  Independent.            │
                     └────────────┬─────────────┘
                                  │ runtime: Edge Function endpoint + DB
                                  ▼
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────┐         ┌──────────────────┐     ┌──────────────────┐
│ B · Auth     │         │ C · Sync         │     │ D · AI UI        │
│  exposes:    │         │  exposes:        │     │  consumes:       │
│  supabase    │◀────────┤  SyncBoundary    │     │  supabase (B)    │
│  useAuth()   │  reads  │  useSync()       │     │  Edge Fn (A)     │
└──────────────┘         └──────────────────┘     └──────────────────┘
        ▲                          ▲                        ▲
        └─ C reads useAuth + supabase via stub-if-missing ──┘
        └─ D reads supabase via stub-if-missing ────────────┘
```

## How parallelism is preserved

Each plan declares **strict file ownership** — no two agents edit the same file. Where one agent depends on another's file, the plan tells it to **create a minimal stub at the canonical path if the file does not yet exist on its branch**. Stubs are byte-equivalent regardless of which agent writes them (when more than one consuming agent stubs the same file), so concurrent stub creation merges cleanly. When the owning agent's PR is merged, the real implementation overwrites the stub.

### Merge conflict resolution

When rebasing a consumer PR after the producer's PR has merged, the consumer's stub will collide with the producer's real file. Always resolve by taking the **owning agent's version** — i.e., delete the stub. The stubs are marked `// TEMPORARY STUB. Owner: Agent X.` at the top to make this obvious.

Two real conflict points to watch for:

- **`package.json`** — both B and C add dependencies. Add them in `npm i …` form per their plans; on merge, take the union of all added entries (this is a one-line manual merge).
- **`src/api/supabase.ts`** — both C and D stub this if B hasn't merged. Their stubs are intentionally byte-identical (copy-paste from the Contracts block), so a parallel push won't conflict. The conflict appears only on rebase after B merges → delete the stub, take B's real version.

## Recommended merge order

Parallel execution is fine in any order. PRs are slightly cleaner to merge in this order:

1. **A · Backend** — completely isolated, no app file touches. Merge anytime.
2. **B · Auth** — owns `_layout.tsx`. Merge before C so C inherits the AuthProvider shell.
3. **C · Sync** — overwrites B's `<SyncBoundary>` stub with the real impl; reads `useAuth()` from B.
4. **D · AI UI** — reads `supabase` from B; runtime-calls A's Edge Function. Merge last.

## Contracts (frozen — copy verbatim into stubs if missing)

These are the cross-agent TypeScript signatures. Every agent plan repeats the ones it touches.

```ts
// src/api/supabase.ts        (owner: B)
import type { SupabaseClient } from '@supabase/supabase-js';
export const supabase: SupabaseClient;

// src/auth/useAuth.ts        (owner: B)
import type { Session } from '@supabase/supabase-js';
export function useAuth(): {
  session: Session | null;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

// src/sync/SyncBoundary.tsx  (owner: C)
import type { ReactNode } from 'react';
export function SyncBoundary({ children }: { children: ReactNode }): JSX.Element;

// src/sync/useSync.ts        (owner: C)
export function useSync(): {
  pending: number;
  flushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
};

// Edge Function I/O          (owner: A; consumer: D, vendored to src/api/aiSummary.ts)
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

## Out of scope for all four agents

Paid tier / Stripe, season trends, player ranking, real-time AI during match, social / sharing, app-store submission.
