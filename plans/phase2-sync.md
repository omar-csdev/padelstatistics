# Agent C · Sync (UUIDs + outbox + useSync + SyncBoundary + wire writes)

You make matches and events round-trip between the local SQLite cache and Supabase. The app stays **local-first**: every coach tap writes to SQLite immediately (current Phase 1 behaviour); your job is to queue those writes and flush them up when the network and auth allow. You also pull down matches the same user has on other devices.

## Slice of the architecture you own

```
┌──────────────────────────────────────────────────────┐
│  App (local-first writes — unchanged latency)        │
│                                                      │
│   useMatch.logPoint  ──►  src/store/events.ts       │
│   setup.createMatch  ──►  src/store/matches.ts      │
│                              │                       │
│                              ▼                       │
│                   sync_status = 'pending'            │
│                                                      │
│   <SyncBoundary>  (mounted in _layout by Agent B)    │
│     useSync(): on foreground / NetInfo change →      │
│       1. push pending matches                        │
│       2. push pending events (ordered by seq)        │
│       3. pull remote matches owned by user           │
└─────────────────────┬────────────────────────────────┘
                      │ supabase-js (Agent B's client)
                      ▼
                Supabase Postgres (Agent A's tables)
```

## File ownership

| Type | Path | Action |
|------|------|--------|
| Owns | `src/store/db.ts` | **Rewrite** schema (TEXT PKs + sync_status) |
| Owns | `src/store/matches.ts` | **Rewrite** for UUIDs |
| Owns | `src/store/events.ts` | **Rewrite** for UUIDs + sync_status helpers |
| Owns | `src/sync/queue.ts` | Create |
| Owns | `src/sync/useSync.ts` | Create |
| Owns | `src/sync/SyncBoundary.tsx` | Create (or overwrite B's stub) |
| Owns | `src/hooks/useMatch.ts` | **Modify** (only the write paths — keep signatures; change `matchId: number` → `string`) |
| Owns | `app/setup.tsx` | **Modify** the `createMatch` call site only |
| Owns | `app/match/[id]/live.tsx` | **Modify only** — strip `Number(params.id)` cast (UUIDs are strings) |
| Owns | `app/match/[id]/breakdown/[pos].tsx` | **Modify only** — strip `Number(params.id)` cast |
| Owns | `package.json` | Add deps only |
| Reads | `src/api/supabase.ts`, `src/auth/useAuth.ts` | From Agent B |
| Reads | `src/engine/types.ts`, `src/engine/scoring.ts` | Reuse `fold` / types |
| Do not touch | `app/_layout.tsx`, `app/index.tsx`, `app/match/[id]/post.tsx`, `supabase/**`, `src/api/**`, `src/auth/**`, `src/components/**` | Agents A / B / D own these |

The two `app/match/[id]/*` files outside `post.tsx` are yours because their only Phase-2 edit is the UUID cast — a sync concern, not an AI-UI concern. Agent D will perform the equivalent cast change inside `post.tsx`.

## Branch

Create `phase2-sync` from `padel-mvp`. PR back into `padel-mvp` when done.

## Dependencies to install

```
npx expo install expo-crypto @react-native-community/netinfo
```

## Contracts you expose

Other agents (B mounts `<SyncBoundary>` in `_layout.tsx`):

```tsx
// src/sync/SyncBoundary.tsx
import type { ReactNode } from 'react';
export function SyncBoundary({ children }: { children: ReactNode }): JSX.Element;
```

```ts
// src/sync/useSync.ts
export function useSync(): {
  pending: number;
  flushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
};
```

## Contracts you consume (stub-if-missing)

**`src/api/supabase.ts`** (owner: B). If missing on your branch, write this stub so your typecheck passes:

```ts
// src/api/supabase.ts — TEMPORARY STUB. Owner: Agent B.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export const supabase: SupabaseClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder',
);
```

**`src/auth/useAuth.ts`** (owner: B). If missing, write this stub:

```ts
// src/auth/useAuth.ts — TEMPORARY STUB. Owner: Agent B.
import type { Session } from '@supabase/supabase-js';
export function useAuth() {
  return {
    session: null as Session | null,
    signInWithEmail: async (_: string) => {},
    signInWithApple: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
  };
}
```

Do **not** otherwise edit B's files. Stubs are last-resort to keep your build typechecking in isolation.

## Step 1 — Local SQLite schema rewrite

Rewrite `src/store/db.ts`:

```ts
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (_db) return _db;
  _db = SQLite.openDatabaseSync('padelstatistics.db');
  initSchema(_db);
  return _db;
}

function initSchema(db: SQLite.SQLiteDatabase): void {
  // Phase 2: UUID PKs + sync_status. No released users yet, so we wipe and recreate.
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      created_at INTEGER NOT NULL,
      finished_at INTEGER,
      status TEXT NOT NULL,
      team_a_name TEXT NOT NULL,
      team_b_name TEXT NOT NULL,
      p_tl TEXT NOT NULL, p_tr TEXT NOT NULL, p_bl TEXT NOT NULL, p_br TEXT NOT NULL,
      best_of INTEGER NOT NULL,
      scoring TEXT NOT NULL,
      first_server TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      winner_team TEXT NOT NULL,
      by_pos TEXT NOT NULL,
      by_player TEXT NOT NULL,
      result TEXT NOT NULL,
      shot TEXT,
      error_kind TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_events_match ON events(match_id, seq);
    CREATE INDEX IF NOT EXISTS idx_matches_sync ON matches(sync_status);
    CREATE INDEX IF NOT EXISTS idx_events_sync ON events(sync_status);
  `);

  // Hard reset if old INTEGER PK rows exist (Phase 1 leftover on dev devices).
  // Detect by reading the pragma; if a row exists with a numeric id, wipe.
  const probe = db.getFirstSync<{ id: string }>('SELECT id FROM matches LIMIT 1');
  if (probe && /^\d+$/.test(String(probe.id))) {
    db.execSync('DELETE FROM events; DELETE FROM matches;');
  }
}

export function wipe(): void {
  const db = getDb();
  db.execSync('DELETE FROM events; DELETE FROM matches;');
}
```

`wipe()` is exposed for sign-out (Agent B can call it; you don't wire that — just provide it).

## Step 2 — Match + event stores (UUIDs)

Rewrite `src/store/matches.ts`:

```ts
import * as Crypto from 'expo-crypto';
import type { MatchConfig } from '@/src/engine/types';
import { getDb } from './db';

export type MatchStatus = 'in_progress' | 'finished';
export type SyncStatus = 'pending' | 'synced';

export interface MatchRow {
  id: string;
  userId: string | null;
  createdAt: number;
  finishedAt: number | null;
  status: MatchStatus;
  config: MatchConfig;
  syncStatus: SyncStatus;
}

// (RawRow + toRow shape mirrors Phase 1 with `id TEXT`, `user_id`, `sync_status`.)

export function createMatch(config: MatchConfig, opts?: { userId?: string | null }): string {
  const db = getDb();
  const id = Crypto.randomUUID();
  const now = Date.now();
  db.runSync(
    `INSERT INTO matches (id, user_id, created_at, status, team_a_name, team_b_name,
                          p_tl, p_tr, p_bl, p_br, best_of, scoring, first_server, sync_status)
     VALUES (?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, opts?.userId ?? null, now,
     config.teamNames[0], config.teamNames[1],
     config.positions.tl, config.positions.tr, config.positions.bl, config.positions.br,
     config.bestOf, config.scoring, config.firstServer],
  );
  return id;
}

// getMatch, listMatches, finishMatch, deleteMatch — same shape as Phase 1, but:
// - id is string
// - include sync_status column
// - finishMatch flips sync_status back to 'pending' so the status change replicates.
//
// markSynced(id) sets sync_status='synced' for matches.
// listPendingMatches() returns all matches with sync_status='pending'.
// upsertFromRemote(row) inserts/updates a match from a server pull; sync_status='synced'.
```

Rewrite `src/store/events.ts`:

```ts
import * as Crypto from 'expo-crypto';
import type { PointEvent } from '@/src/engine/types';
import { getDb } from './db';

export function appendEvent(matchId: string, ev: PointEvent): string {
  const db = getDb();
  const id = Crypto.randomUUID();
  db.runSync(
    `INSERT INTO events (id, match_id, seq, ts, winner_team, by_pos, by_player, result, shot, error_kind, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, matchId, ev.seq, ev.ts, ev.winner, ev.byPos, ev.byPlayer, ev.result,
     ev.shot ?? null, ev.error ?? null],
  );
  return id;
}

// getEvents, popLastEvent — same shape; popLastEvent now also deletes from the outbox.
// listPendingEvents(matchId?) returns events with sync_status='pending', ordered by (match_id, seq).
// markEventSynced(id) flips status.
// upsertFromRemote(ev) for server pull.
```

## Step 3 — Outbox queue

`src/sync/queue.ts` — pure functions over SQLite. No React.

```ts
import { getDb } from '@/src/store/db';

export interface PendingMatch { /* matches all columns */ }
export interface PendingEvent { /* matches all columns */ }

export function listPendingMatches(): PendingMatch[] { /* WHERE sync_status='pending' */ }
export function listPendingEvents():  PendingEvent[]  { /* WHERE sync_status='pending' ORDER BY match_id, seq */ }
export function markMatchSynced(id: string): void { /* UPDATE matches SET sync_status='synced' */ }
export function markEventSynced(id: string): void { /* UPDATE events SET sync_status='synced' */ }
export function setUserIdOnLocalMatches(userId: string): void {
  // After sign-in, stamp user_id onto any local matches created while signed out.
  getDb().runSync(`UPDATE matches SET user_id = ? WHERE user_id IS NULL`, [userId]);
}
```

## Step 4 — useSync hook

`src/sync/useSync.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/src/api/supabase';
import { useAuth } from '@/src/auth/useAuth';
import {
  listPendingMatches, listPendingEvents,
  markMatchSynced, markEventSynced,
  setUserIdOnLocalMatches,
} from './queue';
import { upsertFromRemote as upsertMatchFromRemote } from '@/src/store/matches';
import { upsertFromRemote as upsertEventFromRemote } from '@/src/store/events';

export function useSync() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [pending, setPending] = useState(0);

  const flushNow = useCallback(async () => {
    if (!userId) return;
    setUserIdOnLocalMatches(userId);
    const matches = listPendingMatches();
    for (const m of matches) {
      const { error } = await supabase.from('matches').upsert({
        id: m.id, user_id: userId, created_at: new Date(m.createdAt).toISOString(),
        finished_at: m.finishedAt ? new Date(m.finishedAt).toISOString() : null,
        status: m.status,
        team_a_name: m.teamAName, team_b_name: m.teamBName,
        p_tl: m.pTl, p_tr: m.pTr, p_bl: m.pBl, p_br: m.pBr,
        best_of: m.bestOf, scoring: m.scoring, first_server: m.firstServer,
      }, { onConflict: 'id' });
      if (!error) markMatchSynced(m.id);
    }
    const events = listPendingEvents();
    for (const e of events) {
      const { error } = await supabase.from('events').upsert({
        id: e.id, match_id: e.matchId, seq: e.seq, ts: new Date(e.ts).toISOString(),
        winner_team: e.winner, by_pos: e.byPos, by_player: e.byPlayer,
        result: e.result, shot: e.shot, error_kind: e.error ?? null,
      }, { onConflict: 'id' });
      if (!error) markEventSynced(e.id);
    }
    setPending(listPendingMatches().length + listPendingEvents().length);
  }, [userId]);

  const pullNow = useCallback(async () => {
    if (!userId) return;
    const { data: ms } = await supabase.from('matches').select('*').eq('user_id', userId);
    for (const m of ms ?? []) upsertMatchFromRemote(m);
    const matchIds = (ms ?? []).map((m: any) => m.id);
    if (matchIds.length) {
      const { data: evs } = await supabase.from('events').select('*').in('match_id', matchIds);
      for (const e of evs ?? []) upsertEventFromRemote(e);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const fire = async () => {
      if (cancelled) return;
      await flushNow();
      await pullNow();
    };
    fire();
    const appSub = AppState.addEventListener('change', (s) => { if (s === 'active') fire(); });
    const netSub = NetInfo.addEventListener((n) => { if (n.isConnected) fire(); });
    return () => { cancelled = true; appSub.remove(); netSub(); };
  }, [userId, flushNow, pullNow]);

  return { pending, flushNow, pullNow };
}
```

## Step 5 — SyncBoundary

`src/sync/SyncBoundary.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useSync } from './useSync';

export function SyncBoundary({ children }: { children: ReactNode }) {
  // Side effect only — hook mounts the listeners.
  useSync();
  return <>{children}</>;
}
```

If B already created a stub of this file on `padel-mvp`, overwrite it.

## Step 6 — Wire writes to the outbox

The Phase 1 `useMatch` and `setup.tsx` already call `appendEvent` / `popLastEvent` / `createMatch`. With the new SQLite schema those calls now write `sync_status='pending'` automatically — **no signature changes needed**. Verify by tracing:

- `app/setup.tsx`'s `start()` calls `createMatch(config)` → now returns a string UUID. **Update the call site**: `router.replace(`/match/${id}/live`)` already templates the id, so this just works. Confirm no `Number(...)` casts.
- `app/match/[id]/live.tsx` reads the id as string — the existing `Number(params.id)` cast will break. **This file is in your Owns list.** Strip the cast: `const matchId = String(params.id ?? '')`. Update the local typecheck to expect string. Same change in `app/match/[id]/breakdown/[pos].tsx`. Agent D performs the equivalent change in `post.tsx`.

- `src/hooks/useMatch.ts` — change `matchId: number` to `matchId: string`; remove `Number(...)` parsing. Same for any `getMatch(id)` calls.

## Step 7 — Sign-out clears local cache

Expose `wipeLocalCache` from `src/store/db.ts` (already done — `wipe()`). Add a listener in `useSync` (or expose a `clearOnSignOut` helper) that calls `wipe()` when `useAuth().session` transitions to `null`. Implementation suggestion in `useSync.ts`:

```ts
useEffect(() => {
  if (userId === null) {
    wipe(); // clear local cache when signed out
  }
}, [userId]);
```

(Be careful not to wipe on initial render when session is loading; gate on a "previously had session" ref if needed.)

## Out of scope

- The sign-in flow itself — Agent B.
- Edge Function / AI summary — Agents A / D.
- AI button on Post screen — Agent D.

## Verification (solo)

1. `tsc --noEmit` + `expo lint` clean.
2. **DB schema**: launch the app, complete the existing Setup flow → SQLite `matches` table has `id TEXT` UUID and `sync_status='pending'`. `events` rows also `pending`.
3. **Outbox flush** (requires Supabase project running + signed in):
   - Sign in (use B's stub during dev if Auth PR not yet merged — sign-in won't actually work without B, but you can manually insert a row into local SQLite with a user_id to test push).
   - Create a match and log 5 events.
   - Watch the Supabase dashboard: rows appear in `matches` and `events`. Local `sync_status` flips to `synced`.
4. **Offline test**: turn off network → log 10 points → all visible locally with `sync_status='pending'`. Turn network on → wait for `useSync` to fire (next foreground or NetInfo event) → rows appear in dashboard.
5. **Pull**: in the Supabase dashboard, manually insert a `matches` row owned by the signed-in user. Reopen the app → it appears in the History screen.
6. **Sign-out wipe**: sign out → local SQLite cleared.

## Hand-off note

After this PR is merged:
- `<SyncBoundary>` is real; B's stub is overwritten cleanly.
- Agent D's AI Report button can be wired without worrying about whether the match exists on the server — it'll be there after the next flush (and the Edge Function 404s if not, which D handles).
